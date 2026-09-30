import * as THREE from 'three';
import type { SceneContext } from '../engine/types';
import { SceneBase } from './SceneBase';
import { Annotations, Drawing, type V } from './Drawing';
import { FragmentField } from './fragmentModel';
import { clamp, phase } from '../utils/math';
import { smoothstep } from '../utils/easing';

const Z=-14;
const pt=(x:number,y:number):V=>[x,y,Z];
const quantize=(value:number,epsilon:number)=>epsilon<=0?value:Math.round(value/epsilon)*epsilon;

export class InvalidArgumentScene extends SceneBase {
  readonly id='INVALID_ARGUMENT';
  private readonly world=new THREE.Scene();
  private readonly camera=new THREE.PerspectiveCamera(38,16/9,0.01,200);
  private readonly lines=new Drawing();
  private readonly labels:Annotations;
  private readonly field=new FragmentField();
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
    if(t<3.7)return 'PRECISION';if(t<7.4)return 'FLOATING POINT';
    if(t<11.1)return 'OVERFLOW';if(t<16.6)return 'NaN';return 'INVALID ARGUMENT';
  }

  private axes(alpha:number,gap=0):void{
    if(alpha<=0)return;
    this.lines.line(pt(-5.7,0),pt(-gap,0),0.28*alpha,true);
    this.lines.line(pt(gap,0),pt(5.7,0),0.28*alpha,true);
    this.lines.line(pt(0,-2.7),pt(0,-gap),0.19*alpha,true);
    this.lines.line(pt(0,gap),pt(0,2.7),0.19*alpha,true);
    for(let i=-5;i<=5;i++)if(Math.abs(i)>gap+0.01)this.lines.line(pt(i,-0.04),pt(i,0.04),0.12*alpha,true);
  }

  private precision(t:number,ctx:SceneContext):void{
    const floating=this.at(ctx,'invalid.floating');
    const fieldAlpha=1-smoothstep(phase(t,0.55,1.55));
    this.field.draw(this.lines,1,0.75*fieldAlpha,0.35);
    const focus=smoothstep(phase(t,0.2,0.55))*(1-smoothstep(phase(t,1.05,1.85)));
    this.field.draw(this.lines,1,0.7*focus,0.35,{index:this.field.focusIndex,zoom:smoothstep(phase(t,0.2,1.2))});
    this.labels.set('undefined','global transform: undefined',1250,190,0.78*(1-smoothstep(phase(t,0.3,1.0))),14,true);
    const alpha=smoothstep(phase(t,0.85,1.7))*(1-smoothstep(phase(t,floating+0.1,floating+0.9)));
    if(alpha<=0)return;
    const beat=ctx.music.nextBeat-ctx.music.previousBeat;
    const step=clamp(Math.floor((ctx.time-ctx.music.markers['invalid.quantize'])/beat),0,5);
    const epsilons=[0,0.025,0.085,0.21,0.43,0.78];
    const digits=[9,6,3,2,1,0];
    const target=ctx.music.markers['invalid.quantize']+step*beat;
    const blend=smoothstep(phase(ctx.time,target,target+0.32*beat));
    const epsilon=step===0?0:epsilons[step-1]+(epsilons[step]-epsilons[step-1])*blend;
    this.axes(alpha*0.7);
    this.lines.curve(x=>pt(x,0.33*x+0.18),-5.4,5.4,220,0.16*alpha,true);
    this.lines.curve(x=>pt(x,quantize(0.33*x+0.18,epsilon)),-5.4,5.4,320,0.82*alpha);
    this.labels.set('precisionValue',`x = ${digits[step]===0?'1':'1.'+'0'.repeat(digits[step])}`,1285,213,alpha,18);
    this.labels.set('quantize','q(x) = round(x / ε) · ε',1260,255,alpha*0.7,14,true);
  }

  private floating(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'invalid.floating'),end=this.at(ctx,'invalid.overflow');
    const alpha=smoothstep(phase(t,start-0.2,start+0.55))*(1-smoothstep(phase(t,end+0.2,end+0.9)));
    if(alpha<=0)return;
    const x=1e20,epsilon=1,result=x+epsilon;
    const attempt=phase(t,start+0.4,start+1.1);
    this.axes(alpha*0.42);
    this.lines.point(pt(0,0),0.88*alpha,0.072);
    this.lines.partial(pt(0.17,0),pt(0.38,0),attempt,0.18*alpha,true);
    this.labels.set('floating','x + ε = x',1290,220,alpha,19);
    this.labels.set('epsilon',`x = 10²⁰   ε = 1\nresult = ${result===x?'x':'x + ε'}`,1290,267,0.56*alpha,13,true);
    const tries=Math.max(0,Math.floor((ctx.time-ctx.music.markers['invalid.floating'])/(ctx.music.nextBeat-ctx.music.previousBeat)));
    this.labels.set('tries',`attempts  ${Math.min(tries,8)}`,420,620,0.39*alpha*attempt,12,true);
  }

  private overflow(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'invalid.overflow'),nan=this.at(ctx,'invalid.nan');
    const alpha=smoothstep(phase(t,start-0.2,start+0.5))*(1-smoothstep(phase(t,nan+0.1,nan+0.85)));
    if(alpha<=0)return;
    const overflowed=!Number.isFinite(Math.exp(710));
    const inf=overflowed?smoothstep(phase(ctx.time,ctx.music.markers['invalid.infinity'],ctx.music.markers['invalid.infinity']+0.18)):0;
    this.axes(alpha);
    const endX=-4.6+8.6*phase(t,start,start+2.15);
    const maxX=Math.log(2.55/0.13);
    const visibleEnd=Math.min(endX,maxX);
    if(visibleEnd>-4.6)this.lines.curve(x=>pt(x,0.13*Math.exp(x)-0.45),-4.6,visibleEnd,Math.max(1,Math.ceil((visibleEnd+4.6)*32)),0.82*alpha*(1-inf));
    this.labels.set('exponential','y = eˣ',1300,205,alpha*(1-0.7*inf),18);
    for(let i=0;i<3;i++){
      const marker=start+(i+1)*(ctx.music.nextBeat-ctx.music.previousBeat);
      this.labels.set(`finite${i}`,'finite',360+i*160,270-i*35,alpha*phase(t,marker,marker+0.25)*(1-inf),12,true);
    }
    this.labels.warning('infinity','∞',1298,245,alpha*inf,20);
  }

  private nan(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'invalid.nan'),end=this.at(ctx,'invalid.argument');
    const alpha=smoothstep(phase(t,start-0.25,start+0.45))*(1-smoothstep(phase(t,end-0.6,end+0.05)));
    if(alpha<=0)return;
    const m=ctx.music.markers;
    const invalidVertex=0/0;
    const vertexValid=ctx.time<m['invalid.nanVertex']?0:invalidVertex;
    const edgeLost=smoothstep(phase(ctx.time,m['invalid.nanEdge'],m['invalid.nanEdge']+0.25));
    const polygonLost=smoothstep(phase(ctx.time,m['invalid.nanPolygon'],m['invalid.nanPolygon']+0.25));
    const surfaceLost=smoothstep(phase(ctx.time,m['invalid.nanSurface'],m['invalid.nanSurface']+0.55));
    const transformLost=smoothstep(phase(ctx.time,m['invalid.nanTransform'],m['invalid.nanTransform']+0.85));
    this.axes(alpha*(1-transformLost*0.78));
    const a=pt(-1.7,-1.35),b=pt(1.7,-1.35),c=pt(vertexValid,1.7);
    this.lines.line(a,b,alpha*(1-polygonLost)*0.72);
    if(Number.isFinite(c[0]))this.lines.point(c,0.84*alpha,0.06);
    if(edgeLost<1){
      this.lines.line(a,pt(0,1.7),alpha*(1-edgeLost)*0.67);
      this.lines.line(b,pt(0,1.7),alpha*(1-edgeLost)*0.67);
    }
    this.lines.point(a,0.7*alpha*(1-polygonLost),0.05);
    this.lines.point(b,0.7*alpha*(1-polygonLost),0.05);
    for(let i=-2;i<=2;i++)this.lines.curve(x=>pt(x,0.35*Math.sin(x+i*0.5)+i*0.4),-3.4,3.4,42,0.1*alpha*(1-surfaceLost),true);
    this.labels.warning('nanFormula','0 / 0 → NaN',1280,212,alpha,18);
    this.labels.set('dependency','vertex → edge → polygon → surface → transform',1090,257,alpha*(1-transformLost*0.5),13,true);
  }

  private invalid(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'invalid.argument');
    const alpha=smoothstep(phase(t,start-0.2,start+0.45));
    if(alpha<=0)return;
    const beat=ctx.music.nextBeat-ctx.music.previousBeat;
    const lost=smoothstep(phase(ctx.time,ctx.music.markers['invalid.originLost'],ctx.music.markers['invalid.originLost']+0.36));
    this.axes(alpha,1.35*lost);
    this.lines.point(pt(0,0),0.78*alpha*(1-lost),0.062);
    this.lines.curve(x=>pt(x,0.4*Math.sin(x)), -3.8,3.8,80,0.23*alpha*(1-lost),true);
    const infinity=ctx.time>=ctx.music.markers['invalid.valueInfinity'];
    const nan=ctx.time>=ctx.music.markers['invalid.valueNaN'];
    this.labels.set('core',`core = ${nan?'NaN':infinity?'∞':'1.000'}`,1310,212,alpha,19);
    const messages=['DOMAIN ERROR','OUT OF RANGE','INVALID ARGUMENT','NON-FINITE VALUE'];
    messages.forEach((value,i)=>{
      const appearance=smoothstep(phase(ctx.time,ctx.music.markers['invalid.argument']+i*beat,ctx.music.markers['invalid.argument']+i*beat+0.25));
      this.labels.warning(`error${i}`,value,150,205+i*29,0.54*alpha*appearance,12,i>=2);
    });
    this.lines.warningPoint(pt(0,0),0.46*alpha*(1-lost),0.035,nan);
    this.labels.warning('origin','origin: undefined',1280,256,0.68*alpha*lost,13,true);
  }

  render(ctx:SceneContext):void{
    const t=ctx.localTime;
    this.lines.clear();this.labels.clear();
    const bridge=smoothstep(phase(ctx.time,ctx.music.markers['invalid.nanTransform'],ctx.music.markers['invalid.nanTransform']+0.8))
      *(1-smoothstep(phase(ctx.time,ctx.music.markers['invalid.argument']+0.2,ctx.music.markers['invalid.argument']+0.9)));
    this.axes(0.25*bridge);
    this.precision(t,ctx);this.floating(t,ctx);this.overflow(t,ctx);this.nan(t,ctx);this.invalid(t,ctx);
    this.lines.flush();this.renderer.render(this.world,this.camera);
  }
}
