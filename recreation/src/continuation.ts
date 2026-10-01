import waveMotion from './assets/wave-motion.json';
import measuredMotion from './assets/continuation-motion.json';
import { Drawing, clamp, smooth, keys, lerp, typed } from './drawing';

type Background='gray'|'dark'|'blue'|'white'|'teal'|'red'|'yellow'|'pure';
type MotionSample={frame:number;kind?:string;vectors?:[string,number][];red?:string;veil?:number;tiles?:number[];arrows?:number[];banner?:number[];marker?:number[];strip?:number[];bg?:number[];panel?:number[];gears?:string};
const TAU=Math.PI*2;
export class Continuation extends Drawing {
  private time=0;
  private readonly motionSamples=new Map<number,MotionSample>((measuredMotion.samples as MotionSample[]).map(f=>[f.frame,f]));
  private readonly motionPaths=new Map<string,Path2D>();
  private readonly lockPath=new Path2D(measuredMotion.lock);
  private sample(t:number){return this.motionSamples.get(Math.round(t*30000/1001));}
  private tiledField(t:number){
    const tiles=this.sample(t)?.tiles;if(!tiles)return;
    for(let row=0;row<12;row++)for(let col=0;col<12;col++){
      const i=(row*12+col)*3;this.c.fillStyle=`rgb(${tiles[i]} ${tiles[i+1]} ${tiles[i+2]})`;this.c.fillRect(col*160,row*90,160,90);
    }
  }
  private motion(t:number,kind:string){
    const sample=this.sample(t);if(sample?.kind!==kind)return false;
    for(const [path,level]of sample.vectors??[]){
      let parsed=this.motionPaths.get(path);
      if(!parsed){parsed=new Path2D(path);this.motionPaths.set(path,parsed);if(this.motionPaths.size>72)this.motionPaths.delete(this.motionPaths.keys().next().value!);}
      this.c.fillStyle=`rgb(${level} ${level} ${level})`;this.c.fill(parsed,'evenodd');
    }
    if(sample.red){this.c.fillStyle='#a92a2e';this.c.fill(new Path2D(sample.red),'evenodd');}
    if(kind==='magnifier'&&t>=106.4&&t<106.94){
      const path=sample.vectors?.at(-1)?.[0];
      if(path){
        const c=this.c;c.save();c.clip(this.motionPaths.get(path)!,'evenodd');
        const palette=['#6e9c54','#a1ad6b','#97799f','#80a6a2','#7b935c','#b3aa83'];
        const frame=Math.round(t*30000/1001);
        for(let y=0;y<1080;y+=18)for(let x=0;x<1920;x+=24){
          if(Math.hypot(x-960,y-540)<180)continue;
          const n=Math.abs((x*73+y*31+frame*17)%palette.length);c.fillStyle=palette[n];c.fillRect(x,y,24,18);
        }c.restore();
      }
    }
    return true;
  }
  private readonly wavePaths=new Map(waveMotion.map(f=>[Math.round(f.time*30000/1001),{axis:f.axis,path:new Path2D(f.path)}]));
  private readonly backgrounds=new Map<string,HTMLCanvasElement>();
  private background(type:Background){
    const refined=this.time>=49.43;
    const id=`${type}:${refined}`;
    if(!this.backgrounds.has(id)){
      const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
      const ctx=canvas.getContext('2d')!,d=ctx.createImageData(1920,1080);
      const base:Record<Background,[number,number,number,number]>={gray:[18,21,25,38],dark:[8,8,8,2],blue:[7,10,36,43],white:[242,242,242,0],teal:[0,25,33,28],red:[8,0,0,64],yellow:[222,219,160,18],pure:[0,0,0,0]};
      const b=base[type];
      const precision:Partial<Record<Background,[number,number,number,number,number,number]>>={gray:[12.72,13.81,16.06,35.74,44.70,44.89],blue:[7.66,10.78,36.98,21.21,25.91,69.69],red:[-15.12,-23.24,-24.61,133.36,127.75,125.10],white:[229,229,229,13,13,13]};
      const refinedColor=refined?precision[type]:undefined;
      for(let y=0;y<1080;y++)for(let x=0;x<1920;x++){
        const g=Math.exp(-(((x-970)/930)**2+((y-535)/820)**2)*1.5),grain=((x*37+y*73)%97)/97-.5;
        const i=(y*1920+x)*4;for(let k=0;k<3;k++)d.data[i+k]=(refinedColor?refinedColor[k]+refinedColor[k+3]*g:b[k]+b[3]*g*(type==='blue'?[.22,.28,1.5][k]:1))+grain;d.data[i+3]=255;
      }ctx.putImageData(d,0,0);this.backgrounds.set(id,canvas);
    }this.c.drawImage(this.backgrounds.get(id)!,0,0);
  }
  render(t:number){
    this.time=t;
    const eventTime=t>=49.4?Math.round(t*30000/1001)*1001/30000+1e-6:t;
    const c=this.c;c.reset();c.save();c.resetTransform();c.globalAlpha=1;c.globalCompositeOperation='source-over';c.setLineDash([]);c.lineCap='butt';c.shadowBlur=0;
    if(t<33.767)this.points(t);
    else if(t<37.337)this.circle(t);
    else if(t<40.841)this.sine(t);
    else if(t<44.444)this.memory(t);
    else if(t<47.947)this.current(t);
    else if(eventTime<51.252)this.disabled(t);
    else if(eventTime<56.090)this.travel(t);
    else if(eventTime<57.457)this.unite(t);
    else if(eventTime<59.225)this.zoomText(t,'So deeply',57.457,59.225);
    else if(eventTime<64.697)this.status(t);
    else if(eventTime<66.331)this.satisfaction(t);
    else if(eventTime<67.231)this.query(t);
    else if(eventTime<68.499)this.feeling(t);
    else if(eventTime<70.103)this.execute(t);
    else if(eventTime<72.005)this.trapped(eventTime);
    else if(eventTime<74.241)this.simulation(t);
    else if(eventTime<79.208)this.transform(t);
    else if(eventTime<84.751)this.nutrients(t);
    else if(eventTime<88.923)this.existence(t);
    else if(eventTime<92.442)this.gender(t);
    else if(eventTime<95.929)this.dial(t);
    else if(eventTime<99.333)this.crown(t);
    else if(eventTime<99.933){this.background('yellow');if(!this.motion(t,'yellowRing'))this.ellipses(t,960,730,425,1);}
    else if(eventTime<101.635)this.unlock(t);
    else if(eventTime<103.504)this.zoomText(t,'The Trance',101.635,103.504);
    else if(eventTime<105.240)this.analyze(t);
    else if(eventTime<107.441)this.magnify(t);
    else if(eventTime<109.709)this.management(t);
    else if(eventTime<114.814)this.sectors(t);
    else if(eventTime<118.417)this.isolation(t);
    else this.erase(t);
    c.restore();
  }
  private points(t:number){
    const c=this.c;this.background('gray');
    if(t<30.731){
      const fill=keys(t,[[30,.84],[30.13,1]]);this.ring(960,540,350,14,'#fafafa');
      c.fillStyle='#fafafa';c.beginPath();c.moveTo(960,540);c.arc(960,540,350,-Math.PI/2,-Math.PI/2+TAU*fill);c.closePath();c.fill();
      c.save();c.clip();this.text('If, I’m',960,571,100,'#262626','center');c.restore();return;
    }
    if(t<31.465){
      const p=smooth((t-30.731)/.20);c.fillStyle='#fafafa';
      for(let x=-80;x<2000;x+=38){c.beginPath();c.arc(x,540,15*p,0,TAU);c.fill();}
      this.fitted('a set of points,',[812,453,296,51],'#f4f4f4');
      const w=1920*smooth((t-31.20)/.265);if(w>0){c.fillRect(960-w/2,519,w,43);this.text('then',960,555,48,'#181818','center');}return;
    }
    const rotation=keys(t,[[31.465,0],[32.03,-.07],[32.35,-.49],[32.70,-.52],[33.18,-.52]]);
    const px=keys(t,[[31.465,0],[32.35,-140],[32.70,152],[33.18,133]]);
    const py=keys(t,[[31.465,540],[31.85,610],[32.35,890],[32.70,500],[33.18,465]]);
    const w=keys(t,[[31.465,1920],[32.40,2100],[32.70,1500],[33.18,1540]]);
    const h=keys(t,[[31.465,38],[31.8,450],[32.35,1000],[32.70,1480]]);
    c.save();c.translate(px,py);c.rotate(rotation);
    c.fillStyle='#dedede';c.fillRect(0,0,w,h);c.strokeStyle='#fff';c.lineWidth=10;c.strokeRect(0,0,w,h);
    this.text('a set of points,',w*.445,-15,28,'#e8e8e8','center');this.text('then',w*.445,15,28,'#191919','center');
    this.text('I’ll give my',w*.445,85,60,'#171717','center');
    if(t>=32.57)this.text('DIMENTION',w*.445+28,h*.442,96,'#111','center','TitleLight');
    if(t>=32.57){c.setLineDash([30,28]);this.ring(w/2,h/2,Math.hypot(w/2,h/2),6,'#ddd');c.setLineDash([]);this.text('width=200;',-60,h*.82,75,'#eee','right');this.text('height=200;',w*.8,h+100,75,'#eee','center');}
    c.restore();
  }
  private circle(t:number){
    const c=this.c;this.background(t>=36.403?'white':'gray');
    if(t<34.37){this.spaced('If, I’m',950,630,128,27);this.line(950,665,1950-1000*smooth((t-33.767)/.15),665,18);return;}
    const r=keys(t,[[34.37,380],[34.75,420],[35.25,430],[36.3,485],[36.55,505],[37.0,460]]);
    if(t<35.18){
      c.save();c.globalAlpha=.1*(1-clamp((t-34.4)/.9));for(let i=0;i<7;i++){c.save();c.rotate(i*.025);this.cube(960,540,120+i*50,'#eee');c.restore();}c.restore();
    }
    const arc=clamp((t-34.35)/.34);this.ring(960,540,r,20,t>=36.403?'#0b0b0b':'#fafafa',-Math.PI/2+TAU*arc);
    let fill=t<35.32?keys(t,[[34.37,.035],[34.5,.08],[34.75,.76],[35.08,1]]):keys(t,[[35.32,1],[35.5,.85],[35.75,.24],[35.8,.185],[36.0,0]]);
    if(t<36.30&&fill>0){c.beginPath();c.moveTo(960,540);c.arc(960,540,r-14,-Math.PI/2,-Math.PI/2-TAU*fill,true);c.closePath();c.fillStyle='#e4e4e4';c.fill();}
    if(t<34.6)this.spaced('If, I’m',960,585,70,12,'#ddd');
    else if(t<35.10)this.spaced('a circle',960,562,56,8,t<34.92?'#f3f3f3':'#333');
    else if(t<35.6)this.text('Then',960,85,85,t>=36.403?'#111':'#aaa','center');
    else if(t<36.35)this.fitted('I’ll give my',[779,492,374,85],'#eee');
    else this.text('CIRCUMFERENCE',960,571,150,t<36.6?'#fff':'#e5e5e5','center');
    if(t>=36.57){c.save();c.globalAlpha=.45;for(let i=0;i<75;i++){const a=i*TAU/75;c.strokeStyle=`hsl(${(i*71+Math.floor(t*30)*13)%360} 95% 48%)`;c.lineWidth=10;c.beginPath();c.arc(960,540,r,a,a+.055);c.stroke();}c.restore();}
    else this.line(960,540-r-60,960,540-r-22,9,'#aaa');
  }
  private sine(t:number){
    const c=this.c;this.background(t>=40.207?'teal':'gray');
    if(t>=40.207){this.text('TANGENT',960,467,78,'#ddd','center','TitleLight');c.fillStyle='#c4efff';c.shadowColor='#8bdeee';c.shadowBlur=20;c.beginPath();c.arc(960,515,17,0,TAU);c.fill();return;}
    if(t<37.86){
      const x=keys(t,[[37.337,180],[37.54,90],[37.86,-250]]),y=keys(t,[[37.337,750],[37.54,750],[37.86,750]]);
      this.line(x,0,x,1080,20);this.line(0,y,1920*clamp((t-37.337)/.22),y,22);
      this.text(t<37.52?'if I’m':'a sine wave',x+35,y-30,120,'#eee');return;
    }
    const tracked=this.wavePaths.get(Math.round(t*30000/1001));
    const axis=tracked?.axis??keys(t,[[37.86,930],[38.0,930],[38.35,750],[38.8,700],[39.0,850],[39.4,990]]);
    const amp=keys(t,[[37.86,710],[38.4,710],[38.75,520],[39.4,440]]);
    const phase=keys(t,[[37.86,1000],[38.3,610],[38.75,-80],[39.25,390],[39.45,390]]);
    const visible=clamp((39.50-t)/.2);c.save();c.globalAlpha=visible;
    this.line(0,axis,1920,axis,22);if(t<38.66)this.fitted('a sine wave',[35,axis-122,597,94],'#ddd');
    const extent=keys(t,[[38.0,-200],[38.25,1650],[38.5,2400]]);
    for(const [offset,alpha]of [[0,1],[Math.PI,.07]]){
      if(offset===0&&tracked){c.fillStyle='#fff';c.fill(tracked.path,'evenodd');continue;}
      c.beginPath();for(let x=-250;x<=extent;x+=7){const y=axis-amp*Math.sin((x-phase)*TAU/1800+offset);if(x===-250)c.moveTo(x,y);else c.lineTo(x,y);}c.strokeStyle=`rgba(255,255,255,${alpha})`;c.lineWidth=offset?10:16;c.stroke();
    }c.restore();
    if(t>=38.72){const y=keys(t,[[38.72,350],[39.10,360],[39.42,380]]);this.text('then you can sit on all my',960,y,78,'#dcdcdc','center');this.line(540,y+5,1380,y+5,3,'#ddd');}
  }
  private memory(t:number){
    const c=this.c;this.background('gray');this.background(t<43.66?'dark':'pure');
    const percent=Math.round(keys(t,[[41.0,0],[41.15,23],[41.25,31],[41.5,42],[41.9,48],[42.25,50],[42.5,54],[42.75,64],[43.0,77],[43.25,88],[43.5,94],[43.75,100]]));
    const top=keys(t,[[40.841,1100],[41.05,900],[41.25,560],[41.5,540],[41.75,540],[41.9,435],[41.94,0],[43.66,0]]);
    const scale=keys(t,[[40.841,2.5],[43.45,2.5],[43.68,1]]);
    c.save();c.translate(960,600);c.scale(scale,scale);c.rotate(-.16);c.globalAlpha=t<43.66?.30:1;
    this.text('MEMORY',0,-100,320,t>=43.16?'#a55561':'#dedede','center','TitleLight');this.text(`${percent}%`,-95,330,600,t>=43.16?'#a55561':'#dedede','center','TitleLight');c.restore();
    if(t<41.96){c.drawImage(this.backgrounds.get('gray:false')!,0,0,1920,Math.max(1,top),0,0,1920,Math.max(1,top));this.line(0,top,1920,top,6,'#ccc');}
    const label=t<43.05?'If I approach INFINITY':'You can be my LIMITATION';
    if(t>=41.13&&t<43.67){const y=t<41.94?Math.max(510,top+121):510;this.fitted(label,[660,y,650,61],t>43.35?'#aaa':'#f9f9f9');if(t>=43.05)this.line(0,y+68,1920,y+68,3,'#ccc');}
  }
  private current(t:number){
    const c=this.c;this.background('pure');this.text('switch my current',960,535,46,'#ccc','center','TitleLight');
    this.line(645,554,1280,554,2,'#aaa');this.text('Booting...',625,560,22,'#ddd','right','TitleLight');
    this.text(t<45.25?`${Math.round(clamp((t-44.44)/.81)*100)}`:'done.',1292,560,22,'#ddd','left','TitleLight');
    if(t<45.77)return;
    const selection=t<46.68?0:1;
    c.fillStyle='#eee';c.fillRect(845,574+selection*39,200,36);
    this.text(selection===0?'To > AC':'AC',945,603,38,selection===0?'#111':'#ddd','center','TitleLight');
    if(t>=46.08)this.text(selection===1?'To > DC':'DC',945,642,38,selection===1?'#111':'#ddd','center','TitleLight');
  }
  private disabled(t:number){
    const c=this.c;const dizzy=t>=49.43;this.background(dizzy?'red':'gray');
    const dy=dizzy?0:0;c.fillStyle=dizzy?'#000':'#909090';c.fillRect(514,382+dy,904,312);c.fillStyle=dizzy?'#050505':'#b0b0b0';c.fillRect(514,382+dy,904,54);
    if(!dizzy){this.warning(52,62,70,'#425643','#171c17');this.text('Success.',90,63,55,'#49584b');c.save();c.globalAlpha=.045;this.text('Blind',966,609,430,'#000','center');c.restore();}
    this.warning(613,562,70,dizzy?'#b7b7b7':'#111',dizzy?'#000':'#939393');
    if(!dizzy){this.fitted("Variable ’me.cansee’ is disabled.",[669,543,682,40],'#101010');return;}
    this.text(dizzy?(t<50.4?'So Dizzy,':'So Dizzy, So Dizzy'):"Variable ’me.cansee’ is disabled.",690,584,dizzy?48:61,dizzy?'#2f3219':'#101010');
  }
  private banner(top:number,bottom:number,title:string,subtitle:string,alpha=1,color='#32599b'){
    const c=this.c;c.save();c.globalAlpha*=alpha;const g=c.createLinearGradient(0,0,1920,0);g.addColorStop(0,'#101b38');g.addColorStop(.5,color);g.addColorStop(1,'#101a35');c.fillStyle=this.time>=54.53&&this.time<55.64?'#0000ff':g;c.fillRect(0,top,1920,bottom-top);this.line(0,top,1920,top,5,'#ddd');this.line(0,bottom,1920,bottom,5,'#ddd');
    if(title==='Oh, We can travel'){this.fitted(title,[775,top+53,445,54],'#eee');this.fitted(subtitle,[817,top+120,363,32],'#ddd');}
    else if(title==='And, We can unite'){this.fitted(title,[656,top+60,628,73],'#eee');this.fitted(subtitle,[754,top+147,412,32],'#ddd');}
    else{this.text(title,960,top+112,80,'#eee','center','TitleLight');this.text(subtitle,960,top+179,40,'#ddd','center');}c.restore();
  }
  private travel(t:number){
    const c=this.c;
    const bg=this.sample(t)?.bg;
    if(bg){
      c.save();c.translate(970,535);c.scale(1,820/930);
      const gradient=c.createRadialGradient(0,0,0,0,0,1800);
      for(let i=0;i<=12;i++){const r=i/12*1800/930,g=Math.exp(-r*r*1.5);gradient.addColorStop(i/12,`rgb(${bg.slice(0,3).map((v,k)=>Math.max(0,Math.min(255,v+bg[k+3]*g))).join(' ')})`);}
      c.fillStyle=gradient;c.fillRect(-970,-535*930/820,1920,1080*930/820);c.restore();
    }
    else if(t>=54.31&&t<55.93){this.background('blue');c.save();c.globalAlpha=keys(t,[[54.31,0],[54.45,.10],[54.67,1],[55.46,1],[55.65,0]]);c.fillStyle='#0000ff';c.fillRect(0,0,1920,1080);c.restore();}
    else this.background(t>=53.48&&t<54.47?'red':'gray');
    const sample=this.sample(t),top=sample?.banner?.[0]??362,bottom=sample?.banner?.[1]??764;
    this.banner(top,bottom,'Oh, We can travel','Set time for timetravel',1,t>=53.48&&t<54.47?'#41385f':'#32599b');
    if(t>=55.44&&t<55.87){c.fillStyle=bg?`rgb(${bg.slice(0,3).map((v,k)=>Math.max(0,Math.min(255,v+bg[k+3]*.95))).join(' ')})`:'#0000ff';c.fillRect(0,top+3,1920,bottom-top-6);}
    const y=sample?.marker?.[1]??681;
    this.line(815,top+116,1175,top+116,4,'#eee');this.line(0,y,1920*clamp((t-51.252)/.12),y,20,'#fff');
    const x=sample?.marker?.[0]??keys(t,[[51.252,-100],[51.5,620],[51.72,780],[52.25,843],[53.16,843],[53.5,1545],[53.80,1767],[54.30,1767],[54.45,390],[54.60,62],[55.38,62],[55.60,30]]);
    const year=t<52.3?String(Math.round(keys(t,[[51.252,0],[51.7,1856],[52.0,1942],[52.3,2017]]))):t<53.17?'2017':t<54.30?String(Math.round(keys(t,[[53.17,2017],[53.66,3691]]))):'617';
    if(t>=55.44&&t<55.87)return;
    this.fitted(year,[x-45,y-104,91,48],'#ddd');this.polygon([[x-39,y-59],[x+39,y-59],[x,y-22]],'#ddd');this.line(x,y-17,x,y+24,7,'#ddd');this.fitted(t<53.34?'NOW':t<54.3?'AD':'BC',[x-32,y+31,64,26],'#eee','TitleRegular');
  }
  private unite(t:number){
    this.background('gray');const bounds=this.sample(t)?.banner,top=bounds?.[0]??keys(t,[[56.09,420],[56.4,433],[57.0,460],[57.457,460]]);this.banner(top,bounds?.[1]??top+200,'And, We can unite','<Press any button to reunite>',1-clamp((t-57.16)/.297));
  }
  private zoomText(t:number,label:string,start:number,end:number){
    const c=this.c,p=t-start,deep=label==='So deeply';
    this.background(deep?(t<58.28?'blue':'pure'):(t<102.69?'blue':'dark'));
    if((deep&&t<58.28)||(!deep&&t<102.69)){
      c.fillStyle='rgba(0,0,0,.66)';c.fillRect(0,0,1920,1080);
    }
    if(deep&&t>=58.24&&t<58.28){c.fillStyle='rgba(100,100,100,.12)';c.fillRect(0,0,1920,1080);}
    const size=deep?keys(t,[[57.457,22],[57.56,60],[57.80,105],[58.02,140],[58.17,86],[58.88,86],[59.02,173],[59.16,82],[59.225,82]]):keys(t,[[101.635,40],[101.74,108],[102.36,108],[102.49,208],[102.58,107],[103.504,107]]);
    const y=deep?keys(t,[[57.457,540],[57.9,591],[58.17,610],[59.225,610]]):610;
    const pulse=deep?t>=58.91&&t<59.16:t>=102.14&&t<102.62;
    if(pulse){
      const q=deep?(t-58.91)/.25:(t-102.14)/.48;
      c.save();c.globalAlpha=deep?.17:.18;
      for(let i=-3;i<=3;i++)this.text(label,960+i*15*(1-q),y,deep?size*1.15:keys(q,[[0,800],[.5,1700],[.75,540],[1,107]]),'#ccc','center','TitleLight');
      c.restore();
    }
    c.save();c.globalAlpha=1-clamp((t-end+.04)/.04);this.text(label,960,y,size,'#d2d2d2','center','TitleLight');c.restore();
  }
  private status(t:number){
    const c=this.c;this.background(t<61.95?'pure':'dark');
    if(t>=61.88){
      c.save();c.globalAlpha=t>=62.46?.20:1;this.text('STIMULATION',710,526,48,'#eee','left','TitleLight');this.bar(710,540,500,1);this.text('Level | 100%',1210,641,29,'#777','right');c.restore();
      if(t>=62.46){
        for(let i=0;i<3;i++){const start=62.46+i*.23;if(t<start)continue;const alpha=this.sample(t)?.arrows?.[i]??clamp((t-start)/.17);c.save();c.globalAlpha=alpha;const x=552+i*280;this.polygon([[x,382],[x,730],[x+228,556]],'#fff');c.restore();}
      }return;
    }
    const border=smooth((t-60.010)/.038);if(border){c.strokeStyle='#ddd';c.lineWidth=5;c.strokeRect(620,34,688*border,1012*border);}
    if(t>=60.10){
      const p=clamp((t-60.1)/.25);this.line(620,155,620+688*p,155,4);this.line(620,286,620+688*p,286,4);this.line(785,155,785,286,4);
      this.text(typed('showStatus(me);',t-60.29,50),655,115,66,'#fff','left','TitleRegular');
      if(t>=60.4){this.text('Name',645,209,54);this.text('God',812,209,54);this.text('Race',645,265,54);this.text('Administrator',812,265,54);}
      this.bar(710,359,Math.max(1,500*clamp((t-60.2)/.36)),(t-60.26)/1.10);
    }
    const w=500*(1-(1-clamp((t-59.225)/.50))**3);this.text(typed('If I can,',t-59.2,15),703,520,65);this.bar(710,535,Math.max(1,w),clamp((t-59.2)/1.0)*.65);
    if(t>=60.41){this.text(typed('give you all the',t-60.4,12),703,679,64,'#eee','left','TitleRegular');this.bar(710,697,Math.max(1,450*clamp((t-60.4)/.25)),.10);}
    if(t>=60.01){this.text(typed('If I can',t-60.0,13),703,847,65);this.bar(710,863,Math.max(1,500*clamp((t-60.0)/.53)),clamp((t-60.0)/1.6)*.70);}
    if(t>=61.508&&t<61.642){c.fillStyle='#000';c.fillRect(0,0,1920,1080);this.bar(710,540,500,1);}
    if(t>=61.642){const dy=keys(t,[[61.642,0],[61.73,118],[61.83,460],[61.95,1400]]);c.save();c.fillStyle='#000';c.fillRect(0,0,1920,1080);c.translate(0,dy);c.strokeStyle='#ccc';c.lineWidth=4;c.strokeRect(620,34,688,1012);this.text('showStatus(me);',655,115,66,'#eee','left','TitleRegular');this.line(620,155,1308,155,4);this.line(620,286,1308,286,4);this.line(785,155,785,286,4);this.text('Name',645,209,54);this.text('God',812,209,54);this.text('Race',645,265,54);this.text('Administrator',812,265,54);this.bar(710,359,500,1);this.text('If I can,',703,520,65);this.bar(710,535,500,.65);this.text('give you all the',703,679,64,'#eee','left','TitleRegular');this.bar(710,697,450,.1);this.text('If I can',703,847,65);this.bar(710,863,500,.65);c.restore();}
  }
  private satisfaction(t:number){
    const c=this.c;this.background('dark');
    c.save();c.globalAlpha=1-clamp((t-65.42)/.62);this.text('Be your only',960,602,155,'#eee','center','TitleLight');c.restore();
    if(t<65.16){for(let i=0;i<3;i++){c.save();c.globalAlpha=this.sample(t)?.arrows?.[i]??1-clamp((t-64.70)/.46);const x=550+i*280;this.polygon([[x,382],[x,730],[x+228,556]],'#fff');c.restore();}}
    if(t>=65.25){const p=smooth((t-65.25)/.42);c.save();c.globalAlpha=p;this.text('SATISFACTION',742,526,42,'#eee','left','TitleLight');this.bar(742,541,435,1,62);this.text('Level | 100%',1177,635,26,'#777','right');c.restore();}
  }
  private query(t:number){this.background('dark');this.text('If, I can make you',960,535,57,'#ddd','center','TitleLight');this.line(640,555,1280,555,2,'#aaa');this.text(typed("Get Feeling index of ’You’",t-66.33,35),960,594,28,'#777','center');}
  private feeling(t:number){
    const c=this.c;this.background('dark');if(t>68.22)return;
    const alpha=clamp((t-67.231)/.42);c.save();c.globalAlpha=alpha;
    this.text(typed('Feeling Index',t-67.20,33),38,114,88,'#eee','left','TitleRegular');this.line(560,36,560,134,7);this.text('object',578,73,58);this.text('You',578,124,58);this.line(0,153,1920,153,3,'#ddd');this.line(965,153,965,1080,3,'#ddd');
    const left=['Delighted','Glad','Clam','Peaceful','Thrilled','Loving','Brave','Happy','Curious','Excited'];
    const right=['Depressed','Hateful','Confused','Fearful','Empty','Pained','Bad','Nervous','Sad','Indifferent'];
    for(let i=0;i<10;i++){
      const value=left[i]==='Happy'&&t>=67.65?1:0;
      if(i===7&&t<67.94){c.fillStyle='#eee';c.fillRect(22,811,414,68);this.text(`Happy = ${value};`,36,854,64,'#111');this.text('<',414,854,64,'#111','right');}
      else this.text(typed(`${left[i]} = ${value};`,t-67.231-i*.007,45),36,235+i*90,64,'#ddd');
      this.text(typed(`${right[i]} = ${i===2||i===4?1:0};`,t-67.38-i*.005,45),1900,235+i*90,64,'#ddd','right');
    }
    c.save();c.translate(903,161);c.rotate(Math.PI/2);this.text('Pleasant',0,0,77);c.restore();
    c.save();c.translate(1025,1065);c.rotate(-Math.PI/2);this.text('Unpleasant',0,0,77);c.restore();c.restore();
  }
  private execute(t:number){
    const c=this.c;this.background('dark');const index=t<68.77?0:t<69.40?1:2;const labels=['I will','Run','The'];
    if(t>=69.47&&t<69.55)return;
    if(t<69.386){
      for(let i=0;i<3;i++){const y=536+i*70;if(i===index){c.fillStyle='#eee';c.fillRect(898,y-56,244,68);}this.text(labels[i],915,y,64,i===index?'#111':'#555');if(i===index)this.text('<',1130,y,58,'#111','right');}
    }else{
      const scale=keys(t,[[69.386,2.0],[69.60,2.0],[69.75,1.2],[70.003,.55],[70.103,.5]]);
      c.save();c.translate(keys(t,[[69.386,1780],[69.60,1780],[69.75,1440],[70.003,960]]),keys(t,[[69.386,200],[69.60,440],[69.75,590],[70.003,670]]));c.rotate(-.3);c.scale(scale,scale);this.text('[EXECUTION]',0,70,270,'#ed0000','center','TitleRegular');c.restore();
      if(t<69.64){c.fillStyle='#e10000';c.fillRect(0,860,1920,220);c.fillStyle='#eee';c.fillRect(0,860,412,116);this.text('The      <',25,948,110,'#a00');}
      else{this.text('I will',680,560,56,'#ddd');this.text('Run',680,625,56,'#ddd');}
    }
  }
  private trapped(t:number){
    const c=this.c;
    if(t<71.004){
      if(t<70.20){this.background('white');return;}this.background('dark');
      const scale=keys(t,[[70.20,1.8],[70.42,1.14],[70.59,1.0],[70.95,1.0]]);
      c.save();c.fillStyle=`rgba(255,255,255,${this.sample(t)?.veil??.24*(1-clamp((t-70.2)/.4))})`;c.fillRect(0,0,1920,1080);c.restore();
      this.shield(960,540,320*scale,'#f1f1f1','#888');
      this.text('> Lock object (me)\n',0,39,38,'#ccc');this.text('> Lock object (you)',0,79,38,'#ccc');this.text('> Restart simulation...',0,119,38,'#ccc');
      this.text('Though',960,525,70,'#111','center','TitleLight');if(t>=70.47)this.text('We',960,590,70,'#111','center','TitleLight');if(t>=70.68)this.text('are',960,652,70,'#111','center','TitleLight');return;
    }
    this.background('pure');c.fillStyle='#fff';c.fillRect(20,20,1900,1060);
    const frame=Math.round(t*29.97003);if([2128,2130,2131,2152,2154,2155].includes(frame)){c.fillStyle=frame===2128?'#cecece':'#fff';c.fillRect(0,0,1920,1080);return;}
    c.save();c.translate(785,470);c.rotate(.30);
    this.shield(0,0,500,'#000','#fff');
    c.font='145px TitleThin';const width=c.measureText('TRAPPED').width;
    for(let row=-10;row<10;row++)for(let col=-5;col<6;col++)this.text('TRAPPED',col*width,65+row*154,145,'#888','center');
    this.text('TRAPPED',0,65,147,'#fff','center','TitleRegular');
    c.save();c.beginPath();c.arc(0,-8.7,59,0,TAU);c.moveTo(-35,31);c.lineTo(35,31);c.lineTo(66,147);c.lineTo(-66,147);c.closePath();c.clip();
    this.text('TRAPPED',0,65,147,'#000','center','TitleRegular');c.restore();c.restore();
  }
  private simulation(t:number){
    const c=this.c;this.background('dark');const late=t>=72.47,only=t>=73.02;
    const x=960,y=only?540:late?500:560;
    this.cube(x,y,103,only||late?'#272727':'#ddd');
    this.text(only?'simulation':late?'strange simulation':'in this strange',x,only?570:late?675:415,64,only?'#ccc':'#bbb','center','TitleLight');
  }
  private transform(t:number){
    const c=this.c;this.background('dark');
    if(t<74.841){
      const progress=clamp((t-74.24)/.50);this.motion(t,'processor');this.line(745,556,1175,556,4,'#ccc');this.line(748,556,748+423*progress,556,12,'#ddd');this.text('Transforming to Eggplant',960,598,24,'#aaa','center');return;
    }
    if(this.motion(t,'food')){
      if(t>=74.94&&t<77.42){
        c.save();c.globalAlpha=clamp((t-74.94)/.17);
        this.line(440,557,744,557,3,'#bbb');this.line(744,557,820,635,3,'#bbb');this.fitted('Then I will give',[440,520,212,30],'#aaa');c.restore();
        if(t>=75.61){c.save();c.globalAlpha=clamp((t-75.61)/.17);this.line(1100,557,1168,651,3,'#bbb');this.line(1168,651,1450,651,3,'#bbb');this.fitted('you my NUTRIENTS',[1180,619,275,29],'#aaa');c.restore();}
      }
      if(t>78.13&&t<78.42){for(let i=0;i<3;i++){const a=-Math.PI/2-i*.45;this.line(880+Math.cos(a)*65,325+Math.sin(a)*65,880+Math.cos(a)*110,325+Math.sin(a)*110,8,'#aaa');}}
      return;
    }
    if(t<78.58){
      const y=keys(t,[[74.841,430],[77.75,430],[78.05,700],[78.35,1060],[78.58,690]]);const fill=t<75.40?0:t<75.98?clamp((t-75.4)/.58):t<77.63?1:1-clamp((t-77.63)/.33);
      c.strokeStyle='#ddd';c.lineWidth=5;c.strokeRect(820,y,280,280);c.fillStyle='#eee';c.fillRect(824,y+280*(1-fill),272,276*fill);
      c.save();c.beginPath();c.rect(824,y+4,272,272);c.clip();this.referenceIcon('eggplant',0,y-430,'#eee');c.save();c.beginPath();c.rect(824,y+280*(1-fill),272,280*fill);c.clip();this.referenceIcon('eggplant',0,y-430,'#050505');c.restore();c.restore();
      if(t>=75.10&&t<77.42){const p=clamp((t-75.1)/.23);c.save();c.globalAlpha=p;this.line(440,545,744,545,3,'#bbb');this.line(744,545,820,622,3,'#bbb');this.line(1100,545,1168,641,3,'#bbb');this.line(1168,641,1450,641,3,'#bbb');this.fitted('Then I will give',[440,507,263,30],'#aaa');this.fitted('you my NUTRIENTS',[1180,608,275,29],'#aaa');c.restore();}
      if(t>78.13&&t<78.42){for(let i=0;i<3;i++){const a=-Math.PI/2-i*.45;this.line(880+Math.cos(a)*65,325+Math.sin(a)*65,880+Math.cos(a)*110,325+Math.sin(a)*110,8,'#aaa');}}return;
    }
    c.strokeStyle='#ccc';c.lineWidth=4;c.strokeRect(820,430,280,280);this.referenceIcon('tomato');
  }
  private nutrients(t:number){
    const c=this.c;this.background('dark');
    const base=keys(t,[[79.208,708],[84.751,708]]),lineWidth=keys(t,[[79.208,0],[79.50,260],[79.80,680],[79.95,770]]);this.line(960-lineWidth/2,base,960+lineWidth/2,base,4,'#bbb');
    if(t>=79.95&&this.motion(t,'nutrients')){
      if(t<80.40)this.spaced('I will give you',960,base+34,28,11,'#777');
      else if(t<81.48)this.spaced('ANTIOXIDENTS',960,base+36,28,8,'#aaa');
      if(t>=81.43&&t<83.05){const x=keys(t,[[81.43,190],[81.95,700],[82.35,810]]);this.fitted(t<82.36?'If, I’m':'a Tabby cat',[t<82.36?x+100:899,base+14,t<82.36?98:143,30],'#999');}
      if(t>=83.04)this.fitted('Then, I will purr for',[854,base+29,233,31],'#bbb');
      if(t>=83.93){c.save();c.globalAlpha=clamp((t-83.93)/.18);if(t>=84.11){c.translate(852,699);c.rotate(-.34);this.text('You liked this.',0,0,85,'#eee');}c.restore();}
      return;
    }
    if(t<80.23){this.spaced(t<79.40?'Then':'I will give you',960,base+34,28,11,'#777');if(t<79.95)return;}
    const catPhase=t>=81.35;
    const cupShift=keys(t,[[79.95,0],[81.25,0],[82.4,265]]),cupAlpha=t<83.0?1:1-clamp((t-83.0)/.35);
    c.save();c.globalAlpha=cupAlpha;const sx=t<80.14?clamp((t-79.95)/.19):1;c.translate(960+cupShift,base);c.scale(sx,1);this.icon('cup',-80,-232,160,232);c.restore();
    if(t>=80.4&&t<81.7){this.spaced('ANTIOXIDANTS',960+cupShift,base+36,34,11,'#aaa');for(let i=0;i<3;i++){const p=((t-80.4)*1.8+i*.31)%1;this.ring(930+cupShift+i*27,base-240-p*125,9+i*4,2,`rgba(220,220,220,${.30*(1-p)})`);}}
    if(catPhase&&t<83.10){
      const x=keys(t,[[81.35,140],[81.65,480],[82.05,735],[82.45,812],[83.10,812]]);
      const alpha=clamp((t-81.35)/.6);c.save();c.globalAlpha=alpha;this.icon('catWalk',x,base-216,270,216);c.restore();
      this.fitted(t<82.36?'If, I’m':'a Tabby cat',[t<82.36?915:899,base+14,t<82.36?98:143,30],'#999');
    }
    if(t>=83.04){c.save();c.globalAlpha=clamp((t-83.04)/.14)*(t>=83.93?.42:1);this.icon('catSit',864,base-215,194,226);c.restore();this.fitted('Then, I will purr for',[854,base+29,233,31],'#bbb');
      if(t>=83.14&&Math.floor((t-83.14)*4)%3!==1){for(let i=0;i<3;i++){const a=-1.23+i*.45;this.line(1060+Math.cos(a)*40,485+Math.sin(a)*40,1060+Math.cos(a)*70,485+Math.sin(a)*70,4,'#ddd');}}
    }
    if(t>=83.93){const p=clamp((t-83.93)/.18);c.save();c.globalAlpha=p;this.referenceIcon('thumb');if(t>=84.11){c.translate(852,699);c.rotate(-.34);this.text('You liked this.',0,0,85,'#eee');}c.restore();}
  }
  private existence(t:number){
    const c=this.c;
    if(t>=88.689){this.background('blue');this.tiledField(t);this.icon('combined',780,380,380,365,'#eee');return;}
    this.background(t<85.15?'gray':'white');this.tiledField(t);this.spaced('settingworldV6_12.exe',960,408,55,27,'#777');
    if(t<88.13){c.save();c.globalAlpha=.18;this.chip(960,567,380,'#999');c.restore();}
    if(t<86.94){this.text('If I’m the only god,',960,615,55,'#333','center','TitleLight');this.spaced('AccessAdministrator',960,825,60,24,'#888');}
    else if(t<88.13){this.text('Then you’re the proof of my',960,615,55,'#333','center','TitleLight');this.spaced('TypeKey',960,825,60,20,'#888');this.spaced(typed('YOU',t-87.3,8),960,897,60,20,'#666');}
    else{this.referenceIcon('angel',0,0,'#fff');this.spaced('EXISTENCE',960,813,51,27,'#777');}
  }
  private gender(t:number){
    const c=this.c;this.background('blue');const p=smooth((t-88.923)/.22);const dx=(1-p)*350;
    c.fillStyle='#eee';c.fillRect(788,410,330*p,60);if(p>.6)this.fitted('Configuration',[826,416,260,45],'#111');
    if(!this.motion(t,'gender')){this.referenceIcon(t<90.44||t>=91.43?'femaleOutline':'femaleFilled',-dx,0);this.referenceIcon(t>=91.43?'maleFilled':'maleOutline',dx,0);}
    const label=t<90.18?'SWITCH MY GENDER':t<91.17?'CHANGE TO FEMALE':'CHANGE TO MALE';this.spaced(label,960,603,48,23,'#566491');
    if(t>=92.18){c.save();c.globalAlpha=clamp((t-92.18)/.26);this.ring(960,540,320,3,'#bbb');c.restore();}
  }
  private dial(t:number){
    const c=this.c;this.background('blue');const r=keys(t,[[92.442,320],[93.1,320],[94.0,355],[94.5,367],[95.92,390]]);
    if(this.motion(t,'dial')){
      if(t<93.13){c.save();c.globalAlpha=1-clamp((t-92.88)/.25);this.spaced('DO WHATEVER',973,587,52,38,'#4b5484');c.restore();}
      if(t>=94.10){const percentage=keys(t,[[94.1,0],[94.28,15],[94.5,30],[94.8,34],[95.14,35],[95.25,77],[95.57,90],[95.89,100]]);this.text(`${Math.floor(percentage)}%`,973,591,28,'#8990a9','center');}
      return;
    }
    c.save();c.translate(973,577);const angle=keys(t,[[92.442,-Math.PI/2],[94.08,-Math.PI/2],[94.36,.02],[95.15,.06],[95.27,-2.0],[95.5,-Math.PI/2]]);c.rotate(angle);c.translate(-973,-577);this.referenceIcon('combined');c.restore();
    if(t<93.2){const outer=320+1800*clamp((t-92.5)/.67);this.ring(973,577,outer,5,`rgba(220,220,220,${.3*(1-clamp((t-92.5)/.7))})`);this.spaced('DO WHATEVER',973,562,52,38,'#4b5484');}
    this.ring(973,577,r,4,'#e0e0e0');
    const tickCount=Math.floor(100*clamp((t-92.96)/.75));for(let i=0;i<tickCount;i++){const a=-Math.PI/2+i*TAU/100;this.line(973+Math.cos(a)*(r-43),577+Math.sin(a)*(r-43),973+Math.cos(a)*(r-17),577+Math.sin(a)*(r-17),2,'#8e96b3');}
    if(t>=94.10){const progress=keys(t,[[94.1,0],[94.5,.20],[94.92,.29],[95.15,.31],[95.3,.77],[95.58,.9],[95.86,1]]);this.ring(973,577,r-22,40,'#eee',-.75+progress*TAU,-.75);this.ring(973,577,200*clamp((t-94.18)/.25),2,'#737a9d',.75,-.75);this.text(`${Math.floor(progress*100)}%`,973,551,28,'#8990a9','center');}
  }
  private ellipses(t:number,x:number,y:number,r:number,alpha=1){
    const c=this.c;c.save();c.globalAlpha*=alpha;
    for(const [offset,width,ry,color]of [[0,9,20,'#eee'],[32,2,20,'#888'],[-55,1,17,'#39436f'] ]as [number,number,number,string][]){c.beginPath();c.ellipse(x,y+offset,r+(offset===32?15:0),ry,0,0,TAU);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
    c.restore();
  }
  private crown(t:number){
    const c=this.c;this.background('blue');
    if(this.motion(t,'crown'))return;
    if(t<96.23){const p=smooth((t-95.929)/.3);c.save();c.translate(960,700);c.scale(1,1-p*.9);this.ring(0,0,390,28,'#eee');this.icon('combined',-140,-145,280,285);c.restore();return;}
    const y=keys(t,[[96.23,530],[96.7,620],[97.16,655],[97.5,655],[97.7,635],[98.0,535],[98.9,535],[99.2,535]]);this.ellipses(t,975,y,425);
    const cy=keys(t,[[96.23,-150],[96.5,78],[96.95,430],[97.3,449],[97.5,441],[97.70,385],[98.0,315],[98.9,312],[99.2,330]]);this.icon('crown',855,cy,270,130);
    if(t<97.68){c.save();c.globalAlpha=.15;const big=keys(t,[[96.3,800],[97.0,600],[97.45,1800]]);c.beginPath();c.ellipse(975,y-150,big,60,0,0,TAU);c.strokeStyle='#d0d0e0';c.lineWidth=3;c.stroke();c.restore();}
    if(t>=97.73){
      const phase=clamp((t-98.55)/.35);c.save();c.translate(975,820);c.rotate(lerp(-.76,0,phase));c.scale(.78,1);
      for(let i=0;i<2;i++){const yy=-100+i*83;this.line(-100,yy,100,yy+83,8);this.line(100,yy,-100,yy+83,8);for(const xx of [-100,100])this.ring(xx,yy,12,3,'#eee');}
      this.ring(-100,66,12,3,'#eee');this.ring(100,66,12,3,'#eee');c.restore();
    }
  }
  private unlock(t:number){
    const c=this.c;this.background('blue');c.fillStyle='rgba(110,103,222,.14)';c.fill(this.lockPath,'evenodd');
    if(t>=100.24){
      const p=smooth((t-100.24)/.27);
      if(t<100.58){this.line(960-880*p,592,960+880*p,592,3,'#ccc');return;}
      const bounds=this.sample(t)?.banner,top=bounds?.[0]??keys(t,[[100.58,580],[100.85,496],[101.35,496],[101.635,500]]),bottom=bounds?.[1]??top+185;
      this.banner(top,bottom,'So, We can Enter','<Press any key to access trance mode>',clamp((t-100.58)/.26),'#42456c');
    }
  }
  private analyze(t:number){this.background('dark');this.text("Analyze ’vibration’ of ’you’",960,560,37,'#ccc','center','TitleLight');this.line(730,585,1190,585,2,'#bbb');}
  private magnifier(x:number,y:number,r:number,alpha=1){const c=this.c;c.save();c.globalAlpha*=alpha;this.ring(x,y,r,r*.23,'#eee');this.line(x+r*.78,y+r*.78,x+r*1.85,y+r*1.85,r*.25,'#eee');c.restore();}
  private magnify(t:number){
    this.background('dark');const c=this.c;
    if(this.motion(t,'magnifier')){if(t<105.51){const y=keys(t,[[105.24,880],[105.38,1014],[105.45,1070],[105.51,1130]]);this.text("Analyze ’vibration’ of ’you’",960,y,37,'#ccc','center','TitleLight');this.line(730,y+25,1190,y+25,2,'#bbb');}return;}
    const x=keys(t,[[105.24,960],[105.46,960],[105.70,740],[106.13,590],[106.50,960],[106.95,960],[107.441,960]]),y=keys(t,[[105.24,390],[105.46,540],[105.70,458],[106.13,510],[106.50,630],[106.95,540],[107.441,540]]);
    const r=keys(t,[[105.24,26],[106.94,36],[107.10,45],[107.25,220],[107.441,1500]]);this.magnifier(x,y,r);
    const rr=keys(t,[[105.24,120],[105.5,0],[105.76,180],[106.15,240],[106.40,0],[106.5,300],[106.85,390],[106.96,0]]);if(rr>0)this.ring(960,600,rr,t>=106.43?22:3,t>=106.43?'#7b967b':'#b8b8b8');
    if(t>107.18&&t<107.40){c.save();c.globalAlpha=.6;this.icon('gearPair',840,410,240,205);c.restore();}
  }
  private management(t:number){
    const c=this.c;this.background('dark');
    if(t<108.176){if(this.motion(t,'magnifier'))return;this.referenceIcon('gearPair');return;}
    const sample=this.sample(t),panel=sample?.panel??[0,375,1920,705];
    if(t<108.30)this.referenceIcon('gearPair');
    c.save();c.beginPath();c.rect(panel[0],panel[1],panel[2]-panel[0],panel[3]-panel[1]);c.clip();c.fillStyle='#f0f0f0';c.fillRect(0,0,1920,1080);
    if(sample?.gears){c.fillStyle='#0b0b0b';c.fill(new Path2D(sample.gears),'evenodd');}
    const x=keys(t,[[108.176,170],[108.38,30],[108.52,0],[109.56,0],[109.65,-340],[109.744,-1550]]);
    c.translate(x,0);this.line(605,445,605,654,6,'#101010');
    const p=clamp((t-108.48)/.25);if(p>0)this.fitted('Simulation Management System',[639,470,875*p,59*p],'#080808');
    this.text(typed("Type Password to log in - Feeling Identified : ’Completion’",t-108.32,87),638,581,37,'#333');this.text(typed('Rendering Camera Main 0',t-108.92,42),638,631,37,'#333');
    if(t>=109.48)this.polygon([[1850,523],[1850,575],[1892,549]],'#111');c.restore();
  }
  private sectors(t:number){
    const c=this.c;this.background('dark');
    if(this.motion(t,'sectors')){
      const bounds=this.sample(t)?.strip,y=bounds?.[0]??397;
      if(t<110.04){
        const shift=keys(t,[[109.709,-460],[109.80,-1230],[109.91,-1860],[110.04,-2400]]);
        c.save();c.globalAlpha=.3;c.translate(shift,0);c.scale(1.6,1);
        for(const dx of [-18,0,18])this.fitted('Simulation Management System',[639+dx,470,875,59],'#080808');
        c.restore();
      }
      const sector=t<112.31?'001':t<113.28?'002':'003';
      if(t>=111.43){this.spaced(`Sector ${sector}`,960,y-70,145,18,'#252525');}
      if(t>114.0){for(let i=0;i<4;i++){c.save();c.translate(960,y-20+170*i);c.rotate(i===0?.14:0);this.spaced(['SectO+132','sECTOR ??','Sector 99','Sector 00'][i],0,0,135,18,'#171717');c.restore();}}
      return;
    }
    const y=keys(t,[[109.744,397],[110.8,397],[111.1,410],[112.2,442],[113.4,475],[113.8,455],[114.5,1080]]),h=280;
    c.save();c.beginPath();c.rect(0,y,1920,h);c.clip();c.fillStyle='#ececec';c.fillRect(0,y,1920,h);
    const shift=-((t-109.744)*550)%328;for(let x=shift-320;x<2250;x+=328)this.door(x+73,y+11,153,258);
    if(t>111.36&&Math.floor(t*30)%7<3){const strips=[44,132,210];for(let i=0;i<3;i++){c.fillStyle='#171717';c.fillRect((Math.floor(t*17)*83+i*241)%1920,y+strips[i],180,28);}}
    if(t>113.13){for(let row=0;row<9;row++)for(let col=0;col<50;col++){const v=Math.sin((row*61+col*23+Math.floor(t*30))*13.23);if(v>.15){c.fillStyle=v>.55?'#111':'#eee';c.fillRect(col*40,y+row*31,40,31);}}}
    c.restore();
    const sector=t<112.31?'001':t<113.28?'002':'003';if(t>=111.43){this.spaced(`Sector ${sector}`,960,y-70,145,18,'#252525');this.ban(960,y-120,100,.52);}
    if(t>114.0){for(let i=0;i<4;i++)this.spaced(['Sector 132','sECTOR ??','Sector 99','Sector 00'][i],960,y-20+170*i,135,18,'#171717');}
    this.ban(960,y+140,100,keys(t,[[110.32,0],[110.5,.1],[111,.6],[111.43,.78]]));
  }
  private isolation(t:number){
    const c=this.c;this.background('dark');if(t<115.43)return;
    if(this.motion(t,'isolation'))return;
    const y=keys(t,[[115.43,880],[115.9,400],[116.3,395],[116.9,438],[117.26,500],[117.58,1020],[117.78,1360]]);
    c.fillStyle='#ededed';c.fillRect(851,y,229,281);this.door(890,y+11,153,258);
    if(t>=116.35)this.ban(965,keys(t,[[116.35,578],[117.3,578],[117.5,540]]),102,t<116.55?clamp((t-116.35)/.2):t>=117.87?1-clamp((t-117.87)/.4):1);
  }
  private erase(t:number){
    const c=this.c;this.background('dark');const w=keys(t,[[118.417,0],[118.49,128],[118.75,222],[119.14,234],[119.55,234],[119.86,790],[120,800]]),h=keys(t,[[118.417,0],[118.49,128],[118.75,222],[119.15,234],[119.7,258]]);
    c.fillStyle='#f5f5f5';c.fillRect(954-w/2,544-h/2,w,h);
    if(t<119.18){this.text('If I can',960,561,60,'#333','center','TitleLight');return;}
    c.fillStyle='#050505';const x=keys(t,[[119.18,886],[119.56,886],[119.86,625],[120,608]]),y=465;c.fillRect(x,y+43,120,148);c.fillRect(x-12,y+22,144,30);c.fillRect(x+33,y,54,26);
    if(t>=119.65){c.fillStyle='#b7b7b7';c.fillRect(960-w/2,540-h/2,w,28);this.fitted('Erase All the Memories',[x+174,528,475,46],'#171717');this.line(x+185,595,x+600,595,6,'#444');}
  }
}
