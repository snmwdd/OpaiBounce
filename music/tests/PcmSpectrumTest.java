package opai.music;
import javax.sound.sampled.AudioFormat;
import java.util.Arrays;
public class PcmSpectrumTest {
    public static void main(String[] args)throws Exception{
        PcmSpectrum silent=new PcmSpectrum();AudioFormat f=new AudioFormat(44100,16,2,true,false);silent.accept(new byte[8192],0,8192,f);if(Arrays.stream(silent.values()).anyMatch(v->v!=0))throw new AssertionError("silence generated spectrum");
        for(boolean big:new boolean[]{false,true}){
            PcmSpectrum meter=new PcmSpectrum();byte[] data=new byte[8192];for(int i=0;i<2048;i++){int n=(int)(22000*Math.sin(2*Math.PI*1000*i/44100));for(int c=0;c<2;c++){int at=i*4+c*2;data[at+(big?1:0)]=(byte)n;data[at+(big?0:1)]=(byte)(n>>8);}}
            meter.accept(data,0,data.length,new AudioFormat(44100,16,2,true,big));double[] bands=meter.values();int peak=0;for(int i=1;i<32;i++)if(bands[i]>bands[peak])peak=i;
            double hz=60*Math.pow(16000.0/60,peak/31.0);if(Math.abs(hz-1000)>160||bands[peak]<.25)throw new AssertionError("sine peak incorrect: "+hz);bands[peak]=0;if(meter.values()[peak]==0)throw new AssertionError("mutable result");Thread.sleep(520);if(Arrays.stream(meter.values()).anyMatch(v->v!=0))throw new AssertionError("stale output not cleared");
        }
        System.out.println("PCM spectrum: silence, 1 kHz peak, both byte orders, defensive snapshots and stale decay passed.");
    }
}
