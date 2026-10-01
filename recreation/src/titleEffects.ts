const clamp=(v:number)=>Math.max(0,Math.min(1,v));

export interface Effect {
  tear:number; rgb:number; rgbY:number; bands:number; flash:number;
  band1:[number,number];band2:[number,number];band3:[number,number];
  chunks:number; black:number; tint:number; split:number; border:number;
  noise:number;bandLevel:number;
}
const off: [number,number]=[-2,-1];
const legacy: [number,number,number,number,number][]=[
  [13.80,14.13,.35,8,0],
];
const tearWindows: [number,number,number][]=[
  [16.55,16.75,1],[16.75,16.95,.18],
  [17.584,17.95,1],[18.28,18.38,.12],
  [19.186,19.386,1],[19.386,19.653,.16],[20.053,20.12,1],[20.12,20.25,.1],
  [21.088,21.255,.8],[21.255,21.40,.12],
  [21.989,22.089,1],[22.289,22.422,.13],[22.456,22.958,1],
  [24.491,24.558,1],[24.558,24.624,.10],[24.824,24.924,.16],
  [25.325,25.592,1],[26.760,27.561,1],[27.728,27.828,.2],[27.961,28.295,1],
];
const splitWindows: [number,number][]=[
  [19.386,19.653],[22.089,22.256],[24.658,24.892],[25.592,25.759],[27.695,27.761],
];
const colorWindows: [number,number,number,number][]=[
  [14.081,14.282,3,125],
  [17.851,17.951,3,4],[18.185,18.252,3,5],
  [19.653,19.887,2,5], [21.555,21.655,2,15], [21.722,21.889,3,12],
  [22.689,22.756,3,5],[25.859,25.993,3,11],[27.294,27.461,3,9],[27.561,27.695,3,11],
];

// Repeatable scan passes measured against source PTS, not the provisional BPM.
const scanPasses: [number,number,boolean][]=[
  [16.383,16.550,false],[17.251,17.584,true],[18.852,19.186,true],
  [20.754,21.088,true],[24.324,24.491,false],
  [24.992,25.325,true],[26.426,26.760,true],[28.295,28.629,true],
];
function pass(effect:Effect,dt:number,full:boolean) {
  effect.bands=1;effect.border=1;
  if(dt<.067){effect.band1=[.172,.483];effect.band2=[.544,.867];}
  else if(dt<.20 || !full){effect.band1=[.439,.756];effect.band2=[.811,1.13];effect.black=1;}
  else if(dt<.267){
    effect.band1=[.625,.953];effect.band2=off;effect.band3=off;
    effect.chunks=1;effect.tear=.45;effect.black=.3;
  }else{effect.band1=[0,1];effect.band2=off;effect.tear=.7;}
}
export function effectsAt(t:number):Effect {
  const effect:Effect={tear:0,rgb:0,rgbY:0,bands:0,flash:0,
    band1:off,band2:off,band3:off,chunks:0,black:0,tint:0,split:0,border:0,noise:0,bandLevel:.535};
  if(t<14){for(const[a,b,tear,rgb,bands]of legacy)if(t>=a&&t<b)Object.assign(effect,{tear,rgb,bands});return effect;}
  // The first exposure lasts through the title's first letters, until 16.5 s.
  if(t<14.148) effect.flash=clamp((14.148-t)/.2)*.43;
  if(t>=14.982&&t<16.517){
    effect.flash=clamp((253-(t-15.015)*153-16)/239);
    effect.border=clamp((16.25-t)/.5);
  }
  for(const[a,b,strength]of tearWindows)if(t>=a&&t<b)effect.tear=strength;
  for(const[a,b]of splitWindows)if(t>=a&&t<b)effect.split=1;
  for(const[a,b,x,y]of colorWindows)if(t>=a&&t<b){effect.rgb=x;effect.rgbY=y;}
  for(const[a,b,full]of scanPasses)if(t>=a&&t<b)pass(effect,t-a,full);
  if((t>=19.987&&t<20.053)||(t>=21.922&&t<21.989)){
    effect.bands=1;effect.band1=[.172,.483];effect.band2=[.528,.855];effect.border=1;
    effect.tint=t<20.1?1:0;effect.tear=.25;
  }
  if(t>=28.629&&t<28.762){
    effect.bands=1;effect.band1=[.244,.561];effect.band2=[.622,.951];effect.tear=.3;effect.border=1;
  }else if(t>=28.762&&t<28.829){effect.bands=1;effect.band1=[0,1];effect.tear=.8;effect.border=1;}
  else if(t>=28.829&&t<28.896){effect.bands=1;effect.band1=[.033,.333];effect.band2=[.394,.722];effect.black=1;effect.border=1;}
  else if(t>=28.896&&t<28.962){effect.bands=1;effect.band1=[.011,.311];effect.band2=[.922,1.22];effect.tear=1;effect.border=1;}
  else if(t>=28.962&&t<28.996){effect.tear=1;effect.black=1;}
  if(t>=28.996&&t<29.463){
    const frame=Math.floor((t-28.996)/(.1001/3));
    const positions: [number,number,number,number][]=[
      [.172,.495,.54,.88],[0,.33,.39,.74],[.57,.90,.95,1.28],[0,1,-2,-1],
      [.47,.80,.85,1.19],[.47,.80,.85,1.19],[0,1,-2,-1],[.09,.42,.46,.81],
      [.09,.42,.46,.81],[.57,.91,.95,1.29],[.34,.62,.71,1.04],[.34,.62,.71,1.04],
      [.17,.49,.54,.87],[.17,.49,.54,.87],
    ];
    const p=positions[Math.min(frame,positions.length-1)];
    effect.bands=1;effect.band1=[p[0],p[1]];effect.band2=[p[2],p[3]];
    effect.chunks=(frame===0||frame===3||frame===6)?1:0;effect.black=1;
    effect.tear=.8;effect.border=1;effect.rgb=4;
  }
  return effect;
}
