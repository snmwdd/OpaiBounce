package opai.music;

import com.google.gson.*;
import com.sun.net.httpserver.*;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public class MusicServiceTest {
    static final Gson J=new Gson();static final HttpClient H=HttpClient.newHttpClient();static int checks;
    static void check(boolean ok,String name){if(!ok)throw new AssertionError(name);checks++;}
    static JsonObject descriptor(MusicService service){return JsonParser.parseString(service.descriptor()).getAsJsonObject();}
    static HttpResponse<String> call(JsonObject d,String path,Object body)throws Exception{return call(d,path,body,true,null);}
    static HttpResponse<String> call(JsonObject d,String path,Object body,boolean auth,String origin)throws Exception{
        HttpRequest.Builder b=HttpRequest.newBuilder(URI.create(d.get("url").getAsString()+path));if(auth)b.header("X-Opai-Music",d.get("token").getAsString());if(origin!=null)b.header("Origin",origin);
        return H.send(body==null?b.GET().build():b.header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(J.toJson(body))).build(),HttpResponse.BodyHandlers.ofString());
    }
    static JsonObject obj(HttpResponse<String> r){return JsonParser.parseString(r.body()).getAsJsonObject();}
    static Map<String,String> query(String value){Map<String,String> out=new HashMap<>();for(String p:value.split("&")){String[] pair=p.split("=",2);out.put(URLDecoder.decode(pair[0],StandardCharsets.UTF_8),pair.length==2?URLDecoder.decode(pair[1],StandardCharsets.UTF_8):"");}return out;}
    static void await(Callable<Boolean> done)throws Exception{long until=System.currentTimeMillis()+4000;while(!done.call()){if(System.currentTimeMillis()>until)throw new AssertionError("Timeout");Thread.sleep(10);}}
    static class Fake implements MusicService.Output{boolean playing;float volume;long position=1250;Runnable end;public void play(){playing=true;}public void pause(){playing=false;}public void seek(long ms){position=ms;}public void close(){playing=false;}public void volume(float v){volume=v;}public boolean playing(){return playing;}public long position(){return position;}}
    public static void main(String[] args)throws Exception{
        if(args.length>0&&args[0].equals("--live")){live();return;}
        AtomicInteger gdCalls=new AtomicInteger(),urlCalls=new AtomicInteger(),lyricsCalls=new AtomicInteger(),outputs=new AtomicInteger();AtomicReference<Fake> last=new AtomicReference<>();AtomicReference<String> fixtureError=new AtomicReference<>();
        HttpServer fixture=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);fixture.setExecutor(Executors.newCachedThreadPool(r->{Thread t=new Thread(r);t.setDaemon(true);return t;}));
        fixture.createContext("/",x->{Object response=Map.of();try{
            String path=x.getRequestURI().getPath();
            if(path.equals("/gd")){gdCalls.incrementAndGet();Map<String,String> q=query(x.getRequestURI().getRawQuery());String type=q.get("types");
                response=switch(type){case "search"->{if(q.get("name").equals("slow"))Thread.sleep(400);yield List.of(Map.of("id","123","name","Fixture Song","artist",List.of("Artist"),"album","Test","pic_id","123","lyric_id","123","source",q.get("source")));}
                    case "url"->{urlCalls.incrementAndGet();yield Map.of("url","https://audio.example.test/fixture.mp3","br",320,"size",1000);}
                    case "pic"->Map.of("url","https://images.example.test/cover.jpg");case "lyric"->{lyricsCalls.incrementAndGet();yield Map.of("lyric","[00:00.00]First\n[00:01.00]Second","tlyric","");}default->throw new AssertionError("GD type");};
            }else{
                Map<String,String> form=query(new String(x.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
                if(path.startsWith("/eapi/")){
                    Cipher c=Cipher.getInstance("AES/ECB/PKCS5Padding");c.init(Cipher.DECRYPT_MODE,new SecretKeySpec("e82ckenh8dichen8".getBytes(StandardCharsets.UTF_8),"AES"));String plain=new String(c.doFinal(HexFormat.of().parseHex(form.get("params"))),StandardCharsets.UTF_8);String[] p=plain.split("-36cd479b6b5-");
                    check(p[0].equals(path.replace("/eapi/","/api/")),"EAPI path matches ciphertext");JsonObject data=JsonParser.parseString(p[1]).getAsJsonObject();check(data.get("e_r").getAsBoolean(),"upstream encrypted response supported");
                }else check(form.get("encSecKey").length()==256,"WEAPI RSA key length");
                if(path.endsWith("/qrcode/unikey"))response=Map.of("code",200,"data",Map.of("unikey","fixture-key"));
                else if(path.endsWith("/qrcode/client/login")){x.getResponseHeaders().add("Set-Cookie","MUSIC_U=fixture-only; Path=/; HttpOnly");response=Map.of("code",803);}
                else if(path.endsWith("/account/get")){check(x.getRequestHeaders().getFirst("Cookie").contains("MUSIC_U=fixture-only"),"login cookie retained only server-side");response=Map.of("code",200,"profile",Map.of("userId",123,"nickname","Fixture User"));}
                else if(path.endsWith("/cloudsearch/pc"))response=Map.of("code",200,"result",Map.of("songs",List.of(Map.of("id",42,"name","NCM Song","ar",List.of(Map.of("name","Singer")),"al",Map.of("name","Album","picUrl","https://example.test/pic.jpg"),"dt",180000))));
                else if(path.endsWith("/user/playlist"))response=Map.of("code",200,"playlist",List.of(Map.of("id",7,"name","My Playlist","trackCount",1)));
                else response=Map.of("code",200);
            }
        }catch(Throwable e){fixtureError.set(e.toString());response=Map.of("code",500);}
        byte[] bytes=J.toJson(response).getBytes(StandardCharsets.UTF_8);x.sendResponseHeaders(200,bytes.length);x.getResponseBody().write(bytes);x.close();});fixture.start();
        URI base=URI.create("http://127.0.0.1:"+fixture.getAddress().getPort());Path folder=Files.createTempDirectory("opai-music-test-");
        MusicService.OutputFactory factory=(url,type,duration,end,fail)->{outputs.incrementAndGet();Fake f=new Fake();f.end=end;last.set(f);return f;};
        try(MusicService service=new MusicService(folder,base,base.resolve("/gd"),factory)){
            JsonObject d=descriptor(service);
            check(call(d,"/state",null,false,null).statusCode()==401,"unauthorized requests blocked");check(call(d,"/state",null,true,"https://untrusted.example").statusCode()==403,"external origins blocked");
            check(call(d,"/state",null,true,"http://localhost:4173").statusCode()==200,"CEF loopback origin allowed");
            check(obj(call(d,"/state",null)).get("provider").getAsString().isEmpty(),"first launch requires provider choice");
            check(call(d,"/settings",Map.of("provider","gd","volume",.42,"repeatOne",true)).statusCode()==200,"provider and player preferences save");
            check(JsonParser.parseString(call(d,"/search",Map.of("keyword","demo","page",1)).body()).getAsJsonArray().size()==1,"GD search normalized");int cached=gdCalls.get();call(d,"/search",Map.of("keyword","demo","page",1));check(cached==gdCalls.get(),"search cache avoids quota requests");
            Map<String,Object> track=Map.of("id","123","name","Fixture Song","artists",List.of("Artist"),"album","Test","provider","gd","source","netease","picId","123","lyricId","123","duration",180000);
            call(d,"/settings",Map.of("widgets",Map.of("island",false,"translation",false)));check(!obj(call(d,"/state",null)).getAsJsonObject("widgets").get("island").getAsBoolean(),"island visibility saves independently");
            call(d,"/favorite",Map.of("track",track,"liked",true));call(d,"/favorite",Map.of("track",track,"liked",true));check(JsonParser.parseString(call(d,"/favorites",null).body()).getAsJsonArray().size()==1,"favorites deduplicated");
            check(obj(call(d,"/state",null)).getAsJsonArray("favoriteKeys").get(0).getAsString().equals("gd:netease:123"),"favorite key matches UI");
            call(d,"/favorite",Map.of("track",track,"liked",false));check(JsonParser.parseString(call(d,"/favorites",null).body()).getAsJsonArray().isEmpty(),"remove local favorite");call(d,"/favorite",Map.of("track",track,"liked",true));
            check(obj(call(d,"/spectrum",null)).getAsJsonArray("bands").size()==32,"spectrum transport has 32 real bands");
            call(d,"/play",Map.of("tracks",List.of(track),"index",0));await(()->outputs.get()==1&&!obj(call(d,"/state",null)).get("loading").getAsBoolean());check(last.get().playing&&Math.abs(last.get().volume-.42)<.001,"native output starts with chosen volume");
            call(d,"/transport",Map.of("action","pause"));check(!last.get().playing,"pause");call(d,"/transport",Map.of("action","resume"));check(last.get().playing,"resume");call(d,"/transport",Map.of("action","seek","position",60000));check(last.get().position==60000,"seek");
            call(d,"/lyrics",null);call(d,"/lyrics",null);check(lyricsCalls.get()==1,"lyrics cached");
            last.get().end.run();await(()->outputs.get()==2&&!obj(call(d,"/state",null)).get("loading").getAsBoolean());check(urlCalls.get()==1,"repeat-one reuses stream URL without quota requests");
            call(d,"/settings",Map.of("repeatOne",false));last.get().end.run();check(!obj(call(d,"/state",null)).get("playing").getAsBoolean(),"natural end reports stopped instead of leaving stale playing state");call(d,"/settings",Map.of("repeatOne",true));call(d,"/transport",Map.of("action","resume"));
            service.configureModule(J.toJson(Map.of("enabled",true,"lyricsMode","Dango3D","widgets",Map.of("island",false,"lyrics",true),"distance",10,"scale",1,"spread",0,"wordPop",true,"wiggle",false)));service.openPlayer();check(obj(call(d,"/state",null)).get("openSequence").getAsInt()==1,"native module can request opening the player");
            await(()->!JsonParser.parseString(service.worldLyrics(0,64,0,0,0)).getAsJsonArray().isEmpty());check(obj(call(d,"/state",null)).get("lyricsMode").getAsString().equals("Dango3D"),"native module owns lyric mode and uses cached provider lyrics");
            var slow=CompletableFuture.supplyAsync(()->{try{return call(d,"/search",Map.of("keyword","slow","page",1));}catch(Exception e){throw new RuntimeException(e);}});Thread.sleep(40);long start=System.nanoTime();call(d,"/state",null);check((System.nanoTime()-start)/1_000_000<300,"slow upstream does not lock playback controls");slow.get();
            call(d,"/settings",Map.of("provider","netease"));check(!last.get().playing,"switching provider stops old playback");check(JsonParser.parseString(call(d,"/favorites",null).body()).getAsJsonArray().isEmpty(),"provider favorites remain separate");
            JsonObject qr=obj(call(d,"/qr/new",Map.of()));check(qr.get("url").getAsString().startsWith("https://music.163.com/login?codekey="),"official QR URL");
            check(obj(call(d,"/qr/check",Map.of("key","wrong"))).get("code").getAsInt()==800,"unissued QR keys rejected");
            check(obj(call(d,"/qr/check",Map.of("key",qr.get("key").getAsString()))).get("code").getAsInt()==803,"official QR login flow");
            JsonObject state=obj(call(d,"/state",null));check(state.get("loggedIn").getAsBoolean()&&state.get("profile").getAsString().equals("Fixture User"),"profile persists after QR confirmation");check(!state.toString().contains("fixture-only"),"cookies never returned to theme");
            check(JsonParser.parseString(call(d,"/search",Map.of("keyword","sample","page",1)).body()).getAsJsonArray().get(0).getAsJsonObject().get("duration").getAsInt()==180000,"official search and duration normalization");
            check(JsonParser.parseString(call(d,"/playlists",null).body()).getAsJsonArray().size()==1,"official account playlists");
            call(d,"/settings",Map.of("provider","gd"));int blocked=0;for(int i=0;i<50;i++)if(call(d,"/search",Map.of("keyword","quota"+i,"page",1)).statusCode()==429)blocked++;
            check(blocked>0&&gdCalls.get()<=48,"global five-minute quota shared by all GD operations");
            check(fixtureError.get()==null,"all upstream protocol assertions pass");
        }finally{fixture.stop(0);}
        try(MusicService service=new MusicService(folder,base,base.resolve("/gd"),factory)){JsonObject s=obj(call(descriptor(service),"/state",null));check(!s.getAsJsonObject("widgets").get("island").getAsBoolean()&&!s.getAsJsonObject("widgets").get("translation").getAsBoolean(),"HUD preferences survive restart");check(JsonParser.parseString(call(descriptor(service),"/favorites",null).body()).getAsJsonArray().size()==1,"local favorites survive restart");check(s.get("provider").getAsString().equals("gd")&&s.get("loggedIn").getAsBoolean()&&s.get("repeatOne").getAsBoolean()&&Math.abs(s.get("volume").getAsDouble()-.42)<.001,"provider, official session, volume and loop survive restart");}
        System.out.println("Music service: "+checks+" checks passed; no external login or audible playback used.");
    }
    static void live()throws Exception{
        Path temp=Files.createTempDirectory("opai-music-live-");try(MusicService s=MusicService.start(temp.toString())){
            JsonObject d=descriptor(s);call(d,"/settings",Map.of("provider","netease"));HttpResponse<String> qr=call(d,"/qr/new",Map.of());boolean qrOk=qr.statusCode()==200&&obj(qr).has("key");String failure=s.failureType;
            call(d,"/settings",Map.of("provider","gd"));HttpResponse<String> search=call(d,"/search",Map.of("keyword","Bach","page",1));boolean gdOk=search.statusCode()==200&&JsonParser.parseString(search.body()).isJsonArray();boolean stream=false;
            if(gdOk&&!JsonParser.parseString(search.body()).getAsJsonArray().isEmpty()){
                JsonObject first=JsonParser.parseString(search.body()).getAsJsonArray().get(0).getAsJsonObject();var method=MusicService.class.getDeclaredMethod("gd",String.class,String.class,Map.class,long.class);method.setAccessible(true);
                JsonObject media=((JsonElement)method.invoke(s,"url","netease",Map.of("id",first.get("id").getAsString(),"br","320"),120000L)).getAsJsonObject();stream=media.has("url")&&!media.get("url").isJsonNull()&&!media.get("url").getAsString().isBlank();
            }
            Map<String,Object> report=new LinkedHashMap<>();report.put("official_qr_key_available",qrOk);report.put("gd_search_available",gdOk);report.put("gd_stream_url_available",stream);report.put("official_failure_type",failure);report.put("official_http_status",qr.statusCode());report.put("gd_http_status",search.statusCode());report.put("account_login_tested",false);report.put("audio_downloaded",false);System.out.println(J.toJson(report));
        }
    }
}
