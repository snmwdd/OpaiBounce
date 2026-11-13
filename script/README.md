# OpaiBounceScript 1.9.1

`OpaiBounceScript.js` is the single source of the companion LiquidScript. It provides server address / Ping, ESP and Nametags previews, Opai Nametags, island activity telemetry, and the native TritiumMusic and Anti-cheat modules.

Install the official LiquidBounce Script API add-on, then place this file in the directory opened by `.script browse`. Keep only one copy and restart the game after updating the theme and script together.

The native API contract targets LiquidBounce Nextgen 0.41.1 / Minecraft 26.3. Tests run with `npm test` from the repository root. They use host substitutes and do not validate actual in-game rendering. See `API.md` for the theme bridge API.

The AutoBlock and Scaffold checks adapt ideas from [Rain Anticheat](https://github.com/CodeRabbit-byte/raindot-anticheat) and [ClientSide-AC](https://github.com/TumeloGaming/ClientSide-AC). Their MIT license and copyright notices are in [NOTICE.md](../NOTICE.md).
