#!/usr/bin/env python3
"""Check install metadata, component schemas, built files and original asset hashes."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()


def verify():
    public, dist = ROOT / 'public', ROOT / 'dist'
    metadata = json.loads((public / 'metadata.json').read_text())
    assert metadata['id'] == 'opai'
    api_baseline = json.loads((ROOT / 'reports/api-baseline.json').read_text())
    allowed_types = set(api_baseline['supported_json_descriptor_types'])
    def check_values(values):
        for value in values:
            assert value['type'] in allowed_types, value['type']
            check_values(value.get('values', []))
            if value['type'] == 'CHOICE':
                for choice in value['choices']:
                    check_values(choice.get('values', []))
    check_values(metadata.get('values', []))
    components = []
    for name in metadata['components']:
        definition = json.loads((public / 'components' / (name.lower() + '.json')).read_text())
        assert definition['name'] == name
        check_values(definition.get('values', []))
        alignment = definition['alignment']
        assert isinstance(alignment['horizontalOffset'], int) and isinstance(alignment['verticalOffset'], int)
        for value in definition.get('values', []):
            if value['type'] in ('INT', 'FLOAT'):
                assert isinstance(value['range'], dict) and value['range']['min'] <= value['value'] <= value['range']['max']
        components.append(name)
    for font in metadata['fonts']:
        assert (public / 'fonts' / font).stat().st_size > 0
    for background in metadata['backgrounds']:
        for kind in background['types']:
            assert (public / 'backgrounds' / (background['name'] + '.' + kind)).is_file()
    html = (dist / 'index.html').read_text()
    for link in re.findall(r'(?:src|href)="(\./[^"#]+)"', html):
        assert (dist / link).is_file(), link
    manifest = json.loads((ROOT / 'reports/assets-manifest.json').read_text())
    for item in manifest['assets']:
        for base in (public, dist):
            path = base / item['theme_path']
            assert path.is_file() and sha(path) == item['sha256'], str(path)
    art = json.loads((ROOT / 'reports/via-art-sources.json').read_text())
    for item in art['images']:
        assert sha(ROOT / item['source_file']) == item['source_sha256']
        for base in (public, dist):
            assert sha(base / item['output']) == item['output_sha256'], item['output']
    assert json.loads((public / 'opai/version-extra/sources.json').read_text()) == art
    for item in json.loads((ROOT / 'reports/command-icon-sources.json').read_text())['icons']:
        assert sha(ROOT / item['source']) == item['source_sha256']
        assert sha(ROOT / item['output']) == item['output_sha256']
        assert sha(dist / Path(item['output']).relative_to('public')) == item['output_sha256']
    music={}
    if (public/'music/OpaiMusicService.jar').exists():
        for name in ['OpaiMusicService.jar','OpaiMusicService-Source.zip','LICENSE-TRITIUM','LICENSE-DANGO','LICENSE-QRCODE','UPSTREAM.md']:
            assert sha(public/'music'/name)==sha(dist/'music'/name),name
        with zipfile.ZipFile(dist/'music/OpaiMusicService.jar') as jar:
            assert jar.testzip() is None and 'opai/music/MusicService.class' in jar.namelist()
            assert not any('Test' in p for p in jar.namelist()),'Test classes must not ship in runtime JAR'
        with zipfile.ZipFile(dist/'music/OpaiMusicService-Source.zip') as src:
            assert src.testzip() is None and 'opai-music/src/opai/music/MusicService.java' in src.namelist()
        music={'service_version':'1.2.0','jar_sha256':sha(dist/'music/OpaiMusicService.jar'),'complete_source_included':True}
    return {'metadata_id': metadata['id'], 'api_source_version': api_baseline['source_mod_version'], 'component_count': len(components),
            'font_count': len(metadata['fonts']), 'original_assets_verified': len(manifest['assets']), 'added_blurred_art_verified':len(art['images']),
            'theme_version':metadata['version'],
            'index_sha256': sha(dist / 'index.html'),
            'bundles': {p.name: sha(p) for p in sorted((dist / 'assets').glob('*'))},
            'music':music,'native_game_tested': False, 'pixel_equivalence_certified': False}


if __name__ == '__main__':
    result = verify()
    (ROOT / 'reports/package-verification.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
