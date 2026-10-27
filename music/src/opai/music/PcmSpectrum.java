package opai.music;

import javax.sound.sampled.AudioFormat;

/** Log-spaced Goertzel bands from the decoded PCM, before the volume fader. */
final class PcmSpectrum {
    private final double[] ring=new double[1024],window=new double[1024];
    private volatile double[] bands=new double[32];
    private int cursor,filled;private volatile long sampled;
    PcmSpectrum(){for(int i=0;i<window.length;i++)window[i]=.5-.5*Math.cos(2*Math.PI*i/(window.length-1));}
    void accept(byte[] data,int offset,int length,AudioFormat format){
        int bytes=format.getSampleSizeInBits()/8,channels=format.getChannels(),frame=bytes*channels;if(bytes<1||bytes>4||frame<1)return;
        double divisor=Math.pow(2,bytes*8-1);
        for(int pos=offset;pos+frame<=offset+length;pos+=frame){double mono=0;
            for(int c=0;c<channels;c++){long v=0;for(int j=0;j<bytes;j++){int at=pos+c*bytes+(format.isBigEndian()?bytes-1-j:j);v|=(long)(data[at]&255)<<(8*j);}int shift=64-bytes*8;v=(v<<shift)>>shift;mono+=v/divisor;}
            ring[cursor]=mono/channels;cursor=(cursor+1)%ring.length;filled=Math.min(ring.length,filled+1);
        }
        long now=System.nanoTime();if(filled<ring.length||now-sampled<40_000_000)return;sampled=now;
        double[] next=new double[32],previous=bands;double hi=Math.min(16000,format.getSampleRate()*.45);
        for(int b=0;b<next.length;b++){double hz=60*Math.pow(hi/60,b/(double)(next.length-1)),coef=2*Math.cos(2*Math.PI*hz/format.getSampleRate()),a=0,z=0;
            for(int i=0;i<ring.length;i++){double value=ring[(cursor+i)%ring.length]*window[i]+coef*a-z;z=a;a=value;}
            double power=Math.sqrt(Math.max(0,a*a+z*z-coef*a*z))/ring.length,level=power<1e-8?0:Math.max(0,Math.min(1,(20*Math.log10(power)+75)/65));next[b]=previous[b]*.5+level*.5;
        }bands=next;
    }
    double[] values(){return System.nanoTime()-sampled>500_000_000?new double[32]:bands.clone();}
}
