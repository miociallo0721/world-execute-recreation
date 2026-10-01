import { effectsAt } from './titleEffects';
import { Continuation } from './continuation';
import { continuationEffectsAt } from './continuationEffects';
import { Finale, finaleEffectsAt } from './finale';
import sequence from './sequence.json';
export { effectsAt } from './titleEffects';
export const DURATION = sequence.duration;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (v: number) => { const p = clamp(v); return p * p * (3 - 2 * p); };
const typed = (s: string, t: number, rate = 28) => s.slice(0, Math.floor(Math.max(0, t) * rate));

export class Opening {
  readonly canvas = document.createElement('canvas');
  private readonly c: CanvasRenderingContext2D;
  private readonly continuation:Continuation;
  private readonly finale:Finale;
  private readonly bootBackground = document.createElement('canvas');
  private readonly titleBackground = document.createElement('canvas');
  private readonly refinedBackground = document.createElement('canvas');
  private readonly circleBackground = document.createElement('canvas');
  constructor() {
    this.canvas.width=1920; this.canvas.height=1080;
    this.c=this.canvas.getContext('2d',{willReadFrequently:true})!;
    this.continuation=new Continuation(this.c);
    this.finale=new Finale(this.c);
    this.makeBackground(this.bootBackground, true);
    this.makeBackground(this.titleBackground, false);
    this.makeBackground(this.refinedBackground, false, true);
    this.makeBackground(this.circleBackground, true, true);
  }
  private makeBackground(canvas: HTMLCanvasElement, boot: boolean, refined=false) {
    canvas.width=1920; canvas.height=1080;
    const c=canvas.getContext('2d')!, data=c.createImageData(1920,1080);
    for(let y=0;y<1080;y++) for(let x=0;x<1920;x++) {
      const distance=Math.hypot((x-870)/1250,(y-540)/1000);
      const stripe=Math.sin(x*.037)*2+Math.sin(x*.081)*1.7+Math.sin(x*.011)*2;
      const grain=((x*73+y*139)%113)/113-.5;
      const value=refined
        ? (boot?25+18*Math.max(0,1-distance):10+15*Math.max(0,1-distance))+stripe*.12+grain*1.5
        : boot ? 28+14*Math.max(0,1-distance)+stripe+grain*2 : 7+10*Math.max(0,1-distance)+stripe*.14;
      const i=(y*1920+x)*4;
      data.data[i]=value; data.data[i+1]=value+1;data.data[i+2]=value+2;data.data[i+3]=255;
    }
    c.putImageData(data,0,0);
  }
  private text(s: string,x: number,y: number,size=40,color='#c7c7c7',align: CanvasTextAlign='left',font='ReferenceSans') {
    const c=this.c;c.font=`${size}px ${font}, Arial, sans-serif`;c.fillStyle=color;c.textAlign=align;c.textBaseline='alphabetic';c.fillText(s,x,y);
  }
  private line(x1:number,y1:number,x2:number,y2:number,width=2,color='#bbb') {
    const c=this.c;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
  }
  private fittedText(s:string,full:string,font:string,box:[number,number,number,number],color='#b1b1b1') {
    const c=this.c;c.save();c.font=`200px ${font}`;c.textAlign='left';c.textBaseline='alphabetic';
    const m=c.measureText(full),[x,y,w,h]=box;
    c.translate(x,y);c.scale(w/(m.actualBoundingBoxLeft+m.actualBoundingBoxRight),h/(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent));
    c.fillStyle=color;c.fillText(s,m.actualBoundingBoxLeft,m.actualBoundingBoxAscent);c.restore();
  }
  private credit(s:string,x:number,y:number) {
    const c=this.c;c.save();c.font='40px TitleLight';c.fillStyle='#aaa';c.textAlign='left';c.textBaseline='alphabetic';
    for(const char of s){c.fillText(char,x,y);x+=c.measureText(char).width+3;}c.restore();
  }
  private power(x:number,y:number) {
    const c=this.c;c.save();c.strokeStyle='#fff';c.lineWidth=16;c.lineCap='butt';c.shadowBlur=17;c.shadowColor='#fff';
    c.beginPath();c.arc(x,y,70,-Math.PI*.30,Math.PI*1.30);c.stroke();this.line(x,y-83,x,y-8,17,'#fff');c.restore();
  }
  private bar(x:number,y:number,w:number,p:number) {
    const c=this.c;c.strokeStyle='#d2d2d2';c.lineWidth=2;c.strokeRect(x,y,w,37);
    c.fillStyle='#e9e9e9';const n=Math.floor(w/17);
    for(let i=0;i<Math.floor(n*clamp(p));i++) c.fillRect(x+5+i*17,y+5,11,27);
  }
  private shield(x:number,y:number) {
    const c=this.c;c.save();c.translate(x,y);c.strokeStyle='#a5c798';c.lineWidth=9;c.beginPath();c.moveTo(0,-55);c.lineTo(52,-40);c.lineTo(45,22);c.quadraticCurveTo(28,50,0,66);c.quadraticCurveTo(-28,50,-45,22);c.lineTo(-52,-40);c.closePath();c.stroke();
    this.line(-25,4,-4,25,9,'#a5c798');this.line(-4,25,27,-14,9,'#a5c798');c.restore();
  }
  private couple(x:number,y:number) {
    const c=this.c;c.save();c.translate(x,y);c.fillStyle='#d893a6';
    for(const cx of [-29,29]) {c.beginPath();c.arc(cx,-36,16,0,Math.PI*2);c.fill();}
    c.beginPath();c.moveTo(-58,-10);c.lineTo(-2,-10);c.lineTo(-29,55);c.closePath();c.fill();
    c.beginPath();c.moveTo(29,-13);c.lineTo(1,55);c.lineTo(57,55);c.closePath();c.fill();c.restore();
  }
  private document(x:number,y:number,p:number) {
    const c=this.c;c.save();c.beginPath();c.rect(x,y,85*ease(p),115);c.clip();c.fillStyle='#e9e9e9';c.fillRect(x,y,78,110);
    this.line(x+12,y+10,x+57,y+10,3,'#262626');this.line(x+12,y+23,x+57,y+23,3,'#262626');this.text('INI',x+24,y+83,21,'#222');c.restore();
  }
  private database(x:number,y:number,p:number) {
    const c=this.c;c.save();c.globalAlpha=clamp(p);c.strokeStyle='#c8c8c8';c.lineWidth=4;
    for(let i=0;i<4;i++){c.beginPath();c.ellipse(x,y+i*21,43,17,0,0,Math.PI*2);c.stroke();}
    this.line(x-43,y,x-43,y+63,4);this.line(x+43,y,x+43,y+63,4);c.restore();
  }
  private simulation(t:number) {
    if(t>=14){
      const c=this.c;c.save();const color='#3b3d3f';
      const path=(points:[number,number][],close=true)=>{c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);if(close)c.closePath();c.strokeStyle=color;c.lineWidth=20;c.lineJoin='miter';c.stroke();};
      path([[970,307],[1174,424],[970,540],[766,424]]);
      path([[756,461],[756,692],[948,802],[948,571]]);
      path([[992,571],[992,802],[1182,692],[1182,461]]);
      this.line(970,349,970,504,18,color);
      this.line(795,670,918,600,18,color);this.line(1021,600,1144,670,18,color);
      this.fittedText('SIMULATION','SIMULATION','TitleLight',[816,548,295,42],'#c4c4c4');c.restore();return;
    }
    const c=this.c;c.save();c.translate(960,540);c.scale(ease((t-13.75)/.4),ease((t-13.75)/.4));
    const r=210, pts=Array.from({length:6},(_,i)=>[Math.sin(i*Math.PI/3)*r,-Math.cos(i*Math.PI/3)*r]);
    for(let i=0;i<6;i++){this.line(...pts[i] as [number,number],...pts[(i+1)%6] as [number,number],13,'#333638');this.line(0,0,...pts[i] as [number,number],11,'#333638');}
    c.fillStyle='#111415';c.fillRect(-160,-30,320,60);this.text('SIMULATION',0,15,46,'#969696','center');c.restore();
  }
  render(t:number) {
    if(t>=120){
      this.finale.render(t);this.finale.render(t);
      return finaleEffectsAt(t);
    }
    if(t>=30){
      // Skia caches repeated strokes with a different antialiasing path. Warm
      // the same geometry once so seeking and sequential export agree.
      this.continuation.render(t);this.continuation.render(t);
      return continuationEffectsAt(t);
    }
    const c=this.c;c.save();c.globalAlpha=1;c.fillStyle='#000';c.fillRect(0,0,1920,1080);
    if(t<1.28){
      c.globalAlpha=.18*(1-ease((t-1.1)/.18));c.strokeStyle='#888';c.lineWidth=3;c.beginPath();c.arc(960,540,157,-Math.PI/2,Math.PI*1.5*ease((t+.3)/.55));c.stroke();
      this.text(typed('Switch on the power line',t+.3,40),960,552,38,'#999','center');
    }else if(t<12.86){
      c.drawImage(this.bootBackground,0,0);const shift=ease((t-1.45)/.28)*270;const x=960-shift;
      this.power(x,540);this.line(x+105,452,x+105,624,3,'#dedede');const tx=x+124;
      if(t>=1.78 && t<2.96){this.text(typed('Remember to put on PROTECTION',t-1.78,80),tx,520,38);this.bar(tx,548,574,(t-1.78)/.95);}
      else if(t>=3.13 && t<3.83){this.shield(tx+64,538);this.text('Protection process is completed.',tx+158,556,38);}
      else if(t>=3.90 && t<6.24){
        this.text(typed('Lay down your pieces',t-3.9,45),tx,520,38);
        if(t<5.27){c.fillStyle='#ddd';for(let row=0;row<5;row++)for(let col=0;col<35;col++)if(col+row*3<(t-3.90)*80)c.fillRect(tx+col*17,546+row*17,10,10);}
        else this.bar(tx,547,360,(t-5.27)/.85);
      }else if(t>=6.27 && t<7.20){c.save();c.globalAlpha=1-ease((t-6.88)/.30);this.couple(tx+69,545);this.text('Objects (me, you) are created.',tx+160,554,38);c.restore();}
      else if(t>=7.31 && t<10.19){
        this.text(typed('Fill in my data parameters',t-7.31),tx,514,38);
        if(t>=7.82)this.document(tx+8,541,(t-7.82)/.6);
        c.save();c.setLineDash([13,8]);this.line(tx+91,595,tx+91+clamp((t-8.55)/.7)*277,595,3);c.restore();
        this.database(tx+434,563,(t-9.10)/.3);
      }else if(t>=10.21 && t<10.93){this.text('Initializing is completed.',tx,555,38);}
      else if(t>=10.98){this.text(typed('Set up our new world',t-10.98),tx,520,38);if(t>11.14)this.bar(tx,548,385,(t-11.14)/1.06);}
    }else if(t<13.76){
      c.drawImage(this.bootBackground,0,0);const p=clamp((t-12.9)/.55);c.globalAlpha=.25+.6*p;
      this.text('[Press any key to start simulation]',960,552,38,'#ccc','center');
    }else if(t<14.982){c.drawImage(t<14?this.titleBackground:this.refinedBackground,0,0);this.simulation(t);}
    else if(t<29.463){
      c.drawImage(this.refinedBackground,0,0);
      const letters=(s:string,starts:number[])=>s.slice(0,starts.filter(start=>t>=start).length);
      this.fittedText(letters('world.',[15.26,15.40,15.53,15.65,15.80,15.90]),'world.','TitleLight',[617,380,265,83]);
      this.fittedText(letters('execute',[16.04,16.38,16.65,16.78,16.98,17.30,17.55]),'execute','TitleRegular',[622,457,667,140]);
      this.fittedText(letters('(me);',[17.80,17.94,18.04,18.14,18.20]),'(me);','TitleLight',[1098,607,214,95]);
      this.credit(typed('> Mili.produce(song);',t-18.43,8),633,747);
      this.credit(typed('> Eodslv.produce(video[6]);',t-21.95,10),633,800);
    }else{
      c.drawImage(this.circleBackground,0,0);
      const interpolate=(keys:[number,number][])=>{
        if(t<keys[0][0])return keys[0][1];
        for(let i=1;i<keys.length;i++)if(t<keys[i][0]){const[a,v]=keys[i-1],[b,w]=keys[i];return v+(w-v)*(t-a)/(b-a);}
        return keys[keys.length-1][1];
      };
      const arc=interpolate([[29.55,0],[29.60,.055],[29.70,.49],[29.80,.73],[29.90,.87],[30,1]]);
      c.strokeStyle='#ededed';c.lineWidth=14;c.beginPath();c.arc(960,540,350,-Math.PI/2,-Math.PI/2+Math.PI*2*arc);c.stroke();
      const fill=interpolate([[29.72,0],[29.80,.17],[29.90,.58],[29.95,.69],[30,.84]]);
      c.save();c.beginPath();c.moveTo(960,540);c.arc(960,540,320,-Math.PI/2,-Math.PI/2+Math.PI*2*fill);c.closePath();c.fillStyle='#ededed';c.fill();c.clip();
      this.text('If, I’m',960,571,100,'#282828','center','TitleThin');c.restore();
    }
    c.restore();return effectsAt(t);
  }
}
