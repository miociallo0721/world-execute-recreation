import * as THREE from 'three';
import type { SceneContext } from '../engine/types';
import { SceneBase } from './SceneBase';
import { Drawing, Annotations, type V } from './Drawing';
import { carrier } from './continuity';
import { clamp, lerp, phase } from '../utils/math';
import { smoothstep } from '../utils/easing';

const Z = -14;
const p3 = (x: number, y: number, z = Z): V => [x,y,z];

export class FunctionScene extends SceneBase {
  readonly id = 'FUNCTION';
  private readonly world = new THREE.Scene();
  private readonly lines = new Drawing();
  private readonly labels: Annotations;
  private readonly camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.01, 200);
  private readonly icoEdges: readonly (readonly [V,V])[];
  private width = 1920;
  private height = 1080;
  private readonly origin: number;

  constructor(private readonly renderer: THREE.WebGLRenderer, overlay: HTMLElement, start: number) {
    super();
    this.origin = start;
    this.labels = new Annotations(overlay);
    const primitive = new THREE.IcosahedronGeometry(1);
    const edges = new THREE.EdgesGeometry(primitive, 1);
    const attr = edges.getAttribute('position');
    const all: [V,V][] = [];
    for (let i = 0; i < attr.count; i += 2) {
      const a: V = [attr.getX(i)*2.05,attr.getY(i)*2.05,attr.getZ(i)*2.05];
      const b: V = [attr.getX(i+1)*2.05,attr.getY(i+1)*2.05,attr.getZ(i+1)*2.05];
      all.push([a,b]);
    }
    this.icoEdges = all;
    primitive.dispose(); edges.dispose();
  }

  init(): void { this.world.add(this.lines.object); this.resize(this.width,this.height); }
  resize(width: number, height: number): void {
    this.width = width; this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  dispose(): void { this.lines.dispose(); this.labels.dispose(); }

  private at(ctx: SceneContext, marker: string): number { return ctx.music.markers[marker] - this.origin; }
  substageAt(t: number): string {
    if (t < 2.5) return 'DISCRETE → CONTINUOUS';
    if (t < 6) return 'LINEAR';
    if (t < 10) return 'SINE';
    if (t < 13) return 'FREQUENCY';
    if (t < 16.5) return 'POLAR';
    return 'SURFACE';
  }

  private cameraAt(t: number): void {
    const q = smoothstep(phase(t,0,2.6));
    this.camera.position.set(lerp(3.80,0,q),lerp(-2.34,0,q),lerp(-1.34,0,q));
    this.camera.lookAt(0,0,lerp(-14.74,-14,q));
    this.camera.updateMatrixWorld();
  }

  private drawLattice(t: number): void {
    const disappear = 1-smoothstep(phase(t,0.1,2.1));
    const chain = smoothstep(phase(t,0.25,1.9));
    const sites: V[] = [];
    for (let i=-1;i<=1;i++) for (let j=-1;j<=1;j++) for (let k=-1;k<=1;k++) {
      const shell=Math.abs(i)+Math.abs(j)+Math.abs(k);
      if(shell>1 && !(k===0 && Math.abs(i)===1 && Math.abs(j)===1)) continue;
      const at: V=[i*5.2,j*5.2,k*5.2+Z];
      sites.push(at);
      const base=shell===0?0.4:shell===1?0.17:0.09;
      const keep=j===0&&k===0?1:1-chain;
      for(const [a,b] of this.icoEdges){
        this.lines.line([a[0]+at[0],a[1]+at[1],a[2]+at[2]],
          [b[0]+at[0],b[1]+at[1],b[2]+at[2]],base*keep*disappear,true);
      }
      for(const [a] of this.icoEdges)this.lines.point([a[0]+at[0],a[1]+at[1],a[2]+at[2]],base*0.45*keep*disappear,0.017);
      this.lines.point(at,(shell===0?0.7:0.25)*disappear*keep,0.035);
    }
    for (const s of sites) if(Math.abs(s[0])+Math.abs(s[1])+Math.abs(s[2]-Z)===5.2)
      this.lines.line(p3(0,0),s,0.07*disappear,true);
    for(let i=-3;i<=3;i++){
      const a=smoothstep(phase(t,0.65+Math.abs(i)*0.11,1.2+Math.abs(i)*0.11));
      this.lines.point(p3(i*1.75,0),0.75*a*chain,0.035);
    }
    const dense=phase(t,1.25,2.3);
    for(let i=-24;i<=24;i++) this.lines.point(p3(i*0.26,0),0.32*dense,0.012);
    this.lines.partial(p3(-6.65,0),p3(6.65,0),phase(t,1.55,2.5),0.6);
  }

  private axes(alpha: number): void {
    this.lines.line(p3(-6.7,0),p3(6.7,0),0.3*alpha);
    this.lines.line(p3(0,-2.85),p3(0,2.85),0.16*alpha,true);
    for(let i=-6;i<=6;i++) this.lines.line(p3(i,-0.045),p3(i,0.045),0.2*alpha);
    for(let i=-2;i<=2;i++) this.lines.line(p3(-0.04,i),p3(0.04,i),0.12*alpha,true);
  }

  private linear(t: number, ctx: SceneContext): void {
    const start=this.at(ctx,'function.linear');
    const sine=this.at(ctx,'function.sine');
    const alpha=smoothstep(phase(t,start-0.15,start+0.4))*(1-smoothstep(phase(t,sine+0.7,sine+1.4)));
    if(alpha<=0) return;
    const beat=ctx.music.beatIndex-Math.floor((ctx.music.markers['function.linear']-ctx.music.previousBeat)/(ctx.music.nextBeat-ctx.music.previousBeat));
    // Three exact slopes, each held for two beats and gently interpolated.
    const slopeIndex=clamp(Math.floor((ctx.time-ctx.music.markers['function.linear'])/(2*(ctx.music.nextBeat-ctx.music.previousBeat))),0,2);
    const slopes=[-0.4,0,0.44];
    const q=smoothstep(phase(ctx.time,ctx.music.markers['function.linear']+slopeIndex*2*(ctx.music.nextBeat-ctx.music.previousBeat),ctx.music.markers['function.linear']+(slopeIndex*2+0.6)*(ctx.music.nextBeat-ctx.music.previousBeat)));
    const m=lerp(slopes[Math.max(0,slopeIndex-1)],slopes[slopeIndex],slopeIndex===0?1:q);
    const b=0.25;
    const draw=phase(t,start+0.7,start+2.25);
    this.lines.point(p3(0,b),0.85*alpha,0.055);
    this.lines.partial(p3(-5.7,m*-5.7+b),p3(5.7,m*5.7+b),draw,0.84*alpha);
    const tri=phase(t,start+0.2,start+0.55)*(1-phase(t,start+1.35,start+1.8));
    this.lines.line(p3(1,b),p3(2,b),0.52*tri,true);
    this.lines.line(p3(2,b),p3(2,m+b),0.52*tri,true);
    this.labels.set('linear','y = mx + b',1320,210,alpha,21);
    this.labels.set('slope','Δy / Δx = m',1320,250,tri,14,true);
    this.labels.set('slopeValue',beat<0?'P₀':`m ${m<-.1?'< 0':m>.1?'> 0':'= 0'}`,1030,310,alpha*0.7,14,true);
  }

  private sine(t: number, ctx: SceneContext): void {
    const start=this.at(ctx,'function.sine');
    const end=this.at(ctx,'function.frequency');
    const alpha=smoothstep(phase(t,start-0.3,start+0.3))*(1-smoothstep(phase(t,end-0.35,end+0.45)));
    if(alpha<=0) return;
    const morph=smoothstep(phase(t,start-0.25,start+0.95));
    const draw=phase(t,start-0.1,start+1.55);
    const xEnd=lerp(-5.9,5.9,draw);
    this.lines.curve(x=>p3(x,lerp(0.27*x+0.25,0.82*Math.sin(x),morph)), -5.9,xEnd,Math.max(1,Math.ceil(160*draw)),0.83*alpha);
    const circle=phase(t,start+1.0,start+1.4);
    this.lines.circle(-3.7,1.18,0.72,0.39*circle,1,Z,true);
    // One revolution occupies exactly four beats, independent of preview frame rate.
    const angle=2*Math.PI*(ctx.time-ctx.music.markers['function.sine'])/(4*(ctx.music.nextBeat-ctx.music.previousBeat));
    const px=-3.7+0.72*Math.cos(angle), py=1.18+0.72*Math.sin(angle);
    this.lines.point(p3(px,py),0.8*circle,0.045);
    this.lines.line(p3(-3.7,1.18),p3(px,py),0.3*circle,true);
    const waveX=((angle%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
    this.lines.line(p3(px,py),p3(waveX,py),0.15*circle,true);
    this.lines.line(p3(waveX,py),p3(waveX,0.82*Math.sin(waveX)),0.15*circle,true);
    this.lines.point(p3(waveX,0.82*Math.sin(waveX)),0.48*circle,0.028);
    this.labels.set('sine','y = sin x',1330,204,alpha,21);
    this.labels.set('projection','P(θ) = (cos θ, sin θ)',1200,250,0.75*circle,14,true);
  }

  private frequency(t: number, ctx: SceneContext): void {
    const start=this.at(ctx,'function.frequency'), end=this.at(ctx,'function.polar');
    const alpha=smoothstep(phase(t,start-0.15,start+0.25))*(1-smoothstep(phase(t,end-0.1,end+0.35)));
    if(alpha<=0)return;
    const harmonic=[1,2,3,4].map((n)=>n===1?1:smoothstep(phase(ctx.time,ctx.music.markers[`function.harmonic.${n}`],ctx.music.markers[`function.harmonic.${n}`]+0.32)));
    for(const [j,n] of [1,2,4].entries()) this.lines.curve(x=>p3(x,1.15-j*1.08+0.3*Math.sin(n*x)), -5.7,5.7,180,alpha*(j===0?0.32:0.17),true);
    this.lines.curve(x=>p3(x,-1.65+0.38*Math.sin(x)+0.22*harmonic[1]*Math.sin(2*x+0.4)+0.14*harmonic[2]*Math.sin(3*x-0.5)+0.11*harmonic[3]*Math.sin(4*x+0.9)), -5.7,5.7,220,0.86*alpha);
    this.labels.set('freq','sin x   /   sin 2x   /   sin 4x',1250,185,alpha*0.72,14,true);
    this.labels.set('sum','f(x) = Σ aₙ sin(nωx + φₙ)',1200,245,alpha,19);
  }

  private polar(t: number,ctx: SceneContext): void {
    const start=this.at(ctx,'function.polar'), end=this.at(ctx,'function.surface');
    const alpha=smoothstep(phase(t,start-0.15,start+0.3))*(1-smoothstep(phase(t,end,end+0.75)));
    if(alpha<=0)return;
    const lobe=smoothstep(phase(ctx.time,ctx.music.markers['function.polar.lobes'],ctx.music.markers['function.polar.lobes']+0.75));
    const rose=smoothstep(phase(ctx.time,ctx.music.markers['function.polar.rose'],ctx.music.markers['function.polar.rose']+0.9));
    this.lines.point(p3(0,0),0.63*alpha,0.04);
    this.lines.curve(theta=>{
      const r=lerp(lerp(1.65,1.65+0.58*Math.cos(3*theta),lobe),2.35*Math.cos(5*theta),rose);
      return p3(r*Math.cos(theta),r*Math.sin(theta));
    },0,2*Math.PI,240,0.84*alpha);
    for(let i=0;i<4;i++) this.lines.circle(0,0,0.85+i*0.65,0.055*alpha,1,Z,true);
    this.labels.set('polar',rose>0.65?'r = cos(5θ)':lobe>0.55?'r = 1 + 0.35 cos(3θ)':'r = 1',1300,220,alpha,19);
    this.labels.set('polarContext','r = f(θ)',1300,265,alpha*0.55,14,true);
  }

  private surface(t: number,ctx: SceneContext): void {
    const start=this.at(ctx,'function.surface');
    const enter=smoothstep(phase(t,start-0.12,start+0.75));
    if(enter<=0)return;
    const end=ctx.progress>0.95?1:smoothstep(phase(ctx.progress,0.86,0.99));
    const gridAlpha=enter*(1-end);
    const tilt=smoothstep(phase(t,start,start+1.3));
    const omega=2*Math.PI/(4*(ctx.music.nextBeat-ctx.music.previousBeat));
    const h=(x:number,y:number)=>0.53*Math.sin(Math.hypot(x,y)*1.45-omega*ctx.time);
    for(let j=-5;j<=5;j++){
      const y=j*0.46;
      this.lines.curve(x=>p3(x,y*(1-0.35*tilt)+h(x,y)*0.52*tilt, -14+y*0.5*tilt),-5.5,5.5,75,gridAlpha*(j===0?0.48:0.12),true);
    }
    for(let i=-7;i<=7;i++){
      const x=i*0.72;
      this.lines.curve(y=>p3(x,y*(1-0.35*tilt)+h(x,y)*0.52*tilt,-14+y*0.5*tilt),-2.3,2.3,38,0.1*gridAlpha,true);
    }
    // The sole surviving contour is exactly the SIGNAL scene's incoming sample.
    const wave=smoothstep(phase(t,start+2.1,start+3.2));
    this.lines.curve(x=>p3(x,lerp(h(x,0),carrier(x,ctx.music),wave)), -5.8,5.8,240,0.88*enter);
    this.labels.set('surface','z = sin(r − ωt)',1310,210,gridAlpha,19);
    this.labels.set('surfaceAxis','z = f(x, y)',1310,255,0.65*gridAlpha,14,true);
  }

  render(ctx: SceneContext): void {
    const t=ctx.localTime;
    this.cameraAt(t);
    this.lines.clear(); this.labels.clear();
    if(t<2.7)this.drawLattice(t);
    this.axes(smoothstep(phase(t,1.5,2.6))*(1-smoothstep(phase(t,12.5,13.8))));
    this.linear(t,ctx); this.sine(t,ctx); this.frequency(t,ctx); this.polar(t,ctx); this.surface(t,ctx);
    this.labels.set('domain','x ∈ ℝ',1500,130,phase(t,1.4,2.2)*(1-phase(t,12.8,13.6)),15,true);
    this.labels.set('latticeFormula','p = i·a + j·b + k·c\ni,j,k ∈ ℤ',112,180,1-phase(t,0.1,0.85),14,true);
    this.labels.set('dx','Δx → 0',1510,167,phase(t,1.7,2.2)*(1-phase(t,2.55,3.1)),13,true);
    this.lines.flush();
    this.renderer.render(this.world,this.camera);
  }
}
