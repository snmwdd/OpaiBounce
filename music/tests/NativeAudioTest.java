package opai.music;

import com.google.gson.*;
import com.sun.net.httpserver.*;
import javax.sound.sampled.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Decode self-generated silence through the actual Java audio device at zero volume. */
public class NativeAudioTest {
    public static void main(String[] args)throws Exception{
        AudioFormat format=new AudioFormat(44100,16,2,true,false);
        StreamingSoundPlayer gain=new StreamingSoundPlayer(new java.io.File("not-opened.wav"),1000,(b,o,n,f)->{});
        var scale=StreamingSoundPlayer.class.getDeclaredMethod("scalePcm",byte[].class,int.class,int.class,AudioFormat.class);scale.setAccessible(true);
        gain.setVolume(.5f);byte[] samples={0,(byte)128,0,64};scale.invoke(gain,samples,0,4,format);if(!Arrays.equals(samples,new byte[]{0,(byte)192,0,32}))throw new AssertionError("PCM half-volume gain failed");
        gain.setVolume(0);scale.invoke(gain,samples,0,4,format);if(!Arrays.equals(samples,new byte[4]))throw new AssertionError("PCM mute failed");
        if(!AudioSystem.isLineSupported(new DataLine.Info(SourceDataLine.class,format))){System.out.println("{\"native_audio_tested\":false,\"reason\":\"No Java sound device\"}");return;}
        for(String codec:List.of("mp3","flac","wav"))run(codec);
    }
    static void run(String codec)throws Exception{
        byte[] mp3;
        if(codec.equals("wav")){byte[] pcm=new byte[44100*4*2];for(int i=0;i<pcm.length/4;i++){int n=(int)(18000*Math.sin(2*Math.PI*1000*i/44100));for(int c=0;c<2;c++){pcm[i*4+c*2]=(byte)n;pcm[i*4+c*2+1]=(byte)(n>>8);}}java.io.ByteArrayOutputStream wave=new java.io.ByteArrayOutputStream();AudioSystem.write(new AudioInputStream(new java.io.ByteArrayInputStream(pcm),new AudioFormat(44100,16,2,true,false),pcm.length/4),AudioFileFormat.Type.WAVE,wave);mp3=wave.toByteArray();}else mp3=Files.readAllBytes(Path.of("tests/fixtures/silence."+codec));HttpServer host=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);String base="http://127.0.0.1:"+host.getAddress().getPort();
        host.createContext("/",x->{byte[] bytes;if(x.getRequestURI().getPath().endsWith("."+codec)){bytes=mp3;x.getResponseHeaders().set("Content-Type","audio/mpeg");}else{String query=x.getRequestURI().getRawQuery();Object response=query!=null&&query.contains("types=pic")?Map.of("url",""):Map.of("url",base+"/silence."+codec,"type",codec);bytes=MusicService.JSON.toJson(response).getBytes(StandardCharsets.UTF_8);}x.sendResponseHeaders(200,bytes.length);x.getResponseBody().write(bytes);x.close();});host.start();
        try(MusicService service=new MusicService(Files.createTempDirectory("opai-audio-test-"),URI.create(base),URI.create(base+"/gd"),null)){
            JsonObject d=MusicServiceTest.descriptor(service);MusicServiceTest.call(d,"/settings",Map.of("provider","gd","volume",0));
            Map<String,Object> track=Map.of("id","silence","name","Self-generated silence","artists",List.of("test"),"provider","gd","source","netease","duration",codec.equals("wav")?2000:600);
            MusicServiceTest.call(d,"/play",Map.of("tracks",List.of(track),"index",0));
            MusicServiceTest.await(()->{JsonObject s=MusicServiceTest.obj(MusicServiceTest.call(d,"/state",null));return s.get("position").getAsLong()>0||!s.get("error").getAsString().isEmpty();});
            if(codec.equals("wav"))MusicServiceTest.await(()->{for(JsonElement v:MusicServiceTest.obj(MusicServiceTest.call(d,"/spectrum",null)).getAsJsonArray("bands"))if(v.getAsDouble()>.2)return true;return false;});
            JsonObject state=MusicServiceTest.obj(MusicServiceTest.call(d,"/state",null));if(!state.get("error").getAsString().isEmpty())throw new AssertionError("Native MP3 decode/output failed");
            if(state.get("position").getAsLong()<=0)throw new AssertionError("Audio clock did not advance");
            System.out.println("{\"native_audio_tested\":true,\"pcm_gain_verified\":true,\"codec\":\""+codec+"\",\"fixture\":\"self-generated zero-volume PCM\",\"volume\":0,\"clock_advanced\":true,\"spectrum_from_decoded_pcm\":"+codec.equals("wav")+",\"platform\":\""+System.getProperty("os.name")+"\"}");
        }finally{host.stop(0);}
    }
}
