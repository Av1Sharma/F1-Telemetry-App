"""Rebuild the small, attributed historical demo. No credentials required."""
import json, time, urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timedelta
BASE = 'https://api.openf1.org/v1/'
def get(endpoint, **params):
    url = BASE + endpoint + '?' + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                result = json.load(response)
            time.sleep(2.1)
            return result
        except Exception:
            if attempt == 3: raise
            time.sleep(5 * (attempt + 1))

def main():
    session = 9586
    laps = get('laps', session_key=session)
    drivers = get('drivers', session_key=session)
    output = {'title':'Monza', 'year':2024, 'session':'Qualifying', 'sessionKey':session,
              'source':'https://openf1.org/', 'distance':5793, 'drivers':[]}
    for number in (4, 81, 16, 55):
        driver = next(d for d in drivers if d['driver_number']==number)
        choices = sorted([l for l in laps if l['driver_number']==number and l.get('lap_duration') and not l.get('is_pit_out_lap')], key=lambda l:l['lap_duration'])[:2]
        out = {'number':number,'name':driver['full_name'].title(),'code':driver['name_acronym'],'team':driver['team_name'],'laps':[]}
        for lap in choices:
            start = datetime.fromisoformat(lap['date_start'])
            end = start + timedelta(seconds=lap['lap_duration'])
            params = {'session_key':session,'driver_number':number,'date>':start.replace(tzinfo=None).isoformat(),'date<':end.replace(tzinfo=None).isoformat()}
            car = get('car_data', **params)
            locations = get('location', **params)
            if len(car)<100 or not locations: raise ValueError('Incomplete telemetry')
            points=[]
            distance=0
            last_t=0
            last_speed=car[0]['speed']
            for sample in car:
                t=(datetime.fromisoformat(sample['date'])-start).total_seconds()
                distance+=(sample['speed']+last_speed)/7.2*(t-last_t)
                loc=min(locations, key=lambda loc:abs((datetime.fromisoformat(loc['date'])-datetime.fromisoformat(sample['date'])).total_seconds()))
                points.append({'t':round(t,3),'d':round(distance,2),'speed':sample['speed'],'throttle':min(100,max(0,sample['throttle'])),'brake':int(sample['brake']>0),'gear':sample['n_gear'],'rpm':sample['rpm'],'x':loc['x'],'y':loc['y']})
                last_t,last_speed=t,sample['speed']
            # Normalize integrated speed to circuit distance for comparative plotting.
            first,last=points[0]['d'],points[-1]['d']
            for p in points: p['d']=round((p['d']-first)/(last-first)*5793,2)
            out['laps'].append({'number':lap['lap_number'],'time':lap['lap_duration'],'sectors':[lap[f'duration_sector_{i}'] for i in (1,2,3)],'points':points})
            print(out['code'],lap['lap_number'],len(points),flush=True)
        output['drivers'].append(out)
    path=Path(__file__).resolve().parents[1]/'web/public/monza-2024.json'
    path.write_text(json.dumps(output,separators=(',',':')))
if __name__=='__main__':main()
