package opai.music;

import com.google.gson.*;
import com.sun.net.httpserver.*;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/** Local theme adapter. NCM request protocol adapted from GPL-3.0 Tritium Music. */
public final class MusicService implements AutoCloseable {
    static final Gson JSON=new Gson();
    static final String UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
    static final HttpClient HTTP=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(12)).followRedirects(HttpClient.Redirect.NORMAL).build();
    private final HttpServer server;
    private final ExecutorService workers=Executors.newFixedThreadPool(4,r->{Thread t=new Thread(r,"Opai Music API");t.setDaemon(true);return t;});
    private final String token=UUID.randomUUID().toString();
    private final Path directory;
    private final URI netease,gd;
    private final Map<String,String> cookies=new LinkedHashMap<>();
    private final Map<String,Cache> cache=new LinkedHashMap<>();
    private final Deque<Long> gdRequests=new ArrayDeque<>();
    private final AtomicLong generation=new AtomicLong();
    private volatile boolean closed=false,repeatOne=false,loading=false;
    private volatile double volume=.25;
    private volatile String provider="",source="netease",error="",profile="",qrKey="";
    private volatile long userId=0,qrAt=0;
    volatile String failureType="";
    private volatile JsonObject track=null;
    private volatile List<JsonObject> queue=List.of();
    private volatile int index=-1;
    private volatile Output player=null;
    private final JsonObject widgets=obj(Map.of("island",true,"islandLyrics",true,"info",true,"lyrics",true,"spectrum",true,"translation",true));
    private final List<JsonObject> favorites=new ArrayList<>();
    private final OutputFactory factory;
    private volatile boolean moduleEnabled=true;private volatile String lyricsMode="HUD",moduleSignature="",lyricPending="";
    private volatile long openSequence=0,openedAt=0,lyricRetryAt=0;
    private volatile JsonObject worldOptions=new JsonObject();
    private final DangoLyrics dango=new DangoLyrics();
    private final ConcurrentHashMap<String,Object> lyricLocks=new ConcurrentHashMap<>();
    public synchronized void configureModule(String json)throws Exception{
        if(json.equals(moduleSignature))return;JsonObject b=JsonParser.parseString(json).getAsJsonObject();moduleEnabled=b.get("enabled").getAsBoolean();lyricsMode=text(b,"lyricsMode");worldOptions=b.deepCopy();if(!moduleEnabled&&player!=null)player.pause();settings(b);moduleSignature=json;
    }
    public synchronized void openPlayer(){openSequence++;openedAt=System.currentTimeMillis();}
    public void clearWorldLyrics(){dango.reset();}
    public String worldLyrics(double x,double y,double z,double yaw,double pitch){
        JsonObject current=track,options=worldOptions;String key=current==null?"":trackKey(current);Output p=player;
        boolean show=moduleEnabled&&lyricsMode.equals("Dango3D")&&widgets.get("lyrics").getAsBoolean()&&p!=null&&p.playing();
        if(show&&!key.equals(lyricPending)&&System.currentTimeMillis()>=lyricRetryAt){lyricPending=key;workers.submit(()->{try{JsonObject words=lyrics(current);if(track!=null&&trackKey(track).equals(key))dango.timeline(key,text(words,"lyric"),text(words,"yrc"));}catch(Exception ignored){lyricPending="";lyricRetryAt=System.currentTimeMillis()+5000;}});}
        return JSON.toJson(dango.frame(key,p==null?0:p.position(),show,System.currentTimeMillis(),x,y,z,yaw,pitch,decimal(options,"distance",10),decimal(options,"scale",1),decimal(options,"spread",30),!options.has("wordPop")||options.get("wordPop").getAsBoolean(),!options.has("wiggle")||options.get("wiggle").getAsBoolean()));
    }
    private static double decimal(JsonObject o,String key,double fallback){try{return o.get(key).getAsDouble();}catch(Exception e){return fallback;}}

    record Cache(long until,JsonElement value){}
    interface Output {void play();void pause();void seek(long millis);void close();void volume(float value);boolean playing();long position();default double[] spectrum(){return new double[32];}}
    interface OutputFactory {Output create(String url,String type,long duration,Runnable end,Runnable fail);}
    public static MusicService start(String directory)throws Exception{return new MusicService(Path.of(directory),URI.create("https://interfacepc.music.163.com"),URI.create("https://music-api.gdstudio.xyz/api.php"),null);}
    MusicService(Path directory,URI netease,URI gd,OutputFactory factory)throws Exception{
        this.directory=directory;this.netease=netease;this.gd=gd;this.factory=factory==null?MusicService::nativeOutput:factory;
        Files.createDirectories(directory);readSettings();readFavorites();
        server=HttpServer.create(new InetSocketAddress(InetAddress.getByName("127.0.0.1"),0),0);
        server.setExecutor(workers);server.createContext("/",this::handle);server.start();
    }
    public String descriptor(){return JSON.toJson(Map.of("protocol",1,"version","1.2.0","url","http://127.0.0.1:"+server.getAddress().getPort(),"token",token));}
    static InputStream openAudio(String url)throws IOException{
        URI uri=URI.create(url);if(!Set.of("https","http").contains(uri.getScheme())||uri.getHost()==null)throw new IOException("Invalid media URL");
        HttpResponse<InputStream> r;
        try{r=HTTP.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(35)).header("User-Agent",UA).GET().build(),HttpResponse.BodyHandlers.ofInputStream());}catch(InterruptedException e){Thread.currentThread().interrupt();throw new IOException("Audio interrupted",e);}
        if(r.statusCode()!=200&&r.statusCode()!=206){r.body().close();throw new IOException("Audio HTTP "+r.statusCode());}return r.body();
    }
    private static Output nativeOutput(String url,String type,long duration,Runnable end,Runnable fail){
        PcmSpectrum meter=new PcmSpectrum();StreamingSoundPlayer p=new StreamingSoundPlayer(url,type,duration,meter::accept);p.setOnFinished(end);p.setOnFailed(fail);
        return new Output(){public void play(){p.play();}public void pause(){p.pause();}public void seek(long m){p.seek(m);}public void close(){p.close();}public void volume(float v){p.setVolume(v);}public boolean playing(){return p.isPlaying();}public long position(){return p.positionMillis();}public double[] spectrum(){return p.isPlaying()?meter.values():new double[32];}};
    }
    private void handle(HttpExchange x)throws IOException{
        String origin=x.getRequestHeaders().getFirst("Origin");
        if(origin!=null){try{URI o=URI.create(origin);if(!"http".equals(o.getScheme())||!Set.of("localhost","127.0.0.1","[::1]").contains(o.getHost())){respond(x,403,Map.of("error","Origin rejected"));return;}}catch(Exception e){respond(x,403,Map.of("error","Origin rejected"));return;}
            x.getResponseHeaders().set("Access-Control-Allow-Origin",origin);x.getResponseHeaders().set("Vary","Origin");}
        if(x.getRequestMethod().equals("OPTIONS")){x.getResponseHeaders().set("Access-Control-Allow-Headers","Content-Type, X-Opai-Music");x.getResponseHeaders().set("Access-Control-Allow-Methods","GET, POST, OPTIONS");respond(x,204,null);return;}
        if(!token.equals(x.getRequestHeaders().getFirst("X-Opai-Music"))){respond(x,401,Map.of("error","Music bridge authorization required"));return;}
        try{
            String path=x.getRequestURI().getPath();JsonObject body=new JsonObject();
            if(x.getRequestMethod().equals("POST")){byte[] raw=x.getRequestBody().readNBytes(512*1024+1);if(raw.length>512*1024)throw new IllegalArgumentException("Request too large");body=JsonParser.parseString(new String(raw,StandardCharsets.UTF_8)).getAsJsonObject();}
            else if(!x.getRequestMethod().equals("GET"))throw new IllegalArgumentException("Unsupported method");
            Object result=switch(path){
                case "/state" -> state();
                case "/settings" -> settings(body);
                case "/search" -> search(text(body,"keyword"),Math.max(1,number(body,"page",1)));
                case "/qr/new" -> newQr();
                case "/qr/check" -> checkQr(text(body,"key"));
                case "/logout" -> logout();
                case "/playlists" -> playlists();
                case "/playlist" -> playlist(text(body,"id"));
                case "/play" -> play(body);
                case "/transport" -> transport(body);
                case "/lyrics" -> lyrics();
                case "/favorites" -> favoriteList();
                case "/favorite" -> favorite(body);
                case "/spectrum" -> spectrum();
                default -> throw new IllegalArgumentException("Unknown music endpoint");
            };respond(x,200,result);
        }catch(Limit e){respond(x,429,Map.of("error",e.getMessage()));}
        catch(Exception e){failureType=e.getClass().getSimpleName();String message=e instanceof IllegalArgumentException?e.getMessage():e instanceof java.net.http.HttpTimeoutException?"连接音乐服务超时，请检查网络后重试。":"音乐服务请求失败，请稍后重试。";respond(x,400,Map.of("error",message==null?"请求失败":message));}
    }
    private static void respond(HttpExchange x,int status,Object value)throws IOException{
        x.getResponseHeaders().set("Content-Type","application/json; charset=utf-8");x.getResponseHeaders().set("Cache-Control","no-store");
        byte[] data=JSON.toJson(value).getBytes(StandardCharsets.UTF_8);x.sendResponseHeaders(status,status==204?-1:data.length);if(status!=204)x.getResponseBody().write(data);x.close();
    }
    private synchronized JsonObject state(){
        JsonObject s=new JsonObject();s.addProperty("provider",provider);s.addProperty("source",source);s.addProperty("volume",volume);s.addProperty("repeatOne",repeatOne);s.addProperty("loggedIn",userId>0);s.addProperty("profile",profile);
        s.addProperty("loading",loading);s.addProperty("playing",player!=null&&player.playing());s.addProperty("position",player==null?0:player.position());s.addProperty("error",error);s.addProperty("index",index);s.addProperty("queueLength",queue.size());s.add("track",track==null?JsonNull.INSTANCE:track.deepCopy());s.addProperty("moduleEnabled",moduleEnabled);s.addProperty("lyricsMode",lyricsMode);s.addProperty("openSequence",openSequence);s.addProperty("openedAt",openedAt);s.add("widgets",widgets.deepCopy());s.add("favoriteKeys",JSON.toJsonTree(favorites.stream().map(MusicService::trackKey).toList()));return s;
    }
    private synchronized JsonObject settings(JsonObject b)throws Exception{
        if(b.has("provider")){String next=text(b,"provider");if(!Set.of("netease","gd").contains(next))throw new IllegalArgumentException("请选择登录方式");if(!provider.equals(next)){stop();provider=next;qrKey="";}}
        if(b.has("source")){String next=text(b,"source");if(!Set.of("netease","joox","bilibili").contains(next))throw new IllegalArgumentException("不支持的音乐源");source=next;}
        if(b.has("volume")){double next=b.get("volume").getAsDouble();if(!Double.isFinite(next))throw new IllegalArgumentException("无效音量");volume=Math.max(0,Math.min(1,next));if(player!=null)player.volume((float)volume);}
        if(b.has("repeatOne"))repeatOne=b.get("repeatOne").getAsBoolean();
        if(b.has("widgets")&&b.get("widgets").isJsonObject())for(var entry:b.getAsJsonObject("widgets").entrySet())if(widgets.has(entry.getKey())&&entry.getValue().isJsonPrimitive()&&entry.getValue().getAsJsonPrimitive().isBoolean())widgets.add(entry.getKey(),entry.getValue());
        saveSettings();return state();
    }
    private synchronized void stop(){generation.incrementAndGet();dango.reset();lyricPending="";if(player!=null)player.close();player=null;loading=false;track=null;queue=List.of();index=-1;error="";}
    private synchronized void readSettings(){try{JsonObject o=JsonParser.parseString(Files.readString(directory.resolve("settings.json"))).getAsJsonObject();provider=text(o,"provider");if(!Set.of("netease","gd").contains(provider))provider="";source=text(o,"source");if(!Set.of("netease","joox","bilibili").contains(source))source="netease";volume=Math.max(0,Math.min(1,o.get("volume").getAsDouble()));repeatOne=o.get("repeatOne").getAsBoolean();profile=text(o,"profile");userId=o.has("userId")?o.get("userId").getAsLong():0;if(o.has("cookies"))o.getAsJsonObject("cookies").entrySet().forEach(e->cookies.put(e.getKey(),e.getValue().getAsString()));if(o.has("widgets"))for(var e:o.getAsJsonObject("widgets").entrySet())if(widgets.has(e.getKey())&&e.getValue().isJsonPrimitive()&&e.getValue().getAsJsonPrimitive().isBoolean())widgets.add(e.getKey(),e.getValue());}catch(Exception ignored){}}
    private synchronized void saveSettings()throws IOException{
        Path temp=directory.resolve("settings.tmp");Files.writeString(temp,JSON.toJson(Map.of("provider",provider,"source",source,"volume",volume,"repeatOne",repeatOne,"profile",profile,"userId",userId,"cookies",cookies,"widgets",widgets)));
        try{Files.setPosixFilePermissions(temp,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));}catch(UnsupportedOperationException ignored){}
        try{Files.move(temp,directory.resolve("settings.json"),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}catch(AtomicMoveNotSupportedException e){Files.move(temp,directory.resolve("settings.json"),StandardCopyOption.REPLACE_EXISTING);}
    }
    static String trackKey(JsonObject t){return text(t,"provider")+":"+text(t,"source")+":"+text(t,"id");}
    private synchronized void readFavorites(){try{for(JsonElement v:JsonParser.parseString(Files.readString(directory.resolve("favorites.json"))).getAsJsonArray())if(favorites.size()<3000&&v.isJsonObject())favorites.add(v.getAsJsonObject());}catch(Exception ignored){}}
    private synchronized List<JsonObject> favoriteList(){return favorites.stream().filter(t->provider.equals(text(t,"provider"))).map(JsonObject::deepCopy).toList();}
    private synchronized JsonObject favorite(JsonObject b)throws IOException{
        JsonObject t=b.getAsJsonObject("track");if(t==null||text(t,"id").isBlank()||text(t,"id").length()>128||!Set.of("netease","gd").contains(text(t,"provider")))throw new IllegalArgumentException("无效收藏曲目");
        String key=trackKey(t);List<JsonObject> next=new ArrayList<>(favorites);next.removeIf(v->trackKey(v).equals(key));
        if(b.has("liked")&&b.get("liked").getAsBoolean()){if(next.size()>=3000)throw new IllegalArgumentException("本地收藏已满");JsonObject saved=t.deepCopy();saved.remove("url");next.add(0,saved);}
        Path temp=directory.resolve("favorites.tmp");Files.writeString(temp,JSON.toJson(next));try{Files.move(temp,directory.resolve("favorites.json"),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}catch(AtomicMoveNotSupportedException e){Files.move(temp,directory.resolve("favorites.json"),StandardCopyOption.REPLACE_EXISTING);}
        favorites.clear();favorites.addAll(next);return state();
    }
    private JsonObject spectrum(){Output p=player;return obj(Map.of("bands",p==null?new double[32]:p.spectrum(),"playing",p!=null&&p.playing()));}
    private JsonElement gd(String type,String source,Map<String,String> args,long ttl)throws Exception{
        String key=type+":"+source+":"+JSON.toJson(args);long now=System.currentTimeMillis();
        synchronized(this){Cache old=cache.get(key);if(old!=null&&old.until>now)return old.value.deepCopy();
            while(!gdRequests.isEmpty()&&now-gdRequests.peekFirst()>=300_000)gdRequests.removeFirst();
            if(gdRequests.size()>=48)throw new Limit("GD音乐台请求较频繁，请五分钟窗口结束后重试。");gdRequests.addLast(now);}
        Map<String,String> query=new LinkedHashMap<>(args);query.put("types",type);query.put("source",source);
        HttpResponse<String> r=HTTP.send(HttpRequest.newBuilder(URI.create(gd+"?"+form(query))).timeout(Duration.ofSeconds(25)).header("User-Agent",UA).GET().build(),HttpResponse.BodyHandlers.ofString());
        if(r.statusCode()==429)throw new Limit("GD音乐台暂时限流，请稍后重试。");if(r.statusCode()!=200)throw new IOException("GD HTTP error");JsonElement value=JsonParser.parseString(r.body());if(!value.isJsonArray()&&!value.isJsonObject())throw new IOException("Invalid GD response");
        synchronized(this){if(cache.size()>256)cache.remove(cache.keySet().iterator().next());cache.put(key,new Cache(now+ttl,value.deepCopy()));}return value;
    }
    private JsonObject ncm(String path,Map<String,Object> args,boolean web)throws Exception{
        Map<String,Object> data=new LinkedHashMap<>(args);Map<String,String> auth;
        synchronized(this){cookies.putIfAbsent("deviceId",UUID.randomUUID().toString());cookies.putIfAbsent("__remember_me","true");cookies.putIfAbsent("_ntes_nuid",UUID.randomUUID().toString().replace("-",""));auth=new LinkedHashMap<>(cookies);}
        auth.putIfAbsent("os","pc");auth.putIfAbsent("appver","3.1.37.205354");auth.putIfAbsent("osver","Microsoft-Windows-11-Professional-build-26200-64bit");auth.putIfAbsent("channel","netease");
        Map<String,String> header=new LinkedHashMap<>();for(String k:List.of("os","appver","deviceId","osver"))header.put(k,auth.get(k));header.put("requestId",System.currentTimeMillis()+"_"+ThreadLocalRandom.current().nextInt(10000));
        data.put("header",JSON.toJson(header));data.put("e_r",true);
        Map<String,String> params;
        if(web){data.put("csrf_token",auth.getOrDefault("__csrf",""));params=weapi(data);}else params=Map.of("params",eapi(path,data));
        URI officialBase=web&&netease.getHost().equals("interfacepc.music.163.com")?URI.create("https://music.163.com"):netease;
        URI uri=officialBase.resolve((web?"/weapi/":"/eapi/")+path.substring(5));
        String cookie=String.join("; ",auth.entrySet().stream().map(e->e.getKey()+"="+e.getValue()).toList());
        HttpResponse<byte[]> r=HTTP.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(25)).header("Content-Type","application/x-www-form-urlencoded").header("User-Agent",web?UA:"Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.1.37.205354").header("Referer","https://music.163.com/").header("Cookie",cookie).POST(HttpRequest.BodyPublishers.ofString(form(params))).build(),HttpResponse.BodyHandlers.ofByteArray());
        if(r.statusCode()!=200)throw new IllegalArgumentException("网易云接口返回 HTTP "+r.statusCode());
        synchronized(this){for(String c:r.headers().allValues("set-cookie")){String[] p=c.split(";",2)[0].split("=",2);if(p.length==2)cookies.put(p[0].trim(),p[1].trim());}}
        byte[] bytes=r.body();if(bytes.length>2&&(bytes[0]&255)==31&&(bytes[1]&255)==139)try(var gzip=new java.util.zip.GZIPInputStream(new ByteArrayInputStream(bytes))){bytes=gzip.readAllBytes();}
        String response=new String(bytes,StandardCharsets.UTF_8);
        if(!web&&!response.stripLeading().startsWith("{")){Cipher c=Cipher.getInstance("AES/ECB/PKCS5Padding");c.init(Cipher.DECRYPT_MODE,new SecretKeySpec("e82ckenh8dichen8".getBytes(StandardCharsets.UTF_8),"AES"));response=new String(c.doFinal(bytes),StandardCharsets.UTF_8);}
        JsonObject value=JsonParser.parseString(response).getAsJsonObject();int code=number(value,"code",200);if(!Set.of(200,800,801,802,803).contains(code))throw new IllegalArgumentException(code==301?"网易云登录已过期，请重新扫码。":"网易云请求失败（"+code+"）");return value;
    }
    static String eapi(String path,Map<String,Object> data)throws Exception{
        String json=JSON.toJson(data),digest=HexFormat.of().formatHex(MessageDigest.getInstance("MD5").digest(("nobody"+path+"use"+json+"md5forencrypt").getBytes(StandardCharsets.UTF_8)));
        return HexFormat.of().withUpperCase().formatHex(aes(path+"-36cd479b6b5-"+json+"-36cd479b6b5-"+digest,"e82ckenh8dichen8",false));
    }
    static byte[] aes(String value,String key,boolean cbc)throws Exception{Cipher c=Cipher.getInstance(cbc?"AES/CBC/PKCS5Padding":"AES/ECB/PKCS5Padding");SecretKeySpec k=new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8),"AES");if(cbc)c.init(Cipher.ENCRYPT_MODE,k,new IvParameterSpec("0102030405060708".getBytes(StandardCharsets.UTF_8)));else c.init(Cipher.ENCRYPT_MODE,k);return c.doFinal(value.getBytes(StandardCharsets.UTF_8));}
    static Map<String,String> weapi(Map<String,Object> data)throws Exception{
        String secret=UUID.randomUUID().toString().replace("-","").substring(0,16);
        String first=Base64.getEncoder().encodeToString(aes(JSON.toJson(data),"0CoJUm6Qyw8W8jud",true)),params=Base64.getEncoder().encodeToString(aes(first,secret,true));
        String pub="MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB";
        Cipher rsa=Cipher.getInstance("RSA/ECB/NoPadding");rsa.init(Cipher.ENCRYPT_MODE,KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(pub))));
        return Map.of("params",params,"encSecKey",HexFormat.of().formatHex(rsa.doFinal(new StringBuilder(secret).reverse().toString().getBytes(StandardCharsets.UTF_8))));
    }
    private JsonObject newQr()throws Exception{JsonObject r=ncm("/api/login/qrcode/unikey",Map.of("type",3),false);JsonObject data=r.has("data")&&r.get("data").isJsonObject()?r.getAsJsonObject("data"):r;qrKey=text(data,"unikey");if(qrKey.isBlank())throw new IllegalArgumentException("网易云未返回二维码标识，请稍后重试。");qrAt=System.currentTimeMillis();return obj(Map.of("key",qrKey,"url","https://music.163.com/login?codekey="+URLEncoder.encode(qrKey,StandardCharsets.UTF_8)));}
    private JsonObject checkQr(String key)throws Exception{
        if(!key.equals(qrKey)||System.currentTimeMillis()-qrAt>180_000) return obj(Map.of("code",800));
        JsonObject r=ncm("/api/login/qrcode/client/login",Map.of("key",key,"type",3),false);int code=number(r,"code",0);
        if(code==803){JsonObject account=ncm("/api/w/nuser/account/get",Map.of(),true);JsonObject p=account.getAsJsonObject("profile");if(p==null)throw new IllegalArgumentException("登录状态未就绪，请重新扫码。");synchronized(this){userId=p.get("userId").getAsLong();profile=text(p,"nickname");saveSettings();}qrKey="";}
        return obj(Map.of("code",code));
    }
    private synchronized JsonObject logout()throws IOException{cookies.clear();profile="";userId=0;qrKey="";if(provider.equals("netease"))stop();saveSettings();return state();}
    private List<JsonObject> search(String keyword,int page)throws Exception{
        if(keyword.isBlank()||keyword.length()>160)throw new IllegalArgumentException("请输入 1–160 字的搜索内容");
        if(provider.equals("gd")){JsonElement v=gd("search",source,Map.of("name",keyword,"count","20","pages",String.valueOf(page)),300_000);return normalize(v.isJsonArray()?v.getAsJsonArray():new JsonArray(),true);}
        if(!provider.equals("netease"))throw new IllegalArgumentException("请先选择登录方式");
        JsonObject v=ncm("/api/cloudsearch/pc",Map.of("s",keyword,"type",1,"limit",20,"offset",(page-1)*20,"total",true),false);JsonObject r=v.getAsJsonObject("result");return normalize(r!=null&&r.has("songs")?r.getAsJsonArray("songs"):new JsonArray(),false);
    }
    private List<JsonObject> normalize(JsonArray rows,boolean gd){
        List<JsonObject> result=new ArrayList<>();for(JsonElement row:rows){try{JsonObject r=row.getAsJsonObject(),t=new JsonObject();t.addProperty("id",text(r,"id"));t.addProperty("name",text(r,"name"));t.addProperty("provider",gd?"gd":"netease");t.addProperty("source",gd?text(r,"source"):"netease");
            JsonArray artists=new JsonArray();if(gd){if(r.has("artist")&&r.get("artist").isJsonArray())artists=r.getAsJsonArray("artist");t.addProperty("album",text(r,"album"));t.addProperty("picId",text(r,"pic_id"));t.addProperty("lyricId",text(r,"lyric_id"));t.addProperty("duration",0);t.addProperty("cover","");}
            else{JsonArray a=r.has("ar")?r.getAsJsonArray("ar"):r.has("artists")?r.getAsJsonArray("artists"):new JsonArray();for(JsonElement item:a)artists.add(text(item.getAsJsonObject(),"name"));JsonObject album=r.has("al")?r.getAsJsonObject("al"):r.has("album")?r.getAsJsonObject("album"):new JsonObject();t.addProperty("album",text(album,"name"));t.addProperty("cover",text(album,"picUrl").replace("http://","https://"));t.addProperty("duration",number(r,r.has("dt")?"dt":"duration",0));}
            t.add("artists",artists);result.add(t);
        }catch(Exception ignored){}}return result;
    }
    private JsonArray playlists()throws Exception{if(userId<=0)throw new IllegalArgumentException("请先用网易云 App 扫码登录");return ncm("/api/user/playlist",Map.of("uid",userId,"limit",100,"offset",0,"includeVideo",true),true).getAsJsonArray("playlist");}
    private List<JsonObject> playlist(String id)throws Exception{
        if(!id.matches("[0-9]{1,20}"))throw new IllegalArgumentException("无效歌单");JsonObject p=ncm("/api/v6/playlist/detail",Map.of("id",id,"n",1000,"s",0),false).getAsJsonObject("playlist");
        if(p==null)return List.of();JsonArray tracks=p.has("tracks")?p.getAsJsonArray("tracks"):new JsonArray();
        if(p.has("trackIds")&&p.getAsJsonArray("trackIds").size()>tracks.size()){JsonArray all=new JsonArray(),ids=p.getAsJsonArray("trackIds");for(int i=0;i<Math.min(1000,ids.size());i+=200){JsonArray part=new JsonArray();for(int j=i;j<Math.min(i+200,Math.min(1000,ids.size()));j++)part.add(ids.get(j));JsonObject r=ncm("/api/v3/song/detail",Map.of("c",JSON.toJson(part)),true);if(r.has("songs"))all.addAll(r.getAsJsonArray("songs"));}tracks=all;}
        return normalize(tracks,false);
    }
    private synchronized JsonObject play(JsonObject b){
        JsonArray rows=b.getAsJsonArray("tracks");if(rows==null||rows.isEmpty()||rows.size()>1000)throw new IllegalArgumentException("播放列表为空或过长");
        List<JsonObject> next=new ArrayList<>();for(JsonElement e:rows){JsonObject t=e.getAsJsonObject().deepCopy();String id=text(t,"id");if(id.isBlank()||id.length()>128||!provider.equals(text(t,"provider")))throw new IllegalArgumentException("曲目来源与当前模式不一致");t.remove("url");next.add(t);}
        queue=List.copyOf(next);int at=number(b,"index",0);if(at<0||at>=queue.size())throw new IllegalArgumentException("无效曲目位置");load(at);return state();
    }
    private synchronized void load(int at){
        long job=generation.incrementAndGet();if(player!=null)player.close();player=null;index=at;track=queue.get(at).deepCopy();loading=true;error="";JsonObject current=track.deepCopy();
        workers.submit(()->{try{
            JsonObject media;String id=text(current,"id"),src=text(current,"source");
            if(text(current,"provider").equals("gd"))media=gd("url",src,Map.of("id",id,"br","320"),120_000).getAsJsonObject();
            else{JsonObject r=ncm("/api/song/enhance/player/url/v1",Map.of("ids","["+id+"]","level","standard","encodeType","mp3"),false);media=r.getAsJsonArray("data").get(0).getAsJsonObject();}
            String url=text(media,"url");if(url.isBlank())throw new IllegalArgumentException("该来源暂未提供可播放音源，或当前账号无播放权限。");
            String type=text(media,"type").toLowerCase(Locale.ROOT);if(type.isEmpty())type=url.toLowerCase(Locale.ROOT).contains(".flac")?"flac":url.toLowerCase(Locale.ROOT).matches(".*\\.(m4a|m4s|aac)([?].*)?")?"aac":"mp3";
            if(type.equals("aac")||type.equals("m4a"))throw new IllegalArgumentException("该音源为 AAC 格式，当前播放器支持 MP3、FLAC 和 WAV，请换用网易云音乐源。");
            final String format=type;
            synchronized(this){if(closed||job!=generation.get())return;player=factory.create(url,format,Math.max(0,number(current,"duration",0)),()->ended(job),()->failed(job));player.volume((float)volume);player.play();loading=false;}
            if(text(current,"provider").equals("gd")&&!text(current,"picId").isBlank()){try{JsonObject cover=gd("pic",src,Map.of("id",text(current,"picId"),"size","300"),86_400_000).getAsJsonObject();synchronized(this){if(job==generation.get())track.addProperty("cover",text(cover,"url"));}}catch(Exception ignored){}}
        }catch(Exception e){synchronized(this){if(job==generation.get()){loading=false;error=e instanceof IllegalArgumentException||e instanceof Limit?e.getMessage():"无法载入音源，请检查网络后重试。";}}}});
    }
    private synchronized void ended(long job){if(closed||job!=generation.get())return;if(repeatOne)load(index);else if(index+1<queue.size())load(index+1);else if(player!=null)player.pause();}
    private synchronized void failed(long job){if(job==generation.get()){loading=false;if(player!=null)player.pause();error="音频解码或输出失败，请检查设备或切换音源。";}}
    private synchronized JsonObject transport(JsonObject b){switch(text(b,"action")){
        case "stop"->{stop();}case "pause"->{if(player!=null)player.pause();}case "resume"->{if(player!=null)player.play();else if(index>=0)load(index);}
        case "next"->{if(!queue.isEmpty())load((index+1)%queue.size());}case "previous"->{if(!queue.isEmpty())load((index-1+queue.size())%queue.size());}
        case "seek"->{if(player!=null){long position=Math.max(0,b.get("position").getAsLong());player.seek(position);}}
        default->throw new IllegalArgumentException("无效播放操作");}return state();}
    private JsonObject lyrics()throws Exception{return lyrics(track);}
    private JsonObject lyrics(JsonObject current)throws Exception{
        if(current==null)return obj(Map.of("lyric","","tlyric",""));synchronized(lyricLocks.computeIfAbsent(trackKey(current),k->new Object())){return fetchLyrics(current);}
    }
    private JsonObject fetchLyrics(JsonObject current)throws Exception{
        if(current==null)return obj(Map.of("lyric","","tlyric",""));String id=text(current,"id");
        if(text(current,"provider").equals("gd")){String lyric=text(current,"lyricId");return gd("lyric",text(current,"source"),Map.of("id",lyric.isEmpty()?id:lyric),3_600_000).getAsJsonObject();}
        String key="ncm-lyric:"+id; synchronized(this){Cache c=cache.get(key);if(c!=null&&c.until>System.currentTimeMillis())return c.value.getAsJsonObject().deepCopy();}
        JsonObject r=ncm("/api/song/lyric/v1",Map.of("id",id,"cp",false,"lv",0,"tv",0,"rv",0,"yv",0,"kv",0,"ytv",0,"yrv",0),false),v=obj(Map.of("lyric",r.has("lrc")?text(r.getAsJsonObject("lrc"),"lyric"):"","tlyric",r.has("tlyric")?text(r.getAsJsonObject("tlyric"),"lyric"):"","yrc",r.has("yrc")?text(r.getAsJsonObject("yrc"),"lyric"):""));synchronized(this){cache.put(key,new Cache(System.currentTimeMillis()+3_600_000,v.deepCopy()));}return v;
    }
    private static String form(Map<String,String> data){return String.join("&",data.entrySet().stream().map(e->URLEncoder.encode(e.getKey(),StandardCharsets.UTF_8)+"="+URLEncoder.encode(e.getValue(),StandardCharsets.UTF_8)).toList());}
    static JsonObject obj(Object o){return JSON.toJsonTree(o).getAsJsonObject();}
    static String text(JsonObject o,String k){return o!=null&&o.has(k)&&!o.get(k).isJsonNull()?o.get(k).getAsString():"";}
    static int number(JsonObject o,String k,int fallback){try{return o.get(k).getAsInt();}catch(Exception e){return fallback;}}
    static final class Limit extends Exception{Limit(String m){super(m);}}
    public synchronized void close(){closed=true;stop();server.stop(0);workers.shutdownNow();}
}
