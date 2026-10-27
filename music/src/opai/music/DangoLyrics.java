/* 3D lyric scene adapted from Sorihiko/DangoMusic, GPL-3.0.
 * Upstream 985d55303b9df9866c41099ee70a772b5a48c4f6, LyricsModule.kt/LyricsProvider.kt.
 * Host-independent port: the bridge submits these glyphs to Minecraft's world text renderer.
 */
package opai.music;
import java.util.*;
import java.util.regex.*;

public final class DangoLyrics {
    record Cue(long time,String text,long[] times){}
    private record Floating(Cue cue,List<String> lines,double x,double y,double z,long revealedAt){}
    private record Fading(Floating value,long since){}
    private List<Cue> cues=List.of();private String key="";private int last=-1;private long lastPosition=-1;
    private Floating active;private final Deque<Fading> fading=new ArrayDeque<>();private final Random random=new Random();
    private static final Pattern LRC=Pattern.compile("\\[(\\d{1,3}):(\\d{1,2})(?:[.:](\\d{1,3}))?]");
    private static final Pattern YRC=Pattern.compile("^\\[(\\d+),(\\d+)](.*)$"),WORD=Pattern.compile("\\((\\d+),(\\d+),\\d+\\)([^(]*)");
    static List<Cue> parse(String lrc,String yrc){
        List<Cue> result=new ArrayList<>();for(String row:yrc.split("\\R")){Matcher m=YRC.matcher(row.trim());if(!m.matches())continue;long start=Long.parseLong(m.group(1));Matcher words=WORD.matcher(m.group(3));StringBuilder text=new StringBuilder();List<Long> times=new ArrayList<>();while(words.find()){String word=words.group(3);text.append(word);word.codePoints().forEach(c->times.add(Math.max(0,Long.parseLong(words.group(1))-start)));}if(!text.isEmpty())result.add(new Cue(start,text.toString(),times.stream().mapToLong(Long::longValue).toArray()));}
        if(result.isEmpty())for(String row:lrc.split("\\R")){Matcher m=LRC.matcher(row);String text=LRC.matcher(row).replaceAll("").trim();if(text.startsWith("作词：")||text.startsWith("作曲：")||text.contains("纯音乐，请欣赏"))continue;while(m.find()){String f=m.group(3);long ms=f==null?0:Long.parseLong((f+"000").substring(0,3));result.add(new Cue(Long.parseLong(m.group(1))*60000+Long.parseLong(m.group(2))*1000+ms,text,new long[0]));}}
        result.sort(Comparator.comparingLong(Cue::time));List<Cue> prepared=new ArrayList<>();for(int i=0;i<Math.min(3000,result.size());i++){Cue c=result.get(i);long duration=i+1<result.size()?result.get(i+1).time-c.time:5000;prepared.add(c.times.length>0?c:new Cue(c.time,c.text,fallbackTimes(c.text,duration)));}return prepared;
    }
    /** Dango fallback: English words / pairs of CJK characters share one pop time. */
    private static long[] fallbackTimes(String text,long duration){
        int[] points=text.codePoints().toArray(),groups=new int[points.length];int tokens=0,current=-1,cjk=0;boolean wasCjk=false;
        for(int i=0;i<points.length;i++){int c=points[i];if(Character.isWhitespace(c)){groups[i]=Math.max(0,current);current=-1;cjk=0;continue;}boolean isCjk=c>=0x2e80;if(current<0||isCjk!=wasCjk||isCjk&&cjk>=2){current=tokens++;cjk=0;}groups[i]=current;if(isCjk)cjk++;wasCjk=isCjk;}
        double span=Math.min(Math.max(300,duration)*.75,tokens*330.0);long[] times=new long[points.length];for(int i=0;i<times.length;i++)times[i]=(long)(span*groups[i]/Math.max(1,tokens));return times;
    }
    public synchronized void timeline(String key,String lrc,String yrc){if(this.key.equals(key))return;reset();this.key=key;cues=parse(lrc,yrc);}
    public synchronized void reset(){active=null;fading.clear();last=-1;lastPosition=-1;}
    private void fade(long now){if(active!=null){fading.addLast(new Fading(active,now));while(fading.size()>3)fading.removeFirst();active=null;}}
    public synchronized List<Map<String,Object>> frame(String track,long position,boolean playing,long now,double cx,double cy,double cz,double yaw,double pitch,double distance,double scale,double spread,boolean wordPop,boolean wiggle){
        if(!track.equals(key)){reset();return List.of();}int index=-1;for(int i=0;i<cues.size();i++){if(cues.get(i).time>position)break;index=i;}
        if(!playing){fade(now);last=-1;}else if(index!=last||lastPosition>=0&&Math.abs(position-lastPosition)>1800){fade(now);last=index;if(index>=0&&!cues.get(index).text.isBlank()){
            Cue cue=cues.get(index);double yr=Math.toRadians(yaw+(random.nextDouble()*2-1)*spread),pr=Math.toRadians(Math.max(-60,Math.min(30,pitch-3-random.nextDouble()*10)));
            active=new Floating(cue,wrap(cue.text),cx-Math.sin(yr)*Math.cos(pr)*distance,cy-Math.sin(pr)*distance,cz+Math.cos(yr)*Math.cos(pr)*distance,now);
        }}lastPosition=position;
        List<Map<String,Object>> out=new ArrayList<>();while(!fading.isEmpty()&&now-fading.peekFirst().since>=400)fading.removeFirst();
        for(Fading f:fading)out.add(draw(f.value,position,now,1-(now-f.since)/400.0,(now-f.since)/1000.0*.4,cx,cy,cz,distance,scale,wordPop,wiggle));
        if(active!=null)out.add(draw(active,position,now,Math.min(1,(now-active.revealedAt)/300.0),0,cx,cy,cz,distance,scale,wordPop,wiggle));return out;
    }
    private Map<String,Object> draw(Floating f,long position,long now,double alpha,double lift,double cx,double cy,double cz,double distance,double scale,boolean wordPop,boolean wiggle){
        double rx=f.x-cx,ry=f.y-cy,rz=f.z-cz,len=Math.sqrt(rx*rx+ry*ry+rz*rz),k=len>1e-4&&len<distance*.6?distance*.6/len:1;
        List<Map<String,Object>> glyphs=new ArrayList<>();int n=0;long next=cues.stream().filter(c->c.time>f.cue.time).findFirst().map(Cue::time).orElse(f.cue.time+5000);long elapsed=Math.max(0,position-f.cue.time);int total=f.lines.stream().mapToInt(s->s.codePointCount(0,s.length())).sum();
        for(int row=0;row<f.lines.size();row++){int[] points=f.lines.get(row).codePoints().toArray();int col=0;for(int c:points){long at=f.cue.times.length>n?f.cue.times[n]:(long)(Math.min((next-f.cue.time)*.75,Math.max(1,total)*110.0)*n/Math.max(1,total));double t=(elapsed-at)/160.0,a=wordPop?Math.max(0,Math.min(1,t*3)):Math.max(0,Math.min(1,t));double pop=wordPop?1+.55*Math.pow(Math.max(0,Math.min(1,1-t)),2):1;double dx=0,dy=0;if(wiggle){long hash=(n*73856093L^(now/125)*19349663L^key.hashCode());dx=((hash&65535)/32767.5-1)*.6;dy=(((hash>>16)&65535)/32767.5-1)*.6;}if(!Character.isWhitespace(c))glyphs.add(Map.of("c",new String(Character.toChars(c)),"row",row,"col",col,"alpha",a*alpha,"pop",pop,"dx",dx,"dy",dy));n++;col++;}}
        return Map.of("key",key+":"+f.cue.time,"lines",f.lines,"glyphs",glyphs,"x",cx+rx*k,"y",cy+ry*k+lift,"z",cz+rz*k,"scale",.03*scale*(distance/6.5));
    }
    private static List<String> wrap(String text){List<String> lines=new ArrayList<>();StringBuilder row=new StringBuilder();int width=0;for(int c:text.codePoints().limit(240).toArray()){int advance=c>=0x2e80?9:6;if(width+advance>200){lines.add(row.toString());row.setLength(0);width=0;}row.appendCodePoint(c);width+=advance;}if(!row.isEmpty())lines.add(row.toString());return lines;}
}
