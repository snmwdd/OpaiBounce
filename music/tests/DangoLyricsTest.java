package opai.music;
import java.util.*;
public class DangoLyricsTest{
 static void check(boolean b,String name){if(!b)throw new AssertionError(name);}
 public static void main(String[] args){
  var cues=DangoLyrics.parse("[00:01.0]First line\n[00:03.0]Second line","");check(cues.size()==2&&cues.get(0).time()==1000,"LRC millisecond times");
  var yrc=DangoLyrics.parse("","[1000,1200](1000,400,0)Hello (1500,500,0)world");check(yrc.size()==1&&yrc.get(0).times()[6]==500,"real YRC word timestamps");
  DangoLyrics d=new DangoLyrics();d.timeline("track","[00:01.00]First line\n[00:03.00]Second line","");
  check(d.frame("track",500,true,1000,0,64,0,0,0,10,1,0,true,false).isEmpty(),"no early cue");
  var first=d.frame("track",1500,true,1500,0,64,0,0,0,10,1,0,true,false);check(first.size()==1,"world scene spawns");Map<String,Object> f=first.get(0);double z=(double)f.get("z");check(z>9&&z<=10,"spawn ten blocks ahead");
  var moved=d.frame("track",1800,true,1800,1,64,0,0,0,10,1,0,true,false);check(Math.abs((double)moved.get(0).get("z")-z)<1e-6,"world anchor stays fixed when camera moves");
  check(d.frame("track",3200,true,2000,1,64,0,0,0,10,1,0,true,false).size()==2,"old cue fades beside new cue");
  check(d.frame("track",3500,true,2500,1,64,0,0,0,10,1,0,true,false).size()==1,"fade expires after 400ms");
  check(d.frame("track",3500,false,2600,1,64,0,0,0,10,1,0,true,false).size()==1,"pause starts fade");check(d.frame("track",3500,false,3100,1,64,0,0,0,10,1,0,true,false).isEmpty(),"pause leaves no stale world text");
  check(!d.frame("track",3500,true,3200,1,64,0,0,0,10,1,0,true,false).isEmpty(),"resume reappears");d.reset();check(d.frame("different",4000,true,3500,0,64,0,0,0,10,1,0,true,false).isEmpty(),"track/disconnect reset");
  System.out.println("Dango 3D lyrics: parsing, real word times, world anchor, cue transitions, pause/resume and cleanup passed.");
 }
}
