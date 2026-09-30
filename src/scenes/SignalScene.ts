import * as THREE from 'three';
import type { SceneContext } from '../engine/types';
import { SceneBase } from './SceneBase';
import { Annotations, Drawing, type V } from './Drawing';
import { carrier, graphEdges, graphNodes } from './continuity';
import { lerp, phase } from '../utils/math';
import { smoothstep } from '../utils/easing';

const Z=-14;
const pt=(x:number,y:number):V=>[x,y,Z];
const TAU=2*Math.PI;
const triangle=(theta:number):number=>{
  const a=((theta%TAU)+TAU)%TAU;
  return a<Math.PI?a/Math.PI:2-a/Math.PI;
};

export class SignalScene extends SceneBase {
  readonly id='SIGNAL';
  private readonly world=new THREE.Scene();
  private readonly camera=new THREE.PerspectiveCamera(38,16/9,0.01,200);
  private readonly lines=new Drawing();
  private readonly labels:Annotations;
  private width=1920; private height=1080;
  private readonly origin:number;

  constructor(private readonly renderer:THREE.WebGLRenderer,overlay:HTMLElement,start:number){
    super(); this.origin=start; this.labels=new Annotations(overlay);
    this.camera.position.set(0,0,0); this.camera.lookAt(0,0,Z);
  }
  init():void{this.world.add(this.lines.object);this.resize(this.width,this.height);}
  resize(width:number,height:number):void{this.width=width;this.height=height;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  dispose():void{this.lines.dispose();this.labels.dispose();}
  private at(ctx:SceneContext,id:string):number{return ctx.music.markers[id]-this.origin;}
  substageAt(t:number):string{
    if(t<3)return 'WAVEFORM'; if(t<6)return 'AC'; if(t<9)return 'RECTIFICATION';
    if(t<12.5)return 'RC FILTER'; if(t<16)return 'INTEGRATION'; return 'FEEDBACK';
  }

  private axis(y:number,alpha:number):void{
    this.lines.line(pt(-5.9,y),pt(5.9,y),0.22*alpha,true);
    for(let i=-5;i<=5;i++)this.lines.line(pt(i,y-0.035),pt(i,y+0.035),0.16*alpha,true);
  }
  private theta(x:number,ctx:SceneContext):number{
    return 1.55*x-TAU*(ctx.music.beatIndex+ctx.music.beatPhase)/4;
  }
  private rect(x:number,ctx:SceneContext):number{return 0.84*Math.abs(Math.sin(this.theta(x,ctx)));}
  // Steady-state response of a linear RC low-pass to the Fourier series of |sin θ|.
  private filtered(x:number,ctx:SceneContext):number{
    const theta=this.theta(x,ctx), tau=0.22, omega=TAU/(4*(ctx.music.nextBeat-ctx.music.previousBeat));
    let y=2/Math.PI;
    for(let n=1;n<=24;n++){
      const w=2*n*omega;
      y-=4/Math.PI/(4*n*n-1)/Math.hypot(1,w*tau)*Math.cos(2*n*theta+Math.atan(w*tau));
    }
    return 0.84*y;
  }

  private waveform(t:number,ctx:SceneContext):void{
    const ac=this.at(ctx,'signal.ac');
    const alpha=1-smoothstep(phase(t,ac+1.8,ac+2.65));
    if(alpha<=0)return;
    this.axis(0,alpha*smoothstep(phase(t,0,0.5)));
    this.lines.curve(x=>pt(x,carrier(x,ctx.music)),-5.8,5.8,240,0.88*alpha);
    const g=smoothstep(phase(t,0.45,1.2));
    for(let i=-5;i<=5;i++)this.lines.line(pt(i,-1.3),pt(i,1.3),0.035*g*alpha,true);
    this.labels.set('vt','V(t)',1290,200,g*alpha,18);
    this.labels.set('time','t →',1520,557,g*alpha,14,true);
    this.labels.set('ac','V(t) = V₀ sin(ωt)',1320,245,smoothstep(phase(t,ac,ac+0.35))*alpha,16,true);
    const amplitude=smoothstep(phase(t,ac+0.4,ac+0.7))*alpha;
    this.lines.line(pt(-5.65,0.84),pt(5.65,0.84),0.09*amplitude,true);
    this.lines.line(pt(-5.65,-0.84),pt(5.65,-0.84),0.09*amplitude,true);
    this.labels.set('voltage','+V₀                         0                         −V₀',1210,625,0.34*amplitude,12,true);
  }

  private rectify(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'signal.rectification'), end=this.at(ctx,'signal.filter');
    const alpha=smoothstep(phase(t,start-0.25,start+0.45))*(1-smoothstep(phase(t,end+0.45,end+1.2)));
    if(alpha<=0)return;
    const op=smoothstep(phase(t,start,start+1.35));
    this.axis(1.25,alpha);this.axis(-1.6,alpha);
    this.lines.curve(x=>pt(x,1.25+0.72*Math.sin(this.theta(x,ctx))),-5.7,5.7,220,0.58*alpha,true);
    this.lines.curve(x=>pt(x,-1.6+0.72*lerp(Math.sin(this.theta(x,ctx)),Math.abs(Math.sin(this.theta(x,ctx))),op)),-5.7,5.7,220,0.85*alpha);
    this.labels.set('input','INPUT  sin(ωt)',220,245,alpha,14,true);
    this.labels.set('output','OUTPUT  |sin(ωt)|',220,735,alpha,14);
    this.labels.set('rectFormula','Vout = |Vin|',1320,195,alpha*op,18);
  }

