#!/usr/bin/env python3
"""Verify the built theme without the original client checkouts or old reports."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify():
    public, dist = ROOT / 'public', ROOT / 'build/theme'
    metadata = json.loads((public / 'metadata.json').read_text())
    version = json.loads((ROOT / 'package.json').read_text())['version']
    assert metadata['id'] == 'opai' and metadata['version'] == version
    assert json.loads((dist / 'metadata.json').read_text()) == metadata
    allowed = set(json.loads((ROOT / 'tools/data/api-baseline.json').read_text())['supported_json_descriptor_types'])

    def check_values(values):
        for value in values:
            assert value['type'] in allowed, value['type']
            check_values(value.get('values', []))
            if value['type'] == 'CHOICE':
                for choice in value['choices']:
                    check_values(choice.get('values', []))
            if value['type'] in ('INT', 'FLOAT'):
                assert value['range']['min'] <= value['value'] <= value['range']['max']

    check_values(metadata.get('values', []))
    for name in metadata['components']:
        definition = json.loads((public / 'components' / (name.lower() + '.json')).read_text())
        assert definition['name'] == name
        check_values(definition.get('values', []))
        assert isinstance(definition['alignment']['horizontalOffset'], int)
        assert isinstance(definition['alignment']['verticalOffset'], int)
    for font in metadata['fonts']:
        assert (public / 'fonts' / font).stat().st_size > 0
    for background in metadata['backgrounds']:
        for kind in background['types']:
            assert (public / 'backgrounds' / (background['name'] + '.' + kind)).is_file()
    for link in re.findall(r'(?:src|href)="(\./[^"#]+)"', (dist / 'index.html').read_text()):
        assert (dist / link).is_file(), link
    assets = json.loads((ROOT / 'tools/data/assets-manifest.json').read_text())['assets']
    for item in assets:
        for base in (public, dist):
            assert sha(base / item['theme_path']) == item['sha256'], item['theme_path']
    for item in json.loads((public / 'opai/version-extra/sources.json').read_text())['images']:
        for base in (public, dist):
            assert sha(base / item['output']) == item['output_sha256'], item['output']
    for item in json.loads((ROOT / 'tools/data/command-icon-sources.json').read_text())['icons']:
        assert sha(ROOT / item['source']) == item['source_sha256']
        assert sha(ROOT / item['output']) == item['output_sha256']
    for name in ['OpaiMusicService.jar', 'OpaiMusicService-Source.zip', 'LICENSE-TRITIUM', 'LICENSE-DANGO', 'LICENSE-QRCODE', 'UPSTREAM.md']:
        assert sha(public / 'music' / name) == sha(dist / 'music' / name), name
    with zipfile.ZipFile(dist / 'music/OpaiMusicService.jar') as archive:
        assert archive.testzip() is None and 'opai/music/MusicService.class' in archive.namelist()
        assert not any('Test' in name for name in archive.namelist())
    with zipfile.ZipFile(dist / 'music/OpaiMusicService-Source.zip') as archive:
        assert archive.testzip() is None and 'music/src/opai/music/MusicService.java' in archive.namelist()
    assert (ROOT / 'script/OpaiBounceScript.js').is_file()
    return {'version': version, 'components': len(metadata['components']), 'verified_assets': len(assets), 'music_source_included': True}


if __name__ == '__main__':
    print(json.dumps(verify(), ensure_ascii=False, indent=2))
