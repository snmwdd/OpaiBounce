# OpaiBounceScript 1.10.2

`OpaiBounceScript.js` is the single source of the companion LiquidScript. It provides server address / Ping, ESP and Nametags previews, Opai Nametags, island activity telemetry, and the native TritiumMusic and Anti-cheat modules.

Install the official LiquidBounce Script API add-on, then place this file in the directory opened by `.script browse`. Keep only one copy and restart the game after updating the theme and script together.

The native API contract targets LiquidBounce Nextgen 0.41.1 / Minecraft 26.3. Tests run with `npm test` from the repository root. They use host substitutes and do not validate actual in-game rendering. See `API.md` for the theme bridge API.

The AutoBlock and Scaffold checks adapt ideas from [Rain Anticheat](https://github.com/CodeRabbit-byte/raindot-anticheat) and [ClientSide-AC](https://github.com/TumeloGaming/ClientSide-AC). Their MIT license and copyright notices are in [NOTICE.md](../NOTICE.md).

## Anti-cheat controls

- Open Misc → Anti-cheat, then expand a check to edit its parameters.
- `Reset VL` is off by default. Enabling it reveals `Reset Interval (s)`, default 30 seconds, range 5–600. Each player’s timer starts at the first flag after their last reset. The total and per-check VL reset together; persistent marks stay saved.
- `Cheater VL` is the total VL required for a persistent player mark. Default is 11.
- `Flag Interval (s)` is the global minimum interval. Each check also has its own interval and `VL per Flag`.
- `Auto Throw` defaults to a 2.5 s window, at least 6 throws, more than 3 throws/s, a 0.6 s aim lock within 12°, and an 80% locked-throw ratio.
- `Auto Bow` defaults to a 4 s window, at least 5 arrows, more than 1.5 arrows/s, a shooter distance of 8–48 blocks, and a 6-block radius around you. Direct arrow hits also count. Crossbow shots and stationary arrows are excluded.
- `Inventory Drop` flags more than 5 distinct discard actions in a rolling 5-second window. A whole stack counts once. Its window, maximum drops, source radius, interval, and VL are independently configurable. When thrower metadata is unavailable, it estimates the source from spawn-packet origin, initial velocity, and recent player samples. Ambiguous overlaps, nearby block-break loot, stale packets, local drops, and duplicate UUIDs are excluded. Estimated alerts are labeled; fast legitimate inventory clearing can still trigger this heuristic. It cannot prove another player has an inventory screen open.
- `Telly Scaffold` defaults to 2 jumps and 3 attributed blocks within 4.5 s.
- `.hack add <player>` adds a mark.
- `.hack delete <player>` removes a mark and resets the player's live VL. Aliases are `remove` and `del`.
- `.hack list [page]` lists marked players with a clickable `[X]`. Names are saved for later removal.
- Commands use the current server or singleplayer world. List actions become stale when changing worlds.

Existing Boolean setting keys are preserved. Each check is registered as a native LiquidBounce toggleable group. Its nested parameters use short English names. Legacy flat parameter keys are hidden and mirrored for saved-configuration compatibility. The old extra-VL setting migrates to the direct `AlertVL` value.

## HUD and render distances

Opai settings include `Nametag Distance` and `Bed Distance`, independently saved from 8 to 256 blocks (default 128). The script reuses the native BedPlates tracker, filters, self-bed exclusion and scale curve; the native module must be enabled. Bed cards show one horizontal row of distinct block icons and a protection status. `Not Protected` has no icon row. Protection checks the first layer above and beside both bed halves, not the floor. The original renderer is restored on script unload or an incompatible API.

`Target HUD` offers `New`, `Old`, and `IDK`. IDK uses a square portrait, original code-native pixel lettering and a centered health-percentage bar.
