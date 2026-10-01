import measured from './assets/finale-motion.json';
import refinement from './assets/finale-refinement.json';
import segment from './assets/segment-145-170.json';
import { Drawing, clamp, smooth, keys, typed } from './drawing';
import type { Effect } from './titleEffects';

type Sample={frame:number;kind?:string;vectors?:[string,number][];bars?:number[][];level?:number;tiles?:boolean;gridMask?:string;flash?:boolean};
const samples=new Map<number,Sample>((measured.samples as Sample[]).map(s=>[s.frame,s]));
type Refinement={frame:number;feeling?:{panel:number[];rows:(number|string)[][]};illegal?:[string,string][];binary?:number[][];stable?:[string,number,number,number][];gridMask?:string;whiteGrid?:string;grayGrid?:string;disk?:number[];search?:number[];question?:{box:number[];layers:[string,number][]};networkWire?:string;networkTiles?:boolean;heartDust?:[string,number][];heartColor?:[string,string][];exit?:{box:number[];silhouette:string};noiseMean?:number[];darkBg?:number[];erasePanel?:number[];stableField?:string;stableRules?:string;brokenStable?:[string,number][];stableFields?:[string,number[]][];creditBands?:number[][];creditNoise?:number[];creditCuts?:string};
const refinements=new Map<number,Refinement>((refinement.samples as Refinement[]).map(s=>[s.frame,s]));
type Segment={frame:number;consoleChars?:number[];consoleColor?:number[];terminalInk?:[string,string][];redDust?:[string,string][];cards?:number[][];dots?:number[][];loadLines?:number[][];loadLabel?:number[];stableBackdrop?:[string,number][];stableGlyphs?:[string,number][];stableWords?:number[][];captions?:number[][];noiseBands?:number[][][];noiseCuts?:string;noiseRegions?:[string,string][];gridFields?:[string,number][];gridPresence?:string;gridRule?:number[];gridCaption?:number[];gridCube?:[string,number][];clockDisks?:number[][]};
const segments=new Map<number,Segment>((segment.samples as Segment[]).map(s=>[s.frame,s]));
// Cut times are documented to milliseconds; include the rounding half-width
// so a source PTS rounded upward does not shift its scene by one whole frame.
const sourceTime=(t:number)=>Math.round(t*30000/1001)*1001/30000+.000501;
const hash=(n:number)=>{const v=Math.sin(n*127.1+19.19)*43758.5453;return v-Math.floor(v);};
const leftCredits=[
 '‘Cat’ 6725 Marco Hernandez','‘Database’ 9658 Shmidt Sergey','‘Thumbs Up’ 343589 Viktor Vorobyev',
 '‘Folder’ 16241 Geovani Almeida','‘Laces’ 26438 Jasper Reyes','‘Wand’ 103934 Santiago Arias',
 '‘Trash Can’ 151073 bmjinjeff','‘Warning’ 185139 Anton Gajdosik','‘Microchip’ 186110 Anton Gajdosik',
 '‘Gender’ 192426 isaac claramunt (Transformed)','‘Prohibited’ 193595 Nikita Kozin','‘Exit’ 22452 Arthur Shlain',
 '‘Eggplant’ 246407 www.yugudesign.com','‘Lemonade’ 379485 Creative Stall','‘Tomato’ 407266 Nikita Kozin',
 '‘Secure’ 534769 Shmidt Sergey','‘Couple’ 570658 Ben Iconator','‘Angel’ 583048 Hea Poh Lin',
 '‘Stop’ 778861 lien','‘Gears’ 718805 il Capitano',
];
const rightCredits=[
 '‘Unlock’ 588454 ProSymbols','‘3D Box’ 589628 Hea Poh Lin','‘Time Return’ 592187 hans draiman',
 '‘INI File Extension’ 624541 AlfredoCreates.com','‘Cat’ 634488 Jacqueline Fernandes',
 '‘Shield Keyhole’ 638418 Travis Avery','‘Crown’ 639925 Jacqueline Fernandes','‘Power’ 658653 Hector',
 '‘Info’ 742310 Shastry','‘Exit’ 802399 Tawny Whatmore','‘Check’ Mark 711437 Kimmi Studio',
 '‘Question’ 727761 unlimicon','‘Heart Made Of Triangles’ 350284 Mike Polak','‘Spider’ 731569 Arthur Shlain',
 '‘Case Study’ 739669 Setyo Ari Wibowo','‘Trap’ 85570 Luis Prado (Transformed)',
 '‘Search’ 856435 i cons','‘Door’ 782087 zidney','‘Key’ 90731 B Barrett',
];

