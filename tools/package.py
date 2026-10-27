#!/usr/bin/env python3
"""Package one install ZIP and a complete source ZIP under release/."""
import hashlib
import json
import zipfile
from verify import ROOT, verify


def write_zip(target, files):
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path, name in sorted(files, key=lambda item: item[1]):
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 26, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None


def source_files():
    folders = ['src', 'script', 'music', 'public', 'tools', 'tests']
    root_files = ['README.md', 'LICENSE', 'LICENSE-OPAI-SHELL', 'NOTICE.md', '.gitignore', '.gitattributes', 'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'svelte.config.js', 'tsconfig.json', 'tsconfig.node.json', 'playwright.config.ts']
    files = [(ROOT / name, name) for name in root_files]
    for folder in folders:
        for path in (ROOT / folder).rglob('*'):
            if not path.is_file() or path.name == '.DS_Store' or '__pycache__' in path.parts:
                continue
            if path.suffix in {'.pyc', '.jar', '.zip', '.log', '.tap'}:
                continue
            files.append((path, path.relative_to(ROOT).as_posix()))
    return files


if __name__ == '__main__':
    result = verify()
    version = result['version']
    output = ROOT / 'release'
    output.mkdir(exist_ok=True)
    install = output / f'Opai-Free-{version}.zip'
    source = output / f'Opai-Free-{version}-Source.zip'
    files = [(path, 'themes/opai/' + path.relative_to(ROOT / 'build/theme').as_posix()) for path in (ROOT / 'build/theme').rglob('*') if path.is_file()]
    files += [(ROOT / 'script/OpaiBounceScript.js', 'scripts/OpaiBounceScript.js')]
    files += [(ROOT / name, name) for name in ['README.md', 'LICENSE', 'LICENSE-OPAI-SHELL', 'NOTICE.md']]
    files += [(ROOT / name, 'themes/opai/' + name) for name in ['LICENSE', 'LICENSE-OPAI-SHELL', 'NOTICE.md']]
    write_zip(install, files)
    write_zip(source, [(path, 'OpaiBounce/' + name) for path, name in source_files()])
    with zipfile.ZipFile(install) as archive:
        assert len([name for name in archive.namelist() if name.startswith('scripts/') and name.endswith('.js')]) == 1
        assert json.loads(archive.read('themes/opai/metadata.json'))['version'] == version
    (output / 'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + path.name + '\n' for path in [install, source]))
    print(json.dumps(result, ensure_ascii=False))
    for path in [install, source]:
        print(f'{path.name}: {path.stat().st_size:,} bytes')
