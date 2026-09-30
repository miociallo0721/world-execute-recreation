import * as THREE from 'three';
import type { SceneContext } from '../engine/types';
import { SceneBase } from './SceneBase';
import { Annotations, Drawing, type V } from './Drawing';
import { drawRelationship } from './relationship';
import { lerp, phase } from '../utils/math';
import { smoothstep } from '../utils/easing';

const Z=-14;
const pt=(x:number,y:number):V=>[x,y,Z];
const TAU=2*Math.PI;

export class ResonanceScene extends SceneBase {
  readonly id='RESONANCE';
  private readonly world=new THREE.Scene();
  private readonly camera=new THREE.PerspectiveCamera(38,16/9,0.01,200);
  private readonly lines=new Drawing();
  private readonly labels:Annotations;
  private width=1920;private height=1080;
  constructor(private readonly renderer:THREE.WebGLRenderer,overlay:HTMLElement,private readonly origin:number){
    super();this.labels=new Annotations(overlay);
    this.camera.position.set(0,0,0);this.camera.lookAt(0,0,Z);
  }
  init():void{this.world.add(this.lines.object);this.resize(this.width,this.height);}
  resize(width:number,height:number):void{this.width=width;this.height=height;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  dispose():void{this.lines.dispose();this.labels.dispose();}
  private at(ctx:SceneContext,id:string):number{return ctx.music.markers[id]-this.origin;}
  substageAt(t:number):string{
    if(t<3.7)return 'TWO OSCILLATORS';if(t<7.4)return 'LISSAJOUS';
    if(t<11.1)return 'PHASE LOCK';if(t<15.7)return 'SUPERPOSITION';return 'SYNCHRONIZATION';
  }

  private oscillators(t:number,ctx:SceneContext):void{
    const liss=this.at(ctx,'resonance.lissajous');
    const exit=smoothstep(phase(t,liss-0.4,liss+0.9));
    const graph=1-smoothstep(phase(t,0.45,3.25));
    const wave=smoothstep(phase(t,0.35,0.9))*(1-exit);
    const beat=ctx.music.nextBeat-ctx.music.previousBeat;
    const w=TAU/(4*beat),q=ctx.time-this.origin;
    drawRelationship(this.lines,{graphAlpha:graph,connectionCount:1,waveAmplitude:0.06*phase(t,0.35,2.8)*graph,time:ctx.time,beatDuration:beat});
    for(const side of [-1,1] as const){
      const x=side*3;
      this.lines.point(pt(x,0),0.75*wave,0.065);
      const x0=side<0?-5.6:0.6,x1=side<0?-0.6:5.6;
      const frequency=side<0?1:1.17;
      this.lines.curve(u=>pt(u,0.23*Math.sin(2.0*(u-x)-w*frequency*q+(side<0?0:1.15))),x0,x1,90,wave*(side<0?0.53:0.37),side>0);
    }
    this.labels.set('me','ME',410,180,1-exit,15);
    this.labels.set('you','YOU',1450,180,1-exit,15);
    this.labels.set('osc','x₁(t) = A sin(ω₁t)\nx₂(t) = A sin(ω₂t + φ)',1280,234,0.63*wave,14,true);
    this.labels.set('ratioNote','ω₁ ≠ ω₂',1290,313,0.45*wave,13,true);
  }

  private lissajous(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'resonance.lissajous'),lockStart=this.at(ctx,'resonance.phaseLock');
    const alpha=smoothstep(phase(t,start-0.2,start+0.5))*(1-smoothstep(phase(t,lockStart-0.15,lockStart+0.9)));
    if(alpha<=0)return;
    const r1=smoothstep(phase(ctx.time,ctx.music.markers['resonance.ratio'],ctx.music.markers['resonance.ratio']+1.25));
    const r2=smoothstep(phase(ctx.time,ctx.music.markers['resonance.phaseLock'],ctx.music.markers['resonance.phaseLock']+1.9));
    const ratio=lerp(lerp(1.64,1.34,r1),1,r2);
    const phi=lerp(0.92,0.03,r2);
    const reveal=phase(t,start,start+1.8);
    this.lines.curve(u=>pt(1.95*Math.sin(u),1.65*Math.sin(ratio*u+phi)),0,TAU*3*reveal,Math.max(1,Math.ceil(320*reveal)),0.75*alpha);
    this.lines.point(pt(-3,0),0.38*alpha,0.045);
    this.lines.point(pt(3,0),0.38*alpha,0.045);
    this.labels.set('lissajous','x = sin(ω₁t)\ny = sin(ω₂t + φ)',1300,220,0.85*alpha,15);
    this.labels.set('ratio',`ω₂/ω₁ → ${ratio.toFixed(2)}`,1300,298,0.48*alpha,13,true);
  }

