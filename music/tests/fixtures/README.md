Self-generated 0.6 second digital silence. No music recordings or copyrighted tracks.
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 0.6 -codec:a libmp3lame -b:a 128k silence.mp3
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 0.6 -sample_fmt s16 -codec:a flac silence.flac
