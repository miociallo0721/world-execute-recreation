import * as THREE from 'three';
import type { SceneContext } from '../engine/types';
import { SceneBase } from './SceneBase';
import { Annotations, Drawing, type V } from './Drawing';
import { graphEdges, graphNodes } from './continuity';
import { clamp, lerp, phase } from '../utils/math';
import { smoothstep } from '../utils/easing';

const Z=-14;
const pt=(x:number,y:number):V=>[x,y,Z];
const edge=(a:number,b:number):boolean=>graphEdges.some(([i,j])=>(a===i&&b===j)||(a===j&&b===i));
const W=[[0.7,-0.22,0.13],[-0.18,0.61,0.27],[0.09,0.34,0.53]] as const;
const X=[0.8,-0.35,0.58] as const;
const B=[0.1,-0.08,0.04] as const;
const Y=W.map((row,i)=>row.reduce<number>((sum,w,j)=>sum+w*X[j],B[i]));
const Q:readonly (readonly number[])[]=[[1,0,0.2],[0.3,0.9,-0.1],[-0.5,0.3,0.8],[0.2,-0.6,0.9]];
const K:readonly (readonly number[])[]=[[0.85,0.1,0.25],[0.2,0.9,0.1],[-0.4,0.2,0.9],[0.1,-0.5,0.9]];
const attention=Q.map(q=>{
  const logits=K.map(k=>q.reduce((sum,v,j)=>sum+v*k[j],0)/Math.sqrt(3));
  const exp=logits.map(v=>Math.exp(v-Math.max(...logits)));
  const norm=exp.reduce((a,b)=>a+b,0);
  return exp.map(v=>v/norm);
});

export class NetworkScene extends SceneBase {
  readonly id='NETWORK';
  private readonly world=new THREE.Scene();
  private readonly camera=new THREE.PerspectiveCamera(38,16/9,0.01,200);
  private readonly lines=new Drawing();
  private readonly labels:Annotations;
  private width=1920; private height=1080;
  private readonly origin:number;

