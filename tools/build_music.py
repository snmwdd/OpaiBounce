#!/usr/bin/env python3
"""Compile the music service with JDK 21+; Gson is provided by the game at runtime."""
from pathlib import Path
import argparse
import hashlib
import os
import shutil
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MUSIC = ROOT / 'music'
GSON_VERSION = '2.11.0'
GSON_SHA256 = '57928d6e5a6edeb2abd3770a8f95ba44dce45f3b23b7a9dc2b309c581552a78b'


def build(gson=None, tests=False):
    if not shutil.which('javac'):
        raise SystemExit('JDK 21+ is required: javac is missing from PATH.')
    cache = ROOT / 'build/deps'
    cache.mkdir(parents=True, exist_ok=True)
    gson = Path(gson).resolve() if gson else cache / f'gson-{GSON_VERSION}.jar'
    if not gson.is_file():
        if gson.parent != cache:
            raise SystemExit(f'Gson JAR does not exist: {gson}')
        url = f'https://repo.maven.apache.org/maven2/com/google/code/gson/gson/{GSON_VERSION}/{gson.name}'
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != GSON_SHA256:
            raise SystemExit('Downloaded Gson checksum mismatch.')
        gson.write_bytes(data)
    if hashlib.sha256(gson.read_bytes()).hexdigest() != GSON_SHA256:
        raise SystemExit(f'Expected the pinned Gson {GSON_VERSION} JAR.')
    classes = ROOT / 'build/music/classes'
    if classes.exists():
        shutil.rmtree(classes)
    classes.mkdir(parents=True)
    sources = sorted((MUSIC / 'src').rglob('*.java'))
    # Argument files handle Windows command-length limits and checkout paths with spaces.
    arguments = ROOT / 'build/music/sources.txt'
    arguments.write_text('\n'.join('"' + p.as_posix().replace('"', '\\"') + '"' for p in sources), encoding='utf-8')
    subprocess.run(['javac', '--release', '21', '-encoding', 'UTF-8', '-cp', str(gson), '-d', str(classes), '@' + str(arguments)], check=True)
    output = ROOT / 'public/music'
    output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output / 'OpaiMusicService.jar', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(classes.rglob('*.class')):
            archive.write(path, path.relative_to(classes).as_posix())
        for name in ['LICENSE-TRITIUM', 'LICENSE-DANGO', 'UPSTREAM.md']:
            archive.write(MUSIC / name, name)
    with zipfile.ZipFile(output / 'OpaiMusicService-Source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(MUSIC.rglob('*')):
            if path.is_file():
                archive.write(path, 'music/' + path.relative_to(MUSIC).as_posix())
        archive.write(Path(__file__), 'tools/build_music.py')
    if tests:
        test_classes = ROOT / 'build/music/test-classes'
        if test_classes.exists():
            shutil.rmtree(test_classes)
        test_classes.mkdir(parents=True)
        classpath = os.pathsep.join([str(classes), str(gson)])
        subprocess.run(['javac', '--release', '21', '-encoding', 'UTF-8', '-cp', classpath, '-d', str(test_classes), *map(str, sorted((MUSIC / 'tests').glob('*.java')))], check=True)
        for name in ['MusicServiceTest', 'PcmSpectrumTest', 'DangoLyricsTest']:
            subprocess.run(['java', '-cp', classpath + os.pathsep + str(test_classes), 'opai.music.' + name], cwd=MUSIC, check=True)
    print('Music service built from source (Java 21 bytecode).')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gson', type=Path, help='Use a local Gson 2.11.0 JAR instead of downloading it')
    parser.add_argument('--test', action='store_true', help='Run local protocol, spectrum and lyric tests')
    options = parser.parse_args()
    build(options.gson, options.test)
