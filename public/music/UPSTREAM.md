Tritium Music: https://github.com/opai-client/tritium-music
Commit: 9ace2ea050aaa09d06704d3202a6136d7b2d2396
GPL-3.0; StreamingSoundPlayer, PrefetchInputStream and NCM protocol adaptation.
The vendored MP3 / FLAC decoders retain their original notices in each source file.
GD API: GD音乐台 (music.gdstudio.xyz); provided for non-commercial study, CC BY-NC 4.0. No music files are bundled.

Port modifications, service 1.1.0 (2026-10-25): persisted independent music HUD switches, atomic local favorites, PCM spectrum analysis with 32 logarithmic Goertzel bands. PcmSpectrum is an original port-side implementation, not the original OpenGL spectrum renderer.

Dango Music: https://github.com/Sorihiko/DangoMusic
Commit: 985d55303b9df9866c41099ee70a772b5a48c4f6
GPL-3.0, Sorihiko and contributors. LyricsModule.kt / LyricsProvider.kt source retained in vendor/dango. Service 1.2.0 ports world spawn, English/CJK word timing, YRC/LRC parsing, pop/wiggle and 400 ms fades into DangoLyrics.java. The native Script API bridge replaces platform drawing with Minecraft world text submission. Deep Glow shaders, Text Flash and Listen Together are not part of this port.
