#!/usr/bin/env python3
"""Package the local, separately built native client and corresponding source."""
from pathlib import Path
import difflib
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NATIVE = ROOT.parent / 'LiquidBounce-nextgen'
OUT = ROOT.parent / 'dist'
BUILD_VERSION = '0.41.1-opai.1.7.0'
CHANGED = [
    'src/main/java/net/ccbluex/liquidbounce/common/ClientLogoTexture.java',
    'src/main/java/net/ccbluex/liquidbounce/injection/mixins/minecraft/gui/MixinLoadingOverlay.java',
    *[f'src/main/kotlin/net/ccbluex/liquidbounce/features/module/modules/render/nametags/{name}.kt'
      for name in ['ModuleNametags', 'NametagRenderer', 'NametagRenderState', 'NametagTextFormatter']],
    'src/main/kotlin/net/ccbluex/liquidbounce/ui/OpaiSplash.kt',
    'src/main/resources/git.properties',
    'src/main/resources/META-INF/NOTICE-OPAI.md',
    'src/main/resources/META-INF/LICENSE-OPAI-SHELL',
]


def digest(path):
    return hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()


def main():
    jar = NATIVE / 'build/libs' / f'liquidbounce-{BUILD_VERSION}.jar'
    with zipfile.ZipFile(jar) as z:
        assert z.testzip() is None
        meta = json.loads(z.read('fabric.mod.json'))
        assert meta['version'] == BUILD_VERSION
        assert meta['depends']['minecraft'] == ['26.3']
        for name in ['net/ccbluex/liquidbounce/ui/OpaiSplash.class',
                     'net/ccbluex/liquidbounce/features/module/modules/render/nametags/NametagRendererKt.class',
                     'resources/liquidbounce/opai_splash.png', 'META-INF/NOTICE-OPAI.md']:
            assert name in z.namelist(), name
    OUT.mkdir(exist_ok=True)
    dest = OUT / 'Opai-LiquidBounce-Client-0.41.1-26.3.jar'
    shutil.copy2(jar, dest)
    source = OUT / 'Opai-LiquidBounce-Client-Source.zip'
    ignored = {'node_modules', 'build', 'dist', 'run', '.gradle', '.git', '.idea', '.vscode', '__pycache__'}
    with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for path in sorted(NATIVE.rglob('*')):
            rel = path.relative_to(NATIVE)
            if not path.is_file() or any(part in ignored for part in rel.parts) or path.name == '.DS_Store' or path.suffix == '.log':
                continue
            z.write(path, 'LiquidBounce-nextgen/' + rel.as_posix())
        z.write(ROOT / 'native/README.md', 'LiquidBounce-nextgen/OPAI-BUILD.md')
    with zipfile.ZipFile(source) as z:
        assert z.testzip() is None
    # Reviewable textual diff against the user-supplied archive; binary atlas is in the source ZIP.
    with zipfile.ZipFile(ROOT.parent / 'LiquidBounce-nextgen.zip') as original:
        patch = []
        for rel in CHANGED:
            candidates = [n for n in original.namelist() if n.endswith('/' + rel) or n == rel]
            before = original.read(candidates[0]).decode('utf-8').splitlines(True) if candidates else []
            after = (NATIVE / rel).read_text().splitlines(True)
            patch.extend(difflib.unified_diff(before, after, fromfile='a/' + rel, tofile='b/' + rel))
    (ROOT / 'native/opai-native.patch').write_text(''.join(patch))
    report = {'build_version': BUILD_VERSION, 'minecraft': '26.3', 'java': '25+',
              'compile_and_jar_verified': True, 'native_game_tested': False,
              'files': {p.name: {'bytes': p.stat().st_size, 'sha256': digest(p)} for p in [dest, source]}}
    (ROOT / 'reports/native-build-1.7.0.json').write_text(json.dumps(report, indent=2) + '\n')
    (OUT / 'NATIVE-SHA256SUMS.txt').write_text(''.join(f'{digest(p)}  {p.name}\n' for p in [dest, source]))
    shutil.copyfile(ROOT / 'native/README.md', OUT / '原生客户端说明.md')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