export class Finale extends Drawing {
  private time=120;
  private readonly geometry=new Map<string,Path2D>();
  private readonly backgrounds=new Map<string,HTMLCanvasElement>();
  private readonly movingBackgrounds=new Map<number,HTMLCanvasElement>();
  private readonly pixelTitle=document.createElement('canvas');
  private readonly blank=(()=>{const d=this.c.createImageData(1920,1080);for(let i=3;i<d.data.length;i+=4)d.data[i]=255;return d;})();
  private sample(){return samples.get(Math.round(this.time*30000/1001));}
  private segment(){return segments.get(Math.round(this.time*30000/1001));}
  private refined(){return refinements.get(Math.round(this.time*30000/1001));}
  private gray(layers:[string,number][]=[]){for(const[p,v]of layers)this.path(p,`rgb(${v} ${v} ${v})`);}
  private colors(layers:[string,string][]=[]){for(const[p,color]of layers)this.path(p,color);}
  protected text(s:string,x:number,y:number,size=56,color='#fafafa',align:CanvasTextAlign='left',font='TitleLight'){
    const c=this.c;c.save();c.translate(x,y);c.scale(.96,1);super.text(s,0,0,size,color,align,font);c.restore();
  }
  private path(s:string,color:string){
    let path=this.geometry.get(s);if(!path){path=new Path2D(s);this.geometry.set(s,path);if(this.geometry.size>100)this.geometry.delete(this.geometry.keys().next().value!);}
    this.c.fillStyle=color;this.c.fill(path,'evenodd');
  }
  private motion(kind:string){
    const s=this.sample();if(s?.kind!==kind)return false;
    for(const[path,value]of s.vectors??[])this.path(path,`rgb(${value} ${value} ${value})`);return true;
  }
  private background(name:keyof typeof measured.backgrounds|'black'){
    const c=this.c;if(name==='black'){c.fillStyle='#000';c.fillRect(0,0,1920,1080);return;}
    if((name==='dark'||name==='heart')&&this.refined()?.darkBg){
      const sample=this.refined()!,b=sample.darkBg!;
      let canvas=this.movingBackgrounds.get(sample.frame);
      if(!canvas){
        canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
        const ctx=canvas.getContext('2d')!,data=ctx.createImageData(960,540);
        // Quantise explicitly: Canvas gradient dithering changes with drawing
        // history and made random seeks produce different dark pixels.
        for(let y=0;y<540;y++)for(let x=0;x<960;x++){
          const glow=Math.exp(-(((x*2-970)/930)**2+((y*2-535)/820)**2)*1.5),i=(y*960+x)*4;
          for(let k=0;k<3;k++)data.data[i+k]=b[k]+b[k+3]*glow;
          data.data[i+3]=255;
        }
        ctx.putImageData(data,0,0);this.movingBackgrounds.set(sample.frame,canvas);
        if(this.movingBackgrounds.size>12)this.movingBackgrounds.delete(this.movingBackgrounds.keys().next().value!);
      }
      c.drawImage(canvas,0,0,1920,1080);return;
    }
    let canvas=this.backgrounds.get(name);
    if(!canvas){
      canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
      const ctx=canvas.getContext('2d')!,data=ctx.createImageData(960,540),b=measured.backgrounds[name];
      for(let y=0;y<540;y++)for(let x=0;x<960;x++){
        const glow=Math.exp(-(((x*2-970)/930)**2+((y*2-535)/820)**2)*1.5),i=(y*960+x)*4;
        for(let k=0;k<3;k++)data.data[i+k]=b[k]+b[k+3]*glow+(((x*37+y*73)%97)/97-.5)*.8;
        data.data[i+3]=255;
      }ctx.putImageData(data,0,0);this.backgrounds.set(name,canvas);
    }c.drawImage(canvas,0,0,1920,1080);
  }
  private sim(x=960,y=560,r=110,color='#353535'){
    const c=this.c;c.save();c.translate(x,y);c.scale(r/110,r/110);c.translate(-963,-537);
    this.path(refinement.icons.sim,color);c.restore();
  }
  private grid(color='#626262',step=43,width=1){
    for(let x=0;x<1920;x+=step)this.line(x,0,x,1080,width,color);
    for(let y=0;y<1080;y+=step)this.line(0,y,1920,y,width,color);
  }
  private clock(x:number,y:number,r:number,color='#eee',rotation=0){
    const c=this.c;c.save();c.translate(x,y);c.rotate(rotation);
    this.ring(0,0,r,Math.max(5,r*.08),color,Math.PI*1.25,-Math.PI*.1);
    this.polygon([[r*.50,-r*.94],[r*.84,-r*.67],[r*.30,-r*.56]],color);
    this.line(0,0,0,-r*.50,r*.09,color);this.line(0,0,r*.33,r*.2,r*.09,color);c.restore();
  }
  private rule(x:number,y:number,w:number,color='#eee'){
    this.line(x-w/2,y,x+w/2,y,2,color);this.line(x-w*.40,y,x+w*.40,y,5,color);
  }
  private tiled(t:number,top=0,bottom=450,bright=false){
    const frame=Math.round(t*30000/1001),c=this.c;
    for(let y=top;y<bottom;y+=44)for(let x=0;x<1920;x+=124){
      const h=hash(x+y*19+frame*.2),v=(bright?210:95)+h*60;
      c.fillStyle=`rgb(${v+20*h} ${v-35*h} ${v-20*h})`;c.fillRect(x+((Math.floor(y/44)%2)*42),y,124,44);
      c.fillStyle=`rgba(0,180,185,${.10+h*.10})`;c.fillRect(x+5,y+5,100,33);
    }
  }
  render(t:number){
    // Write an opaque blank bitmap before drawing. Explicit black frames must
    // replace the previous Canvas snapshot when seeking across distant scenes.
    this.time=sourceTime(t);const c=this.c;c.reset();c.putImageData(this.blank,0,0);c.save();
    t=this.time;
    if(t<123.623)this.erase(t);
    else if(t<124.625)this.feeling(t);
    else if(t<125.959)this.error(t);
    else if(t<126.793)this.setOpinion(t);
    else if(t<128.295)this.denied(t);
    else if(t<131.231)this.god(t);
    else if(t<134.168)this.illegal(t);
    else if(t<146.38)this.protocol(t);
    else if(t<158.825)this.console(t);
    else if(t<161.862)this.announce(t);
    else if(t<162.663){this.background('execution');this.spaced('> EXECUTION',960,558,46,80,'#d7b1b1',true,'TitleLight');}
    else if(t<163.664)this.load(t);
    else if(t<166.4)this.stable(t);
    else if(t<168.935)this.simulationGrid(t);
    else if(t<169.936)this.transmit(t);
    else if(t<173.74)this.recovery(t);
    else if(t<177.277)this.trap(t);
    else if(t<180.08)this.search(t);
    else if(t<181.281)this.networkGlitch(t);
    else if(t<183.817)this.network(t);
    else if(t<184.584)this.networkGlitch(t);
    else if(t<188.655)this.heart(t);
    else if(t<190.457)this.exit(t);
    else if(t<193.96){this.background('dark');this.motion('heartWire');}
    else if(t<204.25)this.rebuild(t);
    else if(t<208.55)this.power(t);
    else this.credits(t);
    // The transient checker field is an independently generated effect layer.
    if(this.sample()?.tiles&&((t>=126.793&&t<126.994)||(t>=155.188&&t<155.488)||(t>=158.825&&t<159.025)||(t>=161.862&&t<162.163)||(t>=162.663&&t<162.863)))this.tiled(t);
    c.restore();
  }
  private erase(t:number){
    const c=this.c;this.background('dark');
    if(t<122.19){
      c.fillStyle='#f5f5f5';c.fillRect(548,413,816,258);c.fillStyle='#aaa';c.fillRect(548,413,816,28);
      this.motion('trash');
      const done=t>=120.954;this.text(done?'Done.':'Erase All the Memories',done?1035:1039,571,50,'#111','center','TitleLight');
      this.line(804,594,1285,594,4,'#4b4b4b');return;
    }
    if(t<122.72){this.motion('erasePieces');this.text('Then, Maybe',960,573,52,'#ccc','center','TitleLight');return;}
    const w=keys(t,[[122.72,805],[123.423,816]]),h=keys(t,[[122.72,75],[123.356,75],[123.423,750],[123.59,750]]);
    const panel=this.refined()?.erasePanel??[955-w/2,544-h/2,w,h];c.fillStyle='#f2f2f2';c.fillRect(panel[0],panel[1],panel[2],panel[3]);
    this.text('Get Feeling of ‘me’',955,583,50,'#111','center','TitleLight');
  }
  private feeling(t:number){
    const c=this.c;this.background('dark');const measured=this.refined()?.feeling;
    const [x,y,right,bottom]=measured?.panel??[545,keys(t,[[123.623,180],[124.30,42],[124.625,-125]]),1362,1800];
    c.fillStyle='#f4f4f4';c.fillRect(x,y,right-x,bottom-y);c.save();c.beginPath();c.rect(x,y,right-x,bottom-y);c.clip();
    c.save();c.translate(595,y+111);c.scale(.93,1);this.text(typed('Feeling Index',t-123.623,37),0,0,87,'#111','left','TitleRegular');c.restore();
    this.line(1086,y+20,1086,y+116,7,'#111');this.text('Object',1101,y+60,34,'#111','left','TitleLight');this.text('Me',1101,y+98,38,'#111','left','TitleRegular');
    this.line(574,y+130,1328,y+130,4,'#222');
    const emotions=['Depressed','Hateful','Confused','Fearful','Empty','Pained','Bad','Nervous','Sad','Indifferent','heartbroken','lifeless'];
    const values=[1,1,1,0,1,1,1,0,1,0,1,1];
    for(let i=0;i<12;i++){
      const range=measured?.rows[i];if(!range?.length)continue;
      const red=range[2]==='red',line=red?`[Undefined] = ${values[i]};`:`${emotions[i]} = ${values[i]};`;
      c.save();c.beginPath();c.rect(590+Number(range[0])-3,y+152+i*73,Number(range[1])-Number(range[0])+6,68);c.clip();
      this.text(line,594,y+205+i*73,52,red?'#a33738':'#171717','left','TitleLight');c.restore();
    }c.restore();
  }
  private error(t:number){
    if(t>=125.725){this.background('dark');this.text('It is just Undefined Error.',960,659,46,'#161616','center');return;}
    this.background('red');this.warning(960,465,150,'#f9f9f9','#c70000');
    this.text(typed('[Reference Error]',t-124.625,55),960,604,58,'#fafafa','center','TitleRegular');
    this.text('Value: It is just Undefined or not defined.',960,668,46,'rgba(250,250,250,.15)','center');
    this.text(typed('It is just Undefined Error.',t-124.89,90),960,668,46,'#eee','center','TitleLight');
  }
  private setOpinion(t:number){
    const c=this.c;this.background('blue');this.sim(960,545,105,'#688bac');
    const p=clamp((t-126.37)/.42);c.strokeStyle='#e1e1e1';c.lineWidth=3;c.strokeRect(701,518,511,55);
    c.fillStyle='#eee';c.fillRect(701,518,511*p,55);
    this.text(typed('Set Opinion of ‘me’ to 0',t-126.12,52),748,558,41,'#f4f4f4','left','TitleLight');
    c.save();c.beginPath();c.rect(701,518,511*p,55);c.clip();this.text(typed('Set Opinion of ‘me’ to 0',t-126.12,52),748,558,41,'#181818','left','TitleLight');c.restore();
  }
  private denied(t:number){
    const c=this.c;this.background('white');this.shield(960,509,190,'#bbb','#cdcdcd');
    this.spaced('Challenging',960,492,37,56,'#1d1d1d');c.fillStyle='#f4777a';c.fillRect(439,510,1045,120);
    this.spaced('[Access Denied]',960,602,76,30);this.spaced('toyourgod',960,679,38,65,'#141414');
    if(t>=128.13){c.globalAlpha=1-clamp((t-128.13)/.165);}
  }
  private god(t:number){
    const c=this.c;this.background('white');const a=smooth((t-128.695)/.20);
    c.save();c.globalAlpha=a;this.ring(960,545,147,24,'#aaa');this.text('i',960,627,248,'#aaa','center','TitleRegular');c.restore();
    this.spaced(typed('GOD IS ALWAYS TRUE',t-128.86,15),960,566,40,30,'#797979');
  }
  private illegal(t:number){
    this.background('dark');const c=this.c,r=this.refined();
    for(const[x,y,w,h,red=176,green=176,blue=176]of r?.binary??[]){
      c.save();c.translate(x,y);c.rotate(-.04);c.beginPath();c.rect(0,0,w,h);c.clip();
      for(let dy=17;dy<h+12;dy+=22){
        const text='00110110100100100111010010001011'.repeat(12);
        this.text(text,0,dy,19,`rgb(${red} ${green} ${blue})`,'left','TitleRegular');
        this.text(text,-3,dy+3,19,'rgba(0,130,145,.32)','left','TitleThin');
        this.text(text,3,dy-3,19,'rgba(135,0,35,.30)','left','TitleThin');
      }c.restore();
    }
    this.colors(r?.illegal);
  }
  private protocol(t:number){
    if(t<135.235||t>=146.28)return;
    const c=this.c;c.save();c.translate(760,865);c.rotate(-.04);
    const s=t<136.67?'Emergency Protocol Execute':'world.runExecution';
    for(const[dx,dy,col]of [[-130,-7,'#050a9b'],[-8,0,'#b42c1d'],[12,4,'#76bb62']] as [number,number,string][])
      this.text(s,dx,dy,43,col,'left','TitleLight');
    const w=keys(t,[[139.0,0],[143.0,750],[145.7,1370]]);
    if(w>0){this.line(-760,69,-760+w,69,2,'#24322b');this.line(-760,74,-760+w,74,1,'#301015');}
    c.restore();
  }
  private console(t:number){
    const c=this.c,m=this.segment();
    this.background(t<151.652?'black':t<155.188?'consoleGray':'black');
    if(t<151.652){
      this.sim(963,564,105,'#202020');
      for(const [i,text] of segment.terminal.strings.entries()){
        const count=m?.consoleChars?.[i]??0;
        if(count)this.text(text.slice(0,count),segment.terminal.lefts[i],segment.terminal.baselines[i],34.5,'#c4c4c4','left','TitleLight');
      }return;
    }
    if(t>=155.188){
      const color=m?.consoleColor??[32,0,0];
      c.fillStyle=`rgb(${color.map(v=>v/.85).join(' ')})`;c.fillRect(0,0,1920,1080);
      this.colors(m?.redDust?.map(([p,color])=>[p,color==='#080a24'?'#160952':color==='#080303'?'#080a03':color]));
    }
    // Outline layers carry the source's fragmented letters and shifting rows.
    // Draw them above the corruption field, before the black edge occlusion.
    this.colors(m?.terminalInk);
    if(t>=155.188)for(let y=12;y<1080;y+=25){c.fillStyle='#000';c.fillRect(0,y,60,13);c.fillRect(1906,y,14,13);}else for(let y=0;y<1080;y+=100){c.fillStyle='#000';c.fillRect(0,y,50,50);}
  }
  private announce(t:number){
    const c=this.c,m=this.segment();this.background('black');
    const cards=m?.cards??[],anchor=cards.find(card=>card[1]>350&&card[1]<740&&card[4]>15)??cards.find(card=>card[1]>350&&card[1]<740)??[246,434,154,260,28];
    if(anchor){
      for(let row=-1;row<=1;row++)for(let i=-5;i<=6;i++){
        const x=anchor[0]+i*322,y=anchor[1]-i*2+row*310;
        c.fillStyle=row===0?`rgb(${anchor[4]} ${anchor[4]} ${anchor[4]})`:'#060606';
        c.beginPath();c.roundRect(x,y,154,260,7);c.fill();
        for(const cy of [y+72,y+190])this.polygon([[x+44,cy-31],[x+76,cy-42],[x+108,cy-28],[x+108,cy+28],[x+76,cy+40],[x+44,cy+29]],'#000');
        c.fillStyle='#000';c.beginPath();c.arc(x+22,y+131,8,0,Math.PI*2);c.fill();
      }
    }
    this.text('ANNOUNCE',960,568,55.5,'#fafafa','center','TitleLight');
    for(let i=0;i<6;i++){
      const nearest=m?.dots?.find(d=>Math.abs(d[0]-(919+i*20))<8);
      const x=nearest?.[0]??919+i*20,y=nearest?.[1]??596;
      c.strokeStyle='#aaa';c.lineWidth=1.5;c.beginPath();c.arc(x,y,4.5,0,Math.PI*2);c.stroke();
      if(nearest?.[3]){c.fillStyle='#eee';c.fill();}
    }
  }
  private load(t:number){
    this.background('dark');const c=this.c,m=this.segment();
    for(const [x,y,w,h] of m?.loadLines??[]){c.fillStyle='#ddd';c.fillRect(x,y,w,h);}
    if(m?.loadLabel){const [x,y,w,h]=m.loadLabel;c.save();c.translate(x+w/2,y+h);c.scale(w/571,h/30);this.spaced('SIMULATIONLOAD',0,0,39,14,'#bbb');c.restore();}
  }
  private stable(t:number){
    const c=this.c;this.background('dark');
    const r=this.refined();
    const m=this.segment();
    if(t<165.032){
      c.save();if(t<163.85){c.beginPath();c.rect(0,0,1920,528);c.rect(0,628,1920,452);c.rect(0,528,640,100);c.clip();}this.gray(m?.stableBackdrop);c.restore();
      if(t<163.85){this.line(0,537,1920,537,4,'#777');this.line(0,620,1920,620,4,'#777');this.spaced('SIMULATIONLOAD',960,597,39,14,'#777');}
      if(m?.stableGlyphs?.length){c.save();c.filter=`blur(${t>=164.9?2:t>=164.65?1.5:0}px)`;this.gray(m.stableGlyphs);c.restore();}
      else{
        if(r?.stableRules)this.path(r.stableRules,'#777777');
        for(const[,top,bottom,baseline]of r?.stable??[]){
          c.save();c.beginPath();c.rect(0,top,1920,bottom-top);c.clip();
          if(r?.stableField)c.clip(new Path2D(r.stableField),'evenodd');
          for(let x=-100;x<2100;x+=382)this.text('stable',x,baseline,104,'#303030','left','TitleThin');c.restore();
        }
      }
      if(t>=164.764){
        c.save();c.globalAlpha=.7;c.filter='blur(2px)';c.translate(960,540);c.scale(1.14,1.04);this.sim(0,0,155,'#999');c.restore();
        const captions=['Execute all simulation','Give them all the EXECUTION','ANSWER >'];
        for(const [i,box] of (m?.captions??[]).entries())if(box.length===4)this.fitted(i===2&&(box[2]>260||box[3]>40)?'ANSWER >_':captions[i],box as [number,number,number,number],'#080808','TitleLight');
        this.rule(960,552,166,'#333');
      }return;
    }
    if(t<165.35){
      this.background('black');c.save();c.filter='blur(5px)';this.gray(r?.brokenStable);c.restore();
      for(const[path,mean]of r?.stableFields??[]){
        c.save();c.clip(new Path2D(path),'evenodd');
        const frame=Math.round(t*29.97003);
        for(let y=0;y<1080;y+=35)for(let x=0;x<1920;x+=50){
          const v=hash(x+y*19+frame*43)-.5;c.fillStyle=`rgb(${mean[0]/.85+v*8} ${mean[1]/.85+v*8} ${mean[2]/.85+v*8})`;c.fillRect(x,y,50,35);
        }c.restore();
      }
      if(t>=165.2){c.save();c.globalAlpha=.7;this.sim(960,540,155,'#242424');this.text('Execute all simulation',960,528,49,'#080808','center','TitleLight');this.text('Give them all the EXECUTION',960,583,31,'#141414','center','TitleLight');this.text('ANSWER >_',960,681,48,'#111','center','TitleLight');c.restore();}
      return;
    }
    if(m?.noiseBands){
      const f=Math.round(t*30000/1001);
      c.save();
      for(const [y,line] of m.noiseBands.entries())for(const [x,color] of line.entries()){
        c.fillStyle=`rgb(${color.map(v=>v/.85).join(' ')})`;c.fillRect(x*96,y*72,97,73);
        // Correlated small fragments retain the block texture within each patch.
        for(let i=0;i<6;i++){
          const n=x*101+y*457+i*17+f*37,amount=(hash(n)-.5)*75;
          c.fillStyle=`rgb(${color.map((v,j)=>v/.85+amount*(j===0?1:.65)).join(' ')})`;
          c.fillRect(x*96+hash(n+11)*80,y*72+hash(n+23)*56,16+hash(n+3)*24,12+hash(n+7)*20);
        }
      }c.restore();this.colors(m.noiseRegions);if(m.noiseCuts)this.path(m.noiseCuts,'#000');
      const bars=this.sample()?.bars??[];for(const [top,bottom]of bars){c.fillStyle='#eeeeee';c.fillRect(0,(1-bottom)*1080,1920,(bottom-top)*1080);}
    }else this.digitalNoise(t,[0,0,1920,1080],true);
  }
  private simulationGrid(t:number){
    const c=this.c,r=this.refined(),m=this.segment();this.background('black');
    this.gray(m?.gridFields);
    if(m?.gridPresence??r?.gridMask){c.save();if(t<167.5)c.clip(new Path2D(m?.gridPresence??r!.gridMask!),'evenodd');this.grid(t>=167.3?'#a0a0a0':'#808080',43,1.5);c.restore();}
    const white=t>=167.2&&t<168.67,color=white?'#1a1a1a':'#b9b9b9';
    if(t<167.2){
      if(t>=166.66){c.fillStyle='#121212';c.fillRect(560,505,740,170);this.text("Check file exist : ‘simulation’",960,592,42,'#bcbcbc','center','TitleThin');this.rule(960,603,660,'#777');}
    }
    else if(t<167.67){
      if(t<167.27){
        c.save();const clip=new Path2D();clip.rect(0,0,1920,1080);if(m?.gridFields?.[0])clip.addPath(new Path2D(m.gridFields[0][0]));c.clip(clip,'evenodd');
        c.fillStyle='#121212';c.fillRect(560,505,740,170);this.text("Check file exist : ‘simulation’",960,592,42,'#bcbcbc','center','TitleThin');c.restore();
      }
      this.rule(960,602,680,color);
      if(t<167.48){this.text('Then, I can -',960,579,44,color,'center','TitleLight');this.text(`(${Math.min(100,Math.floor(72+(t-167.2)*90))}/100)`,960,642,32,color,'center');}
    }
    else if(t<168.18){this.text('Set Simulation to ‘me’',960,584,44,color,'center','TitleThin');this.rule(960,602,772,color);this.text('Found 1 file',960,637,32,color,'center','TitleLight');}
    else{
      const y=keys(t,[[168.18,-180],[168.5,320],[168.74,550],[168.935,520]]);
      if(m?.gridCube){c.save();c.beginPath();c.rect(0,0,1920,keys(t,[[168.18,606],[168.5,666],[168.75,684],[168.935,550]])-10);c.clip();this.gray(m.gridCube);c.restore();}else{
        c.save();c.filter='blur(4px)';c.translate(960,y);c.scale(keys(t,[[168.18,1],[168.52,1],[168.78,.4]]),1);this.sim(0,0,110,color);c.restore();
      }
      const ly=keys(t,[[168.18,606],[168.5,666],[168.75,684],[168.935,550]]),w=keys(t,[[168.18,680],[168.5,546],[168.935,515]]);
      this.rule(960,ly,w,color);
      c.save();c.globalAlpha=t>=168.68?.4:1;
      this.fitted('Be your only',m?.gridCaption as [number,number,number,number]??[818,ly+24,284,38],color,'TitleLight');c.restore();
    }
  }
  private transmit(t:number){
    const c=this.c;this.background('dark');c.save();c.globalAlpha=1-clamp((t-169.12)/.10);this.path(refinement.icons.chip,'#eeeeee');c.restore();
    const a=1-clamp((t-169.32)/.55);c.save();c.globalAlpha=a;this.rule(960,688,515,'#777');this.text('Transmition Complete',960,746,35,'#aaa','center','TitleLight');c.restore();
  }
  private recovery(t:number){
    const c=this.c;this.background('dark');
    if(t<170.804){
      if(t<170.22){
        this.background('white');c.save();c.filter='blur(12px)';
        for(const[x,y,r,level]of this.segment()?.clockDisks??[]){c.fillStyle=`rgb(${level} ${level} ${level})`;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}c.restore();
      }
      if(t<170.22){
        const disk=this.segment()?.clockDisks?.at(-1);c.save();
        if(disk){c.beginPath();c.arc(disk[0],disk[1],disk[2]*.92,0,Math.PI*2);c.clip();}
        c.globalAlpha=.88;c.filter='blur(1.5px)';this.motion('clock');c.restore();
      }else this.motion('clock');return;
    }
    if(t<171.672){
      this.background('white');const r=keys(t,[[170.804,170],[171.20,1190],[171.672,1390]]);c.save();c.beginPath();c.arc(960,550,r,0,Math.PI*2);c.clip();this.background('recovery');c.restore();
      this.path(measured.icons.clock.path,'#77768e');this.spaced(typed('SYSTEM RECOVERY',t-170.92,43),960,554,43,14,'#e8e7ee');this.rule(960,568,739,'#cac9dc');
      this.spaced('If I can have you back',960,608,31,12,'#c7c4d8');if(t>171.26)this.text('Loading...',960,737,28,'#ddd','center');return;
    }
    this.background('white');
    this.path(refinement.icons.recoverySide,'#080808');
    this.polygon([[452,316],[480,296],[480,337]],'#111');this.text('Recent backup',493,331,59,'#111','left','TitleLight');this.line(513,344,844,344,4,'#111');
    const lines=['Time : unknown','Description','   Uninstall : simulate system',"Execute System restore to ‘Unknown’? (Y/N) Y",'Confirmed.'];
    for(let i=0;i<lines.length;i++)this.text(typed(lines[i],t-(171.95+i*.15),70),i<3?517:499,383+i*47+(i>=3?15:0),i<3?43:43,'#111','left','TitleLight');
    c.save();c.translate(1500,540);c.rotate(-(t-172.75)*4);c.translate(-1500,-540);this.path(refinement.icons.recoveryClock,'#ae3b49');c.restore();
    if(t>172.88)this.ring(1500,540,keys(t,[[172.88,0],[173.06,390],[173.17,510]]),14,'#a94853');
    const disk=this.refined()?.disk;if(disk){c.fillStyle='#090909';c.shadowColor='#090909';c.shadowBlur=35;c.beginPath();c.arc(disk[0],disk[1],disk[2],0,Math.PI*2);c.fill();c.shadowBlur=0;}
    if(t<172.44){const edge=keys(t,[[171.672,0],[172.14,1450],[172.44,1920]]);c.save();c.beginPath();c.rect(edge,0,1920-edge,1080);c.clip();this.background('recovery');c.restore();}
  }
  private trap(t:number){
    const c=this.c;this.background('dark');
    if(t<174.474){const x=keys(t,[[173.74,2000],[173.97,1610],[174.20,1350],[174.474,0]]);this.spaced(typed('Though you have left',t-173.74,44),x,580,40,22,'#a6a6a6');return;}
    if(t<175.742){this.motion('trap');return;}
    if(t>=175.976&&t<176.143){this.background('recovery');this.spaced('> EXECUTION',960,581,47,28,'#9a456c');this.sim(960,550,105,'#d9ded4');}
    if(t>=176.143&&t<176.443){this.background('white');this.sim(960,550,105,'#cccccc');}
  }
  private search(t:number){
    const c=this.c;this.background('dark');
    if(t<178.38){this.motion('spider');return;}
    if(t<179.246)this.motion('search');
    const [x,y,w,h,p]=this.refined()?.search??[638,keys(t,[[178.38,688],[179.03,688],[179.60,572]]),646,49,clamp((t-179.20)/.55)];
    if(t>=179.246&&t<179.43){c.strokeStyle='#ccc';c.lineWidth=3;c.strokeRect(798,keys(t,[[179.246,260],[179.43,90]]),324,324);}
    this.line(960,0,960,y-92,3,'#aaa');c.strokeStyle='#ddd';c.lineWidth=5;c.beginPath();c.roundRect(x,y,w,h,h/2);c.stroke();
    c.save();c.beginPath();c.roundRect(x,y,w,h,h/2);c.clip();c.fillStyle='#eee';c.fillRect(x,y,w*p,h);c.restore();
    const str=t<179.4?typed('how to properly love',t-178.86,55):typed('Search data crawling...',t-179.4,65);
    this.text(str,x+18,y+h*.74,32,t<179.4?'#ccc':'#161616','left','TitleLight');this.ring(x+w-37,y+h*.41,9,3,'#aaa');this.line(x+w-30,y+h*.56,x+w-23,y+h*.74,3,'#aaa');
  }
  private networkGlitch(t:number){
    this.background('white');const r=this.refined();
    if(r?.networkTiles)this.tiled(t,0,1080);
    if(r?.networkWire)this.path(r.networkWire,'#050505');
  }
  private network(t:number){
    const c=this.c;this.background('dark');
    if(t<182.983){
      for(let y=0;y<1080;y+=120)for(let x=-60;x<2000;x+=150){c.strokeStyle='#1e1e1e';c.lineWidth=2;c.strokeRect(x,y,120,110);this.text('?',x+60,y+80,95,'#151515','center');}
      const question=this.refined()?.question;this.gray(question?.layers);const y=question?question.box[1]+question.box[3]+20:keys(t,[[181.281,269],[181.53,319],[181.86,607],[182.0,688],[182.23,724],[182.60,730]]);
      this.rule(960,y,147,'#bbb');this.text('Check Network',960,y+44,27,'#ddd','center');
      if(t>182.249){const top=keys(t,[[182.249,-70],[182.52,200],[182.75,720],[182.983,1080]]);c.fillStyle='#ddd';c.fillRect(0,0,1920,top);this.grid('#777');}
      return;
    }
    this.background('white');
    for(let y=-80;y<1200;y+=145)for(let x=-50;x<2100;x+=143)this.shield(x,y,105,'#d9d9d9','#eee');
    if(t<183.29){c.strokeStyle='#777';c.lineWidth=5;c.strokeRect(900,465,120,120);this.line(925,520,949,548,9,'#777');this.line(949,548,987,493,9,'#777');}
    else if(t>=183.40)this.path(refinement.icons.shield,'#555555');
    if(t>=183.16)this.spaced('Type Network Password',960,583,37,14,'#111',true,'TitleLight');
  }
  private heart(t:number){
    const c=this.c;this.background('heart');if(t<187.421){this.gray(this.refined()?.heartDust);c.save();c.filter='blur(3px)';this.motion('heartFill');c.restore();}else this.colors(this.refined()?.heartColor);
    const frame=Math.round(t*29.97003);
    for(let i=0;i<65;i++){const n=i*37;c.fillStyle=`rgba(230,230,230,${.05+hash(n+frame)*.11})`;c.fillRect(hash(n)*1920,hash(n+100)*1080,3,3);}
    if(t>=185.786&&t<187.421){c.save();c.globalAlpha=smooth((t-185.786)/.45)*(1-clamp((t-187.17)/.25));this.spaced('I know the algebraic expression of',960,579,37,17,'#eee');c.restore();}

  }
  private exit(t:number){
    const c=this.c;this.background('dark');const shape=this.refined()?.exit;if(!shape)return;
    const[x,y,w,h]=shape.box;c.fillStyle='#eeeeee';c.fillRect(x,y,w,h);
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();this.grid('#999');c.restore();
    // Track the runner/door occlusion and the runway's measured retraction.
    if(shape.silhouette)this.path(shape.silhouette,'#050505');
  }
  private rebuild(t:number){
    this.motion('rebuild');const c=this.c;
    if(t<204.07){const a=smooth((t-194.1)/.16)*(1-clamp((t-203.80)/.28));c.save();c.globalAlpha=a;this.rule(960,1020,1028,'#929292');
      const x=450+1020*clamp((t-194.1)/9.7);this.line(x-45,1020,x+65,1020,4,'#aaa');c.restore();}
  }
  private power(t:number){
    const c=this.c;if(t>=205.17&&t<206.36){c.save();c.globalAlpha=keys(t,[[205.17,0],[205.34,.75],[206.2,.75],[206.36,0]]);this.ring(940,579,165,2,'#666',Math.PI*1.5,-Math.PI/2+clamp((205.5-t)*8));c.restore();}
    if(t>=206.20){const a=keys(t,[[206.2,0],[206.4,1],[207.9,1],[208.5,0]]);c.save();c.globalAlpha=a;c.shadowColor='#eee';c.shadowBlur=20;
      this.ring(940,579,85,18,'#fff',Math.PI*1.3,-Math.PI*.3);this.line(940,488,940,567,18,'#fff');c.restore();}
  }
  private digitalNoise(t:number,box:[number,number,number,number],red=false){
    const c=this.c,[x,y,w,h]=box,frame=Math.round(t*29.97003),step=red?18:9;const mean=red?this.refined()?.noiseMean:this.refined()?.creditNoise;
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
    for(let dy=0;dy<h;dy+=step)for(let dx=0;dx<w;dx+=step){
      const n=dx+dy*19+frame*251;
      c.fillStyle=red?`rgb(${(mean?.[0]??99)/.85+(hash(n)-.5)*145} ${(mean?.[1]??38)/.85+(hash(n+7)-.5)*75} ${(mean?.[2]??23)/.85+(hash(n+4)-.5)*65})`:`rgb(${(mean?.[0]??160)+(hash(n)-.5)*180} ${(mean?.[1]??182)+(hash(n+7)-.5)*170} ${(mean?.[2]??160)+(hash(n+4)-.5)*185})`;
      c.fillRect(x+dx,y+dy,step,step);
    }
    if(!red&&mean){const cuts=this.refined()?.creditCuts;if(cuts)this.path(cuts,'#000');}
    else for(let i=0;i<6;i++){c.fillStyle='#000';if(hash(frame+i)>.5)c.fillRect(x+hash(frame+i*2)*w,y+hash(frame+i*11)*h,w*.6,step*2);}
    c.restore();
  }
  private credits(t:number){
    const c=this.c;
    if(t<216.483){
      const title=typed('world.execute(me);',t-210.276,8.1);
      const pixel=this.pixelTitle;pixel.width=228;pixel.height=35;const ctx=pixel.getContext('2d')!;ctx.font='27px TitleLight';ctx.fillStyle='#eee';ctx.textBaseline='top';ctx.fillText(title,0,0);
      c.save();c.imageSmoothingEnabled=false;c.drawImage(pixel,0,0,228,35,737,523,456,70);c.restore();
      if(t>=213.48){
        this.text('Produced by Project MILI',960,627,43,'#ddd','center','TitleLight');
        this.text('Movie by',758,680,43,'#ddd','left','TitleLight');this.path(measured.icons.korean.path,'#ddd');this.text('| Eodslv',1016,680,43,'#ddd','left','TitleLight');
      }return;
    }
    if(t<222.489){
      this.text('Image From The Noun Project',960,66,45,'#ddd','center','TitleLight');this.text('CC BY 3.0 US',960,114,45,'#ddd','center','TitleLight');
      this.text('Share, Adapt, Attribution, No additional restrictions',960,157,40,'#ddd','center','TitleLight');
      if(t>=217.484){for(let i=0;i<leftCredits.length;i++)this.text(leftCredits[i],52,228+i*43.3,40,'#ddd','left','TitleLight');
        for(let i=0;i<rightCredits.length;i++)this.text(rightCredits[i],1884,233+i*43.3,40,'#ddd','right','TitleLight');}return;
    }
    if(t<228.495){
      this.text('Footage from Youtube',960,236,40,'#ddd','center','TitleLight');
      if(t>=223.49){
        const r=this.refined(),box:[number,number,number,number]=[200,322,590,330];
        c.save();c.beginPath();c.rect(...box);c.clip();
        c.fillStyle='#222';c.fillRect(...box);
        for(const[y,h,red,green,blue]of r?.creditBands??[]){c.fillStyle=`rgb(${red} ${green} ${blue})`;c.fillRect(200,322+y,590,h);}
        c.restore();this.digitalNoise(t,[1125,322,573,330]);
        this.text('Screen Glitch',495,728,43,'#ddd','center','TitleLight');this.text('by Footage Island (Nissim Farin)',495,775,42,'#ddd','center','TitleLight');
        this.text('Digital Glitch',1411,728,43,'#ddd','center','TitleLight');this.text('by Creation Effects',1411,775,42,'#ddd','center','TitleLight');
      }return;
    }
    if(t<234.501){
      this.text('Thanks for waiting during 5 months,',960,519,43,'#ddd','center','TitleLight');
      this.text('Thanks for watching.',960,567,43,'#ddd','center','TitleLight');this.text('See you later.',960,661,43,'#ddd','center','TitleLight');
    }
  }
}

