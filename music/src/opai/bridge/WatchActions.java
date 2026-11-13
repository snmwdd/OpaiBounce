package opai.bridge;

import java.util.function.Consumer;

/** Lets existing chat links become inert before their script context closes. */
public final class WatchActions {
    private Consumer<String> action;

    public WatchActions(Consumer<String> action) {
        this.action = action;
    }

    public Runnable link(String player) {
        return () -> {
            if (action != null) action.accept(player);
        };
    }

    public void close() {
        action = null;
    }
}
