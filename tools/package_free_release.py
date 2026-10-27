#!/usr/bin/env python3
"""Assemble the public free release with one script, docs and corresponding source."""
from pathlib import Path
import hashlib,json,zipfile,shutil
from package_theme import ROOT,zip_files

if __name__=='__main__':
    version=json.loads((ROOT/'package.json').read_text())['version']
    assert json.loads((ROOT/'dist/metadata.json').read_text())['version']==version
    project=ROOT.parent;output=project/'dist';bridge=project/'opai-liquidscript'
    script=bridge/'OpaiBridge.js'
    assert script.read_bytes()==(ROOT/'OpaiBounceScript.js').read_bytes()
    install=output/f'Opai-Free-{version}.zip';source=output/f'Opai-Free-{version}-Source.zip'
    files=[(p,'themes/opai/'+p.relative_to(ROOT/'dist').as_posix()) for p in (ROOT/'dist').rglob('*') if p.is_file()]
    files.extend([(script,'scripts/OpaiBounceScript.js'),(bridge/'README.md','scripts/README.md'),(ROOT/'FREE-0.1-RELEASE.md','安装与发布说明.md'),(ROOT/'LICENSE','LICENSE'),(ROOT/'NOTICE.md','NOTICE.md')])
    zip_files(install,files)
    theme_source=output/'Opai-LiquidBounce-Theme-Source.zip'
    with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as dst:
        with zipfile.ZipFile(theme_source) as src:
            for item in src.infolist():dst.writestr(item,src.read(item))
        for p in sorted(bridge.rglob('*')):
            if p.is_file() and p.name!='.DS_Store' and not any(x in {'__pycache__','node_modules','.git'} for x in p.parts):
                dst.write(p,'opai-liquidscript/'+p.relative_to(bridge).as_posix())
    for path in [install,source]:
        with zipfile.ZipFile(path) as z:
            assert z.testzip() is None
            assert not any('/node_modules/' in n or n.endswith('.DS_Store') for n in z.namelist())
    with zipfile.ZipFile(install) as z:
        assert json.loads(z.read('themes/opai/metadata.json'))['version']==version
        assert z.read('scripts/OpaiBounceScript.js')==script.read_bytes()
        assert len([n for n in z.namelist() if n.startswith('scripts/') and n.endswith('.js')])==1
        assert 'themes/opai/music/OpaiMusicService-Source.zip' in z.namelist()
    checksums=''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in [install,source])
    (output/f'SHA256SUMS-Free-{version}.txt').write_text(checksums)
    shutil.copyfile(ROOT/'FREE-0.1-RELEASE.md',output/f'免费{version}-安装与发布说明.md')
    print(f'Verified free {version}: theme, one canonical script, licenses, music service source and corresponding source archive.')
