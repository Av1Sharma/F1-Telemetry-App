import{test}from'node:test';import assert from'node:assert/strict';import{atDistance,csv,lapTime,type Point}from'./telemetry.ts';
const p=(d:number,t:number,speed:number):Point=>({d,t,speed,throttle:50,brake:0,gear:5,rpm:10000,x:d,y:0});
test('distance lookup interpolates and clamps boundaries',()=>{const points=[p(0,0,100),p(100,4,200),p(200,6,250)];assert.equal(atDistance(points,50).speed,150);assert.equal(atDistance(points,-1).t,0);assert.equal(atDistance(points,300).t,6);assert.equal(atDistance(points,100).t,4);});
test('lap timing and CSV retain units and precision',()=>{assert.equal(lapTime(79.327),'1:19.327');assert.match(csv({number:1,time:4,sectors:[],points:[p(100,4,200)]}),/100,4,200,50,0,5,10000/);});