  private filter(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'signal.filter'),end=this.at(ctx,'signal.integration');
    const alpha=smoothstep(phase(t,start-0.3,start+0.35))*(1-smoothstep(phase(t,end+0.15,end+0.9)));
    if(alpha<=0)return;
    const filtered=smoothstep(phase(t,start+0.1,start+1.25));
    this.axis(-1.35,alpha);
    this.lines.curve(x=>pt(x,-1.35+0.76*lerp(this.rect(x,ctx),this.filtered(x,ctx),filtered)),-5.6,5.6,220,0.81*alpha);
    this.lines.curve(x=>pt(x,1.25+0.52*this.rect(x,ctx)),-5.6,5.6,220,0.22*alpha,true);
    // Resistor, capacitor and ground are schematic line geometry.
    const y=2.32;
    this.lines.line(pt(-2.1,y),pt(-1.3,y),0.38*alpha);
    for(let i=0;i<7;i++){
      const xa=-1.3+i*0.19,xb=xa+0.19;
      this.lines.line(pt(xa,y+(i%2?0.12:-0.12)),pt(xb,y+(i%2?-0.12:0.12)),0.47*alpha);
    }
    this.lines.line(pt(0.03,y),pt(1.8,y),0.38*alpha);
    this.lines.line(pt(0.8,y),pt(0.8,1.9),0.36*alpha);
    this.lines.line(pt(0.5,1.9),pt(1.1,1.9),0.47*alpha);
    this.lines.line(pt(0.5,1.76),pt(1.1,1.76),0.47*alpha);
    this.lines.line(pt(0.8,1.76),pt(0.8,1.42),0.3*alpha);
    for(let j=0;j<3;j++)this.lines.line(pt(0.55+j*0.08,1.42-j*0.08),pt(1.05-j*0.08,1.42-j*0.08),0.34*alpha);
    this.labels.set('tau','τ = RC',1270,215,alpha,19);
    this.labels.set('filterName','FIRST ORDER LOW-PASS',1260,255,alpha*0.57,13,true);
  }

  private integration(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'signal.integration'),end=this.at(ctx,'signal.feedback');
    const alpha=smoothstep(phase(t,start-0.2,start+0.35))*(1-smoothstep(phase(t,end,end+0.8)));
    if(alpha<=0)return;
    const theta=(x:number)=>this.theta(x,ctx);
    const grow=smoothstep(phase(t,start+0.25,start+1.3));
    this.axis(-1.55,alpha);
    this.lines.curve(x=>pt(x,1.05+0.38*Math.sign(Math.sin(theta(x)))),-5.2,5.2,240,0.38*alpha,true);
    this.lines.curve(x=>pt(x,-1.55+1.12*(triangle(theta(x))-0.5)),-5.2,lerp(-5.2,5.2,grow),Math.max(1,Math.ceil(220*grow)),0.85*alpha);
    this.lines.rect(-1.05,1.65,1.05,2.42,0.32*alpha);
    this.labels.set('integral','∫',925,177,alpha,37);
    this.labels.set('integralFormula','y(t) = ∫ x(t) dt',1280,237,alpha,18);
    this.labels.set('integrationLabels','INPUT                            OUTPUT',210,780,alpha*0.55,13,true);
  }

  private feedback(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'signal.feedback');
    const alpha=smoothstep(phase(t,start-0.22,start+0.5));
    const graph=smoothstep(phase(ctx.progress,0.90,0.995));
    const diagram=alpha*(1-graph);
    const by=-0.15;
    this.lines.rect(-1.7,-0.9,1.7,0.7,0.48*diagram);
    this.lines.line(pt(-5.5,by),pt(-1.7,by),0.55*diagram);
    this.lines.line(pt(1.7,by),pt(5.4,by),0.55*diagram);
    this.lines.line(pt(3.9,by),pt(3.9,-2.0),0.26*diagram,true);
    this.lines.line(pt(3.9,-2.0),pt(-3.8,-2.0),0.26*diagram,true);
    this.lines.line(pt(-3.8,-2.0),pt(-3.8,by),0.26*diagram,true);
    this.lines.point(pt(-3.8,by),0.72*diagram,0.05);
    this.lines.point(pt(3.9,by),0.72*diagram,0.05);
    const beats=Math.max(0,Math.floor((ctx.time-ctx.music.markers['signal.feedback'])/(ctx.music.nextBeat-ctx.music.previousBeat)));
    for(let i=0;i<Math.min(4,beats);i++)this.lines.point(pt(-1.9+i*0.45,-2.0),0.5*diagram,0.03);
    this.labels.set('system','SYSTEM',817,455,0.75*diagram,19);
    this.labels.set('feedback','feedback',675,735,0.55*diagram,13,true);
    this.labels.set('iteration','xₙ₊₁ = f(xₙ)',1300,230,0.85*diagram,19);
    // At the boundary this same static graph is handed directly to NETWORK.
    for(const [i,j] of graphEdges.slice(0,3)){
      const a=graphNodes[i],b=graphNodes[j];
      this.lines.line(pt(a[0],a[1]),pt(b[0],b[1]),0.38*graph,true);
    }
    graphNodes.slice(0,4).forEach(n=>this.lines.point(pt(n[0],n[1]),0.9*graph,0.065));
  }

  render(ctx:SceneContext):void{
    const t=ctx.localTime;
    this.lines.clear();this.labels.clear();
    this.waveform(t,ctx);this.rectify(t,ctx);this.filter(t,ctx);this.integration(t,ctx);this.feedback(t,ctx);
    this.lines.flush();this.renderer.render(this.world,this.camera);
  }
}
