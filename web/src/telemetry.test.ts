import{test}from'node:test';import assert from'node:assert/strict';import{atDistance,csv,lapTime,type Point}from'./telemetry.ts';
const p=(d:number,t:number,speed:number):Point=>({d,t,speed,throttle:50,brake:0,gear:5,rpm:10000,x:d,y:0});
test('distance lookup interpolates and clamps boundaries',()=>{const points=[p(0,0,100),p(100,4,200),p(200,6,250)];assert.equal(atDistance(points,50).speed,150);assert.equal(atDistance(points,-1).t,0);assert.equal(atDistance(points,300).t,6);assert.equal(atDistance(points,100).t,4);});
test('lap timing and CSV retain units and precision',()=>{assert.equal(lapTime(79.327),'1:19.327');assert.match(csv({number:1,time:4,sectors:[],points:[p(100,4,200)]}),/100,4,200,50,0,5,10000/);});

test('bundled session has eight complete, finite, ordered laps',async()=>{
 const{readFileSync}=await import('node:fs');const data=JSON.parse(readFileSync(new URL('../public/monza-2024.json',import.meta.url),'utf8'));
 assert.equal(data.drivers.length,4);
 for(const driver of data.drivers){assert.equal(driver.laps.length,2);for(const lap of driver.laps){assert.ok(lap.points.length>100);assert.equal(lap.points[0].d,0);assert.equal(lap.points.at(-1).d,data.distance);assert.ok(Math.abs(lap.sectors.reduce((a:number,b:number)=>a+b,0)-lap.time)<.01);lap.points.forEach((p:Point,i:number)=>{Object.values(p).forEach(n=>assert.ok(Number.isFinite(n)));if(i){assert.ok(p.d>lap.points[i-1].d);assert.ok(p.t>lap.points[i-1].t);}assert.ok(p.throttle>=0&&p.throttle<=100);});}}
});
