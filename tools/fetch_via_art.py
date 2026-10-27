#!/usr/bin/env python3
"""Fetch matching game-drop key art. Launcher news plus attributed press mirrors."""
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]
BASE='https://launchercontent.mojang.com'
VERSIONS=['1.21','1.21.2','1.21.4','1.21.5','1.21.6','1.21.9','1.21.11','26.1']
(ROOT/'reports/via-sources').mkdir(parents=True,exist_ok=True)
cache=ROOT/'reports/via-sources/launcher.json'
if not cache.exists(): cache.write_bytes(urlopen(BASE+'/v2/javaPatchNotes.json',timeout=20).read())
entries=json.loads(cache.read_text())['entries']
news_cache=ROOT/'reports/via-sources/news.json'
if not news_cache.exists(): news_cache.write_bytes(urlopen(BASE+'/v2/news.json',timeout=20).read())
news=json.loads(news_cache.read_text())['entries']
news_titles={'1.21.5':'The Spring to Life drop','1.21.6':'Chase the Skies','1.21.9':'The Copper Age drop','26.1':'Play Tiny Takeover'}
mirrors={'1.21':'https://staticg.sportskeeda.com/editor/2024/06/787c5-17183051526490-1920.jpg','1.21.2':'https://cdn.mos.cms.futurecdn.net/jWL3beFTcMxdESozGAEqs.jpg','1.21.4':'https://cdn.mos.cms.futurecdn.net/JKuiXCPDjcLjAioK9jDn4Y-1920-80.jpg','1.21.11':'https://cdn.mos.cms.futurecdn.net/Ep268YSyttYPCCDLtqVGRG-1920-80.jpg'}
def fetch(version):
    entry=next(item for item in entries if item['version']==version)
    image=mirrors.get(version)
    if version in news_titles:
        item=next(e for e in news if e['title']==news_titles[version])
        image=urljoin(BASE,item['newsPageImage']['url'])
    assert image
    data=urlopen(image,timeout=25).read()
    path=ROOT/'reports/via-sources'/f'{version}.jpg';path.write_bytes(data)
    return {'family':version,'article':'https://www.minecraft.net/en-us/article/minecraft-java-edition-'+version.replace('.','-'),'launcher_entry':entry['contentPath'],'image_url':image,'source_file':str(path.relative_to(ROOT)),'source_sha256':hashlib.sha256(data).hexdigest(),'output':f'opai/version-extra/{version}.png'}
with ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(fetch,VERSIONS))
(ROOT/'reports/via-art-sources.json').write_text(json.dumps({'copyright':'Minecraft release artwork © Mojang / Microsoft. Not covered by theme GPL.','catalogue':BASE+'/v2/javaPatchNotes.json','processing':'Center crop 352x176, separable CPU Gaussian blur sigma=5 pixels, kernel radius=15, 352x176 PNG (offline)','images':results},indent=2)+'\n')
for item in results:print(item['family'],item['image_url'])