  private phaseLock(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'resonance.phaseLock'),end=this.at(ctx,'resonance.superposition');
    const alpha=smoothstep(phase(t,start-0.25,start+0.45))*(1-smoothstep(phase(t,end-0.25,end+0.4)));
    if(alpha<=0)return;
    const lock=smoothstep(phase(t,start,start+2.6));
    const beat=ctx.music.nextBeat-ctx.music.previousBeat;
    const q=TAU*(ctx.time-this.origin)/(4*beat);
    const ratio=lerp(1.13,1,lock),phi=0.95*(1-lock);
    this.lines.curve(x=>pt(x,1.1+0.42*Math.sin(1.45*x-q)),-5.3,5.3,190,0.5*alpha,true);
    this.lines.curve(x=>pt(x,-1.1+0.42*Math.sin(1.45*x-q*ratio+phi)),-5.3,5.3,190,0.69*alpha);
    this.lines.curve(u=>pt(-3.98+7.96*u,0.19*lock*Math.sin(Math.PI*u)*Math.sin(4*Math.PI*u)*Math.sin(q)),0,1,90,0.45*alpha);
    this.labels.set('phase','Δφ = φ₂ − φ₁',310,205,alpha,17);
    this.labels.set('lock','d(Δφ)/dt → 0',310,250,alpha*lock,15,true);
  }

  private superposition(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'resonance.superposition'),end=this.at(ctx,'resonance.synchronize');
    const alpha=smoothstep(phase(t,start-0.25,start+0.5))*(1-smoothstep(phase(t,end+0.85,end+1.65)));
    if(alpha<=0)return;
    const beat=ctx.music.nextBeat-ctx.music.previousBeat;
    const q=TAU*(ctx.time-this.origin)/(4*beat);
    const bar=beat*4;
    const relative=Math.PI*(1-Math.cos(Math.PI*(ctx.time-ctx.music.markers['resonance.superposition'])/bar))/2;
    const a=(x:number)=>0.43*Math.sin(1.55*x-q);
    const b=(x:number)=>0.43*Math.sin(1.55*x-q+relative);
    this.lines.curve(x=>pt(x,1.44+a(x)),-5.4,5.4,190,0.3*alpha,true);
    this.lines.curve(x=>pt(x,-1.44+b(x)),-5.4,5.4,190,0.3*alpha,true);
    this.lines.curve(x=>pt(x,a(x)+b(x)),-5.4,5.4,220,0.86*alpha);
    this.labels.set('super','ψ = ψ₁ + ψ₂',1300,205,alpha,19);
    this.labels.set('sumNotes','ψ₁\n\nψ₁ + ψ₂\n\nψ₂',116,320,0.52*alpha,13,true);
  }

  private synchronization(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'resonance.synchronize'),order=this.at(ctx,'resonance.order');
    const alpha=smoothstep(phase(t,start-0.2,start+1.5));
    if(alpha<=0)return;
    const beat=ctx.music.nextBeat-ctx.music.previousBeat;
    const connectionCount=1+[1,2,3,5].reduce((sum,n)=>sum+smoothstep(phase(ctx.time,ctx.music.markers['resonance.synchronize']+n*beat,ctx.music.markers['resonance.synchronize']+(n+0.42)*beat)),0);
    const orderAmount=smoothstep(phase(t,order,order+0.36));
    drawRelationship(this.lines,{graphAlpha:alpha,connectionCount,density:0,
      coherence:alpha*(1-orderAmount),waveAmplitude:0.15*alpha*(1-orderAmount),time:ctx.time,beatDuration:beat});
    this.labels.set('meSync','ME',410,180,alpha,15);
    this.labels.set('youSync','YOU',1450,180,alpha,15);
    this.labels.set('sync','ω₁ → ω\nω₂ → ω',1275,206,0.75*alpha*(1-orderAmount),15,true);
    this.labels.set('delta','Δφ → 0',1275,280,alpha*smoothstep(phase(t,start+1.5,start+2.5))*(1-orderAmount),14,true);
  }

  render(ctx:SceneContext):void{
    const t=ctx.localTime;
    this.lines.clear();this.labels.clear();
    this.oscillators(t,ctx);this.lissajous(t,ctx);this.phaseLock(t,ctx);this.superposition(t,ctx);this.synchronization(t,ctx);
    this.lines.flush();this.renderer.render(this.world,this.camera);
  }
}
