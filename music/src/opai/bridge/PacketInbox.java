package opai.bridge;

import java.lang.reflect.Method;
import java.util.Objects;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.function.Consumer;

/** Copies incoming packet references without entering the GraalJS context on the network thread. */
public final class PacketInbox implements Consumer<Object> {
    private final ArrayBlockingQueue<Received> events = new ArrayBlockingQueue<>(2048);
    private final Method getOrigin;
    private final Method getPacket;
    private final Object incoming;
    private final Class<?>[] packetTypes;

    public PacketInbox(Class<?> eventType, Object incoming, Class<?>[] packetTypes) throws NoSuchMethodException {
        getOrigin = eventType.getMethod("getOrigin");
        getPacket = eventType.getMethod("getPacket");
        this.incoming = Objects.requireNonNull(incoming);
        this.packetTypes = packetTypes.clone();
    }

    @Override
    public void accept(Object event) {
        try {
            if (getOrigin.invoke(event) != incoming) return;
            Object packet = getPacket.invoke(event);
            for (Class<?> type : packetTypes) {
                if (type.isInstance(packet)) {
                    events.offer(new Received(event, System.currentTimeMillis()));
                    return;
                }
            }
        } catch (ReflectiveOperationException error) {
            throw new IllegalStateException("Unable to read LiquidBounce PacketEvent", error);
        }
    }

    public Received poll() {
        return events.poll();
    }

    public record Received(Object event, long at) {}

    public void clear() {
        events.clear();
    }
}