  constructor(private readonly renderer:THREE.WebGLRenderer,overlay:HTMLElement,start:number){
    super();this.origin=start;this.labels=new Annotations(overlay);
    this.camera.position.set(0,0,0);this.camera.lookAt(0,0,Z);
  }
  init():void{this.world.add(this.lines.object);this.resize(this.width,this.height);}
  resize(width:number,height:number):void{this.width=width;this.height=height;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  dispose():void{this.lines.dispose();this.labels.dispose();}
  private at(ctx:SceneContext,id:string):number{return ctx.music.markers[id]-this.origin;}
  substageAt(t:number):string{
    if(t<3.5)return 'GRAPH';if(t<7)return 'MATRIX';if(t<11)return 'LINEAR TRANSFORM';
    if(t<14.5)return 'ATTENTION';if(t<17.5)return 'ME';return 'YOU';
  }

  private graph(shift:number,scale:number,edgeCount:number,alpha:number,highlight=-1):void{
    const visible=new Set<number>();
    graphEdges.forEach(([i,j],index)=>{
      if(index>=edgeCount)return;
      visible.add(i);visible.add(j);
      const a=graphNodes[i],b=graphNodes[j];
      this.lines.line(pt(shift+a[0]*scale,a[1]*scale),pt(shift+b[0]*scale,b[1]*scale),
        alpha*(highlight===index?0.75:0.38),highlight!==index);
    });
    graphNodes.forEach((n,i)=>{
      if(visible.has(i))this.lines.point(pt(shift+n[0]*scale,n[1]*scale),0.9*alpha,0.065*scale);
    });
  }

  private graphStage(t:number,ctx:SceneContext):void{
    const matrix=this.at(ctx,'network.matrix');
    const exit=smoothstep(phase(t,matrix-0.2,matrix+1.0));
    const alpha=1-smoothstep(phase(t,matrix+2.8,matrix+3.8));
    if(alpha<=0)return;
    const count=Math.min(graphEdges.length,Math.max(3,3+Math.floor((ctx.time-ctx.music.markers['network.start'])/(ctx.music.nextBeat-ctx.music.previousBeat))*2));
    const reveal=phase(t,0,2.2);
    this.graph(lerp(0,-2.75,exit),lerp(1,0.69,exit),Math.max(count,Math.round(14*reveal)),alpha);
    this.labels.set('graph','G = (V, E)',1330,200,smoothstep(phase(t,0.35,0.9))*alpha,18);
    this.labels.set('vertices',`|V| = ${graphNodes.length}     |E| = ${Math.min(count,graphEdges.length)}`,1330,242,0.62*alpha*smoothstep(phase(t,0.45,1.0)),13,true);
  }

  private matrixStage(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'network.matrix'),end=this.at(ctx,'network.transform');
    const alpha=smoothstep(phase(t,start-0.1,start+0.5))*(1-smoothstep(phase(t,end-0.15,end+0.65)));
    if(alpha<=0)return;
    const cell=0.43, x0=1.36,y0=1.65;
    const selected=Math.floor(Math.max(0,ctx.time-ctx.music.markers['network.matrix'])/(ctx.music.nextBeat-ctx.music.previousBeat))%graphEdges.length;
    for(let i=0;i<8;i++)for(let j=0;j<8;j++){
      const x=x0+j*cell,y=y0-i*cell;
      const on=edge(i,j),[a,b]=graphEdges[selected];
      const emphasis=(i===a&&j===b)||(i===b&&j===a);
      this.lines.rect(x,y,x+cell*0.82,y+cell*0.82,alpha*(emphasis?0.82:on?0.25:0.065),Z,emphasis);
      if(on)this.lines.point(pt(x+cell*0.41,y+cell*0.41),alpha*(emphasis?0.9:0.3),0.018);
    }
    const [a,b]=graphEdges[selected];
    const pa=graphNodes[a],pb=graphNodes[b];
    this.lines.line(pt(-2.75+pa[0]*0.69,pa[1]*0.69),pt(-2.75+pb[0]*0.69,pb[1]*0.69),0.82*alpha);
    this.labels.set('matrix','Aᵢⱼ',1340,162,alpha,19);
    this.labels.set('matrixRelation','edge (i,j) ↔ Aᵢⱼ = 1',1300,255,0.66*alpha,13,true);
  }

