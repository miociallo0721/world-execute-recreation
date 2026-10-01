import type { Effect } from './titleEffects';
import measuredScans from './assets/scan-events.json';
import measuredMotion from './assets/continuation-motion.json';
const scans=new Map(measuredScans.map(e=>[Math.round(e.time*30000/1001),e]));
type MeasuredEffect={frame:number;chromatic?:number[];scan?:{bars:number[][];level:number}|null};
const motion=new Map<number,MeasuredEffect>((measuredMotion.samples as MeasuredEffect[]).map(f=>[f.frame,f]));
const tears:[number,number,number][]=[
  [33.20,33.767,.8],[36.30,37.337,.55],[39.98,40.207,.7],[40.72,40.841,.8],
  [41.908,42.142,.6],[49.23,49.47,.3],[50.35,50.56,.25],[50.91,51.252,.4],
  [68.17,68.30,.5],[69.403,70.103,.35],[72.57,73.14,.1],[74.107,74.241,.5],
  [76.94,77.34,.3],[84.751,85.185,.3],[86.72,87.153,.12],[87.92,88.122,.15],[88.689,88.956,.4],
  [109.48,109.74,.12],[111.36,114.60,.12],
];
const colors:[number,number,number,number][]=[
  [40.44,40.67,6,42],[49.22,49.45,5,2],[50.34,50.54,4,3],[50.94,51.252,4,4],
  [69.75,70.08,6,4],[72.20,72.40,4,75],[72.70,73.16,4,130],
  [76.96,77.34,4,8],[92.43,92.65,3,1],[95.72,95.929,8,3],[96.66,96.87,10,8],[97.00,97.22,3,2],
];
export function continuationEffectsAt(t:number):Effect{
  if(t>=49.4)t=Math.round(t*30000/1001)*1001/30000+1e-6;
  const off:[number,number]=[-2,-1];
  const e:Effect={tear:0,rgb:0,rgbY:0,bands:0,flash:0,band1:off,band2:off,band3:off,chunks:0,black:0,tint:0,split:0,border:0,noise:0,bandLevel:.96};
  for(const[a,b,v]of tears)if(t>=a&&t<b)e.tear=v;
  for(const[a,b,x,y]of colors)if(t>=a&&t<b){e.rgb=x;e.rgbY=y;}
  const s=scans.get(Math.round(t*30000/1001));
  if(s){e.bands=1;e.border=1;e.bandLevel=Math.min(1.2,s.level/.812);const bars=s.bars;for(let i=0;i<bars.length;i++)e[['band1','band2','band3'][i] as 'band1'|'band2'|'band3']=[bars[i][0],bars[i][1]];}
  const measured=motion.get(Math.round(t*30000/1001));
  if(measured?.chromatic){e.rgb=measured.chromatic[0];e.rgbY=measured.chromatic[1];}
  if(measured&&'scan'in measured){
    e.band1=off;e.band2=off;e.band3=off;e.bands=0;e.border=1;
    if(measured.scan){e.bands=1;e.bandLevel=measured.scan.level;for(let i=0;i<measured.scan.bars.length;i++)e[['band1','band2','band3'][i] as 'band1'|'band2'|'band3']=[measured.scan.bars[i][0],measured.scan.bars[i][1]] as [number,number];}
  }
  if(t>=36.23&&t<36.37){e.noise=.9;e.band1=[0,.43];e.bands=1;}
  if(t>=69.102&&t<69.386)e.noise=1;
  else if(t>=69.65&&t<70.103)e.noise=-.055;
  if(t>=70.103&&t<70.20)e.flash=1;
  return e;
}