export function finaleEffectsAt(t:number):Effect {
  t=sourceTime(t);const off:[number,number]=[-2,-1];
  const e:Effect={tear:0,rgb:0,rgbY:0,bands:0,flash:0,band1:off,band2:off,band3:off,chunks:0,black:0,tint:0,split:0,border:0,noise:0,bandLevel:.96};
  const s=samples.get(Math.round(t*30000/1001));
  if(s?.flash)e.flash=1;
  if(s?.bars){e.bands=1;e.border=1;e.bandLevel=s.level??.96;for(let i=0;i<s.bars.length;i++)e[['band1','band2','band3'][i] as 'band1'|'band2'|'band3']=s.bars[i] as [number,number];}
  for(const[a,b,v,x,y]of [[124.458,125.125,.3,7,8],[126.36,126.793,.45,3,8],[131.231,134.168,.75,12,13],[151.652,155.188,.55,0,0],[155.188,158.825,.65,0,0],[165.198,166.4,.55,5,4],[175.742,177.01,.6,9,4],[180.08,181.281,.4,7,7],[183.817,184.584,.5,8,6]] as number[][])
    if(t>=a&&t<b){e.tear=v;e.rgb=x;e.rgbY=y;}
  if(t>=187.421&&t<187.57)e.tear=.9;
  // The measured motifs already carry their source deformation and channel
  // offsets. Adding a second random tear displaces them twice.
  if((t>=151.652&&t<158.825)||(t>=165.35&&t<166.4)||(t>=131.231&&t<134.168)||(t>=180.08&&t<181.281)||(t>=183.817&&t<184.584)){e.tear=0;e.rgb=0;e.rgbY=0;}
  return e;
}