  private transform(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'network.transform'),end=this.at(ctx,'network.attention');
    const alpha=smoothstep(phase(t,start-0.25,start+0.45))*(1-smoothstep(phase(t,end+0.45,end+1.2)));
    if(alpha<=0)return;
    const flow=smoothstep(phase(t,start+0.35,start+1.6));
    for(let i=0;i<3;i++){
      const yi=1.42-i*1.4;
      this.lines.point(pt(-4.8,yi),0.9*alpha,0.075);
      this.lines.point(pt(4.8,yi),0.85*alpha*flow,0.075);
      this.labels.set(`x${i}`,`x${i+1}  ${X[i].toFixed(2)}`,240,340+i*205,alpha,14,true);
      this.labels.set(`y${i}`,`y${i+1}  ${Y[i].toFixed(2)}`,1430,340+i*205,alpha*flow,14);
      for(let j=0;j<3;j++){
        const yj=1.42-j*1.4;
        this.lines.line(pt(-4.8,yj),pt(4.8,yi),alpha*(0.07+0.23*Math.abs(W[i][j]))*flow,W[i][j]<0);
      }
    }
    this.lines.rect(-0.85,-2.2,0.85,2.2,0.31*alpha);
    this.labels.set('weight','W',923,485,alpha,23);
    this.labels.set('transform','y = Wx + b',1340,198,alpha,20);
  }

  private attentionStage(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'network.attention'),end=this.at(ctx,'network.me');
    const alpha=smoothstep(phase(t,start-0.2,start+0.5))*(1-smoothstep(phase(t,end+0.1,end+1.1)));
    if(alpha<=0)return;
    const beatDuration=ctx.music.nextBeat-ctx.music.previousBeat;
    const focusFloat=Math.max(0,(ctx.time-ctx.music.markers['network.attention'])/(2*beatDuration));
    const current=Math.floor(focusFloat)%4,next=(current+1)%4;
    const blend=smoothstep(clamp((focusFloat-Math.floor(focusFloat)-0.55)/0.45,0,1));
    for(let i=0;i<4;i++){
      const y=1.8-i*1.2;
      this.lines.point(pt(-3.5,y),alpha*0.85,0.07);
      this.lines.point(pt(3.5,y),alpha*0.85,0.07);
      for(let j=0;j<4;j++){
        const weight=lerp(attention[current][j],attention[next][j],blend);
        const active=i===current||i===next;
        this.lines.line(pt(-3.5,y),pt(3.5,1.8-j*1.2),alpha*(active?0.08+0.55*weight:0.025),active?false:true);
      }
    }
    this.labels.set('q','Q',366,225,alpha,17);
    this.labels.set('k','K',1510,225,alpha,17);
    this.labels.set('attention','softmax(QKᵀ / √d)',1275,170,alpha,17);
  }

  private personGraph(side:-1|1,count:number,alpha:number,cycle:number,oscillationStrength=1):void{
    const x=side*3.0,scale=0.63;
    graphEdges.forEach(([i,j])=>{
      if(i>=count||j>=count)return;
      const a=graphNodes[i],b=graphNodes[j];
      const oscillation=side<0?1+0.075*oscillationStrength*Math.sin(cycle+i*0.8+j*0.5):1;
      this.lines.line(pt(x+a[0]*scale*side,a[1]*scale),pt(x+b[0]*scale*side,b[1]*scale),0.35*alpha*oscillation,true);
    });
    graphNodes.forEach((n,i)=>{
      if(i<count)this.lines.point(pt(x+n[0]*scale*side,n[1]*scale),0.85*alpha,0.06);
    });
  }

  private meYou(t:number,ctx:SceneContext):void{
    const me=this.at(ctx,'network.me'),you=this.at(ctx,'network.you');
    const a=smoothstep(phase(t,me-0.2,me+1.1));
    if(a<=0)return;
    const cycle=2*Math.PI*(ctx.time-ctx.music.markers['network.me'])/(8*(ctx.music.nextBeat-ctx.music.previousBeat));
    const frameSeconds=ctx.music.nextBeat-ctx.music.previousBeat;
    const nodeCount=clamp(1+Math.floor((ctx.time-ctx.music.markers['network.you'])/frameSeconds)*2,0,8);
    const b=smoothstep(phase(t,you,you+0.42));
    const settle=1-smoothstep(phase(ctx.time,ctx.music.markers['network.firstConnection'],ctx.music.markers['network.firstConnection']+0.4));
    this.personGraph(-1,8,a,cycle,settle);
    this.personGraph(1,nodeCount,b,0);
    this.labels.set('me','ME',410,180,a,15);
    this.labels.set('you','YOU',1450,180,b,15);
    const connection=smoothstep(phase(ctx.time,ctx.music.markers['network.firstConnection'],ctx.music.markers['network.firstConnection']+0.15));
    if(connection>0){
      const left=graphNodes[6],right=graphNodes[6];
      this.lines.partial(pt(-3-left[0]*0.63,left[1]*0.63),pt(3+right[0]*0.63,right[1]*0.63),connection,0.81);
    }
  }

  render(ctx:SceneContext):void{
    const t=ctx.localTime;
    this.lines.clear();this.labels.clear();
    this.graphStage(t,ctx);this.matrixStage(t,ctx);this.transform(t,ctx);this.attentionStage(t,ctx);this.meYou(t,ctx);
    this.lines.flush();this.renderer.render(this.world,this.camera);
  }
}
