export type Point = {t:number;d:number;speed:number;throttle:number;brake:number;gear:number;rpm:number;x:number;y:number};
export type Lap = {number:number;time:number;sectors:number[];points:Point[]};
export type Driver = {number:number;name:string;code:string;team:string;laps:Lap[]};
export type Session = {title:string;year:number;session:string;sessionKey:number;source:string;distance:number;drivers:Driver[]};
export function atDistance(points:Point[],distance:number):Point {
  if(!points.length) throw new Error('No telemetry samples');
  if(distance<=points[0].d)return points[0];
  if(distance>=points.at(-1)!.d)return points.at(-1)!;
  let lo=0,hi=points.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid].d<distance)lo=mid;else hi=mid;}
  const a=points[lo],b=points[hi],f=(distance-a.d)/(b.d-a.d);
  const p={...a,d:distance};
  for(const k of ['t','speed','throttle','rpm','x','y'] as const)p[k]=a[k]+(b[k]-a[k])*f;
  return p;
}
export function lapTime(t:number){return `${Math.floor(t/60)}:${(t%60).toFixed(3).padStart(6,'0')}`;}
export function delta(a:Lap,b:Lap,d:number){return atDistance(b.points,d).t-atDistance(a.points,d).t;}
export function csv(lap:Lap){return 'distance_m,time_s,speed_kmh,throttle_pct,brake,gear,rpm\n'+lap.points.map(p=>[p.d,p.t,p.speed,p.throttle,p.brake,p.gear,p.rpm].join(',')).join('\n');}
