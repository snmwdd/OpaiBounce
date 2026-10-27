#!/usr/bin/env python3
"""Build deterministic install and source ZIPs after npm run build."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile
from verify_theme import ROOT, verify


def zip_files(target, files):
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path, name in sorted(files, key=lambda item: item[1]):
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 24, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())


if __name__ == '__main__':
    result = verify()
    (ROOT / 'reports/package-verification.json').write_text(json.dumps(result, indent=2) + '\n')
    for name in ['LICENSE', 'LICENSE-OPAI-SHELL', 'NOTICE.md', 'README.md', 'PORTING.md', 'FIXES.md', 'PERFORMANCE.md', 'FREE-0.1-RELEASE.md']:
        shutil.copyfile(ROOT / name, ROOT / 'dist' / name)
    output = ROOT.parent / 'dist'
    output.mkdir(exist_ok=True)
    version=json.loads((ROOT / 'package.json').read_text())['version']
    assert json.loads((ROOT / 'dist/metadata.json').read_text())['version']==version
    # Preserve old generated distributions before synchronizing all install aliases.
    archive=output/'archive'
    archive.mkdir(exist_ok=True)
    for old in [output/'Opai-LiquidBounce-Theme.zip',output/'Opai-LiquidBounce-Theme-Source.zip',output/'opai.zip',ROOT/'dist.zip']:
        if old.exists():
            saved=archive/(old.parent.name+'-'+old.name+'.before-'+version)
            if not saved.exists():shutil.copyfile(old,saved)
    install = output / 'Opai-LiquidBounce-Theme.zip'
    source = output / 'Opai-LiquidBounce-Theme-Source.zip'
    zip_files(install, [(p, 'opai/' + p.relative_to(ROOT / 'dist').as_posix())
                        for p in (ROOT / 'dist').rglob('*') if p.is_file()])
    ignored = {'node_modules', 'dist', '.git', '.idea', '.vscode', '__pycache__', 'test-results'}
    source_files=[(p, 'opai-theme/' + p.relative_to(ROOT).as_posix()) for p in ROOT.rglob('*')
                       if p.is_file() and not any(part in ignored for part in p.relative_to(ROOT).parts)
                       and p.name != '.DS_Store' and p.suffix.lower() not in {'.log', '.zip'}]
    music_source=ROOT.parent/'opai-music'
    if music_source.is_dir():
        source_files.extend((p,'opai-music/'+p.relative_to(music_source).as_posix()) for p in music_source.rglob('*')
                            if p.is_file() and not any(part in {'build','.git','__pycache__'} for part in p.relative_to(music_source).parts))
    zip_files(source,source_files)
    with zipfile.ZipFile(install) as z:
        assert z.testzip() is None and 'opai/metadata.json' in z.namelist()
        assert json.loads(z.read('opai/metadata.json'))['id'] == 'opai'
        assert not any('node_modules/' in n or '/tests/' in n for n in z.namelist())
    shutil.copyfile(install,output/'opai.zip')
    unpacked=output/'opai'
    if unpacked.exists():
        saved=archive/('opai-directory.before-'+version)
        if not saved.exists():shutil.move(str(unpacked),str(saved))
        else:shutil.rmtree(unpacked)
    shutil.copytree(ROOT/'dist',unpacked)
    zip_files(ROOT/'dist.zip',[(p,'dist/'+p.relative_to(ROOT/'dist').as_posix()) for p in (ROOT/'dist').rglob('*') if p.is_file()])
    checksums = []
    for path in (install, source):
        checksum = hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
        checksums.append(f'{checksum}  {path.name}')
        print(f'{path.name}: {path.stat().st_size:,} bytes')
    (output / 'SHA256SUMS.txt').write_text('\n'.join(checksums) + '\n')
    shutil.copyfile(ROOT / 'README.md', output / '安装说明.md')
    print('ZIP structure, CRCs, metadata and original resources verified.')
