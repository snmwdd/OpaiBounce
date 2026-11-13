package opai.music;

import java.net.InetAddress;
import java.util.Objects;

public final class IcmpProbeTest {
    private static void check(Double expected, String output) {
        Double actual = IcmpProbe.replyTime(output);
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError("Expected " + expected + ", got " + actual + ": " + output);
        }
    }

    public static void main(String[] args) throws Exception {
        check(12.375, "64 bytes from 127.0.0.1: icmp_seq=0 ttl=64 time=12.375 ms");
        check(0.5, "Reply from 127.0.0.1: bytes=32 time<1ms TTL=128");
        check(24.5, "Antwort von ::1: Zeit=24,5 ms");
        check(null, "Reply from 192.0.2.1: Destination host unreachable.");
        check(null, "Minimum = 0ms, Maximum = 0ms, Average = 0ms");

        if (args.length > 0 && args[0].equals("--loopback")) {
            InetAddress address = InetAddress.getByName("127.0.0.1");
            try (IcmpProbe probe = new IcmpProbe()) {
                if (probe.sample(address) != null) throw new AssertionError("First call should start a probe");
                Double sample = null;
                for (int attempt = 0; attempt < 100 && sample == null; attempt++) {
                    Thread.sleep(30);
                    sample = probe.sample(address);
                }
                if (sample == null) throw new AssertionError("Loopback did not return an ICMP reply");
                System.out.println("System ping RTT: " + sample + " ms");
                probe.reset();
                if (probe.sample(null) != null) throw new AssertionError("A cleared target must not show an old sample");
            }
        }
        System.out.println("ICMP reply parsing passed.");
    }
}
