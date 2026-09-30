"""Reduce a checksummed F1DB release to small, same-origin season files."""
import argparse, hashlib, json, zipfile, urllib.request
from collections import defaultdict
from pathlib import Path
VERSION='v2026.15.1'
BASE=f'https://github.com/f1db/f1db/releases/download/{VERSION}/'
def download(name):
    with urllib.request.urlopen(BASE+name,timeout=90) as response:return response.read()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--zip',type=Path);parser.add_argument('--checksums',type=Path);args=parser.parse_args()
    data=args.zip.read_bytes() if args.zip else download('f1db-json-splitted.zip')
    checksums=args.checksums.read_text() if args.checksums else download('checksums_sha256.txt').decode()
    expected=next(line.split()[0] for line in checksums.splitlines() if line.endswith('f1db-json-splitted.zip'))
    assert hashlib.sha256(data).hexdigest()==expected,'Archive checksum mismatch'
    import io
    archive=zipfile.ZipFile(io.BytesIO(data))
    def read(name):return json.loads(archive.read(f'f1db-{name}.json'))
    drivers={r['id']:r['name'] for r in read('drivers')};teams={r['id']:r['name'] for r in read('constructors')};circuits={r['id']:r['name'] for r in read('circuits')};prix={r['id']:r['name'] for r in read('grands-prix')}
    results=defaultdict(list)
    for r in read('races-race-results'):
        status=r.get('reasonRetired') or r.get('gap') or (f'+{r["gapLaps"]} lap(s)' if r.get('gapLaps') else r.get('time')) or r.get('positionText') or '—'
        results[r['raceId']].append({'position':r.get('positionText') or '—','driver':drivers[r['driverId']],'team':teams[r['constructorId']],'grid':r.get('gridPositionText'),'laps':r.get('laps'),'result':status,'points':r.get('points',0)})
    seasons=defaultdict(list)
    for r in read('races'):
        seasons[r['year']].append({'id':r['id'],'round':r['round'],'name':prix[r['grandPrixId']]+' Grand Prix','circuit':circuits[r['circuitId']],'date':r['date'],'distance':round(r['courseLength']*1000),'results':results[r['id']]})
    root=Path(__file__).resolve().parents[1]/'web/public/archive';root.mkdir(parents=True,exist_ok=True)
    for year,races in seasons.items():(root/f'{year}.json').write_text(json.dumps(sorted(races,key=lambda r:r['round']),separators=(',',':')))
    (root/'index.json').write_text(json.dumps({'version':VERSION,'years':sorted(seasons,reverse=True),'source':'https://github.com/f1db/f1db','license':'https://creativecommons.org/licenses/by/4.0/','sha256':expected},separators=(',',':')))
    print(f'{len(seasons)} seasons, {sum(map(len,seasons.values()))} races')
if __name__=='__main__':main()
