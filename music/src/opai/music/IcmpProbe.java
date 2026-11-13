package opai.music;

import java.io.IOException;
import java.io.InputStream;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/** Measures the active game peer using the OS ping executable on a Java worker. */
public final class IcmpProbe implements AutoCloseable {
    private static final long INTERVAL = TimeUnit.SECONDS.toNanos(5);
    private static final Pattern REPLY_TIME = Pattern.compile(
        "([=<])\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:ms|мс)(?!\\p{L})", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private final ExecutorService worker = Executors.newSingleThreadExecutor(
        Thread.ofPlatform().daemon().name("opai-icmp-ping").factory()
    );
    private InetAddress target;
    private Future<Double> pending;
    private Double latency;
    private long lastProbe;
    private boolean started;
    private boolean closed;

    public synchronized Double sample(InetAddress address) {
        if (closed) return null;
        if (!Objects.equals(target, address)) {
            reset();
            target = address;
        }
        if (address == null) return null;
        if (pending != null && pending.isDone()) {
            try {
                latency = pending.get();
            } catch (ExecutionException ignored) {
                latency = null;
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                return latency;
            } finally {
                pending = null;
            }
        }
        long now = System.nanoTime();
        if (pending == null && (!started || now - lastProbe >= INTERVAL)) {
            lastProbe = now;
            started = true;
            pending = worker.submit(() -> measure(address));
        }
        return latency;
    }

    public synchronized void reset() {
        if (pending != null) pending.cancel(true);
        pending = null;
        target = null;
        latency = null;
        started = false;
    }

    @Override
    public synchronized void close() {
        closed = true;
        reset();
        worker.shutdownNow();
    }

    private static Double measure(InetAddress address) {
        List<String> command = pingCommand(address);
        if (command.isEmpty()) return null;
        Process process = null;
        try {
            ProcessBuilder builder = new ProcessBuilder(command).redirectErrorStream(true);
            builder.environment().put("LC_ALL", "C");
            process = builder.start();
            if (!process.waitFor(2, TimeUnit.SECONDS) || process.exitValue() != 0) return null;
            try (InputStream output = process.getInputStream()) {
                Charset encoding = Charset.forName(System.getProperty("native.encoding", "UTF-8"), Charset.defaultCharset());
                return replyTime(new String(output.readNBytes(8192), encoding));
            }
        } catch (IOException | SecurityException unavailable) {
            return null;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return null;
        } finally {
            if (process != null && process.isAlive()) process.destroyForcibly();
        }
    }

    private static List<String> pingCommand(InetAddress address) {
        String host = address.getHostAddress();
        if (host.isBlank() || host.startsWith("-")) return List.of();
        boolean ipv6 = address instanceof Inet6Address;
        String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        if (os.startsWith("windows")) {
            String root = System.getenv("SystemRoot");
            if (root == null) return List.of();
            Path executable = Path.of(root, "System32", "PING.EXE");
            if (!executable.isAbsolute() || !Files.isRegularFile(executable)) return List.of();
            return List.of(executable.toString(), ipv6 ? "-6" : "-4", "-n", "1", "-w", "1500", host);
        }
        if (os.contains("mac") || os.contains("darwin")) {
            return List.of(ipv6 ? "/sbin/ping6" : "/sbin/ping", "-n", "-c", "1", host);
        }
        for (String executable : List.of("/usr/bin/ping", "/bin/ping", "/usr/sbin/ping", "/sbin/ping")) {
            if (Files.isExecutable(Path.of(executable))) {
                return List.of(executable, ipv6 ? "-6" : "-4", "-n", "-c", "1", host);
            }
        }
        return List.of();
    }

    static Double replyTime(String output) {
        for (String line : output.split("\\R")) {
            // Replies have an address followed by a colon. The final statistics
            // line may report an average even if there was no measured reply.
            if (line.indexOf(':') < 0) continue;
            var match = REPLY_TIME.matcher(line);
            if (!match.find()) continue;
            double value = Double.parseDouble(match.group(2).replace(',', '.'));
            if (Double.isFinite(value)) return match.group(1).equals("<") ? value / 2 : value;
        }
        return null;
    }
}
