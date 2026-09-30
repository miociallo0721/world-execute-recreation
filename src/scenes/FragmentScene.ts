import * as THREE from 'three';
import type { SceneContext } from '../engine/types';
import { SceneBase } from './SceneBase';
import { Annotations, Drawing, type V } from './Drawing';
import { FragmentField } from './fragmentModel';
import { drawRelationship } from './relationship';
import { randomAt } from '../utils/random';
import { phase } from '../utils/math';
import { smoothstep } from '../utils/easing';

const Z=-14;
const pt=(x:number,y:number):V=>[x,y,Z];

export class FragmentScene extends SceneBase {
  readonly id='FRAGMENT';
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
    if(t<3.7)return 'OVER-DENSITY';if(t<7.4)return 'MEMORY BLOCKS';
    if(t<11.1)return 'SPATIAL FRAGMENTATION';if(t<14.8)return 'TOPOLOGY BREAK';return 'SHATTERED STATE';
  }

  private overDensity(t:number,ctx:SceneContext):void{
    const memory=this.at(ctx,'fragment.memory');
    const alpha=1-smoothstep(phase(t,memory-0.25,memory+1.1));
    if(alpha<=0)return;
    const beat=ctx.music.nextBeat-ctx.music.previousBeat;
    const count=5+[2,4,6].reduce((sum,n)=>sum+smoothstep(phase(ctx.time,ctx.music.markers['fragment.start']+n*beat,ctx.music.markers['fragment.start']+(n+0.5)*beat)),0);
    const density=smoothstep(phase(t,0.55,memory+0.25));
    drawRelationship(this.lines,{graphAlpha:alpha,connectionCount:count,density:0.82*density,time:ctx.time,beatDuration:beat});
    this.labels.set('me','ME',410,180,alpha,15);
    this.labels.set('you','YOU',1450,180,alpha,15);
    this.labels.set('edges','|E| ↑',1300,205,alpha*phase(t,0.6,1.3),14,true);
    const usage=0.25+0.69*density;
    const usageAlpha=alpha*smoothstep(phase(t,0.25,0.8));
    this.lines.line(pt(-1.9,-2.72),pt(1.9,-2.72),0.13*usageAlpha,true);
    this.lines.partial(pt(-1.9,-2.72),pt(1.9,-2.72),usage,0.37*usageAlpha);
    this.labels.set('memoryUsage',`memory usage   ${(usage*100).toFixed(0)}%`,725,890,0.48*alpha*phase(t,0.9,1.5),12,true);
  }

  private blocks(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'fragment.memory'),free=this.at(ctx,'fragment.free'),spatial=this.at(ctx,'fragment.spatial');
    const alpha=smoothstep(phase(t,start-0.35,start+0.6))*(1-smoothstep(phase(t,spatial+0.15,spatial+1.25)));
    if(alpha<=0)return;
    const unallocated=smoothstep(phase(t,free,free+1.0));
    for(let row=0;row<4;row++)for(let col=0;col<12;col++){
      const i=row*12+col;
      const release=randomAt(5201,i)>0.54;
      const level=release?1-0.9*unallocated:1;
      const x=-5.55+col*0.93,y=1.77-row*0.9;
      this.lines.rect(x,y-0.56,x+0.73,y,alpha*level*0.34,Z,release);
      if(level>0.2)this.lines.line(pt(x+0.12,y-0.39),pt(x+0.5,y-0.39),alpha*level*0.14,true);
    }
    for(let row=0;row<4;row++)this.labels.set(`address${row}`,`0x${(row*0x10).toString(16).padStart(4,'0').toUpperCase()}`,175,300+row*135,0.48*alpha,12,true);
    this.labels.set('memory','allocated   free   allocated',1190,192,alpha*unallocated,13,true);
  }

  private geometry(t:number,ctx:SceneContext):void{
    const start=this.at(ctx,'fragment.spatial'),topology=this.at(ctx,'fragment.topology'),shattered=this.at(ctx,'fragment.shattered');
    const alpha=smoothstep(phase(t,start-0.25,start+0.65));
    if(alpha<=0)return;
    const top=smoothstep(phase(t,topology,topology+1.45));
    const scatter=smoothstep(phase(t,shattered,shattered+1.6));
    const separation=0.08*smoothstep(phase(t,start+1.3,topology))+0.38*top+0.54*scatter;
    this.field.draw(this.lines,separation,0.75*alpha,0.35);
    this.labels.set('partition','Ω = ⋃ Ωᵢ',1300,180,0.48*alpha*(1-scatter),14,true);
    const componentTwo=ctx.music.markers['fragment.topology']+2*(ctx.music.nextBeat-ctx.music.previousBeat);
    const componentFour=ctx.music.markers['fragment.topology']+4*(ctx.music.nextBeat-ctx.music.previousBeat);
    const components=ctx.time<componentTwo?1:ctx.time<componentFour?2:4;
    this.labels.set('components',`components = ${components}`,1270,228,0.65*top*(1-scatter),14);
    this.labels.set('disconnect','connected → disconnected',1270,271,0.45*top*(1-scatter),13,true);
    this.labels.set('undefined','global transform: undefined',1250,190,
      0.78*smoothstep(phase(ctx.time,ctx.music.markers['fragment.undefined'],ctx.music.markers['fragment.undefined']+0.35)),14,true);
  }

  render(ctx:SceneContext):void{
    const t=ctx.localTime;
    this.lines.clear();this.labels.clear();
    this.overDensity(t,ctx);this.blocks(t,ctx);this.geometry(t,ctx);
    this.lines.flush();this.renderer.render(this.world,this.camera);
  }
}
