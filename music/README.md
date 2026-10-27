# Music service

Native loopback music service used by `script/OpaiBounceScript.js`. Source is under `src/`, including the repackaged JLayer / jFLAC decoders. Dango reference sources and upstream notices are retained in `vendor/` and `UPSTREAM.md`.

From the repository root, run `npm run build:music` or `npm run test:music`. This uses JDK 21+ and checksum-pinned Gson 2.11.0. Generated classes go to `build/music/`; the runtime JAR and complete corresponding source archive go to `public/music/` and are ignored by Git. Gson is supplied by the client at runtime.

Supported streams include MP3, FLAC and Java Sound PCM/WAV. AAC/M4A may require selecting a different source. The service persists official login state locally, never sends official cookies to the GD provider, and uses a per-run loopback token. Tests use local fixtures and fake providers; real account login and game rendering are not part of these checks.

See the root README for build, installation, licensing and client compatibility.
