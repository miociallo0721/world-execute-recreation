import { Drawing, type V } from './Drawing';
import { graphEdges, graphNodes } from './continuity';
import { clamp, lerp } from '../utils/math';

const Z=-14;
const point=(side:-1|1,index:number):V=>{
  const node=graphNodes[index];
  return [side*3+side*node[0]*0.63,node[1]*0.63,Z];
};
const cross:readonly (readonly [number,number])[]=[[6,6],[5,2],[2,5],[4,4],[7,3],[3,7],[1,1],[0,0]];
const existing=(a:number,b:number)=>graphEdges.some(([i,j])=>(a===i&&b===j)||(a===j&&b===i));
const dense:[number,number][]=[];
for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)if(!existing(i,j))dense.push([i,j]);

export interface RelationshipOptions {
  graphAlpha?:number;
  connectionCount?:number;
  density?:number;
  waveAmplitude?:number;
  time?:number;
  beatDuration?:number;
  coherence?:number;
}

// The canonical pair is identical to NETWORK's final static layout.
export function drawRelationship(lines:Drawing,options:RelationshipOptions={}):void{
  const alpha=options.graphAlpha??1;
  const count=options.connectionCount??1;
  const density=options.density??0;
  const coherence=options.coherence??0;
  const beatDuration=options.beatDuration??0.461538;
  for(const side of [-1,1] as const){
    graphEdges.forEach(([i,j],edgeIndex)=>{
      const a=point(side,i),b=point(side,j);
      const pulse=1+0.04*coherence*Math.sin(2*Math.PI*(options.time??0)/(2*beatDuration)+edgeIndex*0.55);
      lines.line(a,b,0.35*alpha*pulse,true);
    });
    graphNodes.forEach((_,i)=>lines.point(point(side,i),0.85*alpha,0.06));
    dense.forEach(([i,j],index)=>{
      const reveal=clamp(density*dense.length-index,0,1);
      lines.line(point(side,i),point(side,j),0.13*alpha*reveal,true);
    });
  }
  cross.forEach(([i,j],index)=>{
    const reveal=clamp(count-index,0,1);
    if(reveal<=0)return;
    const a=point(-1,i),b=point(1,j);
    if(index===0 && (options.waveAmplitude??0)>0.0001){
      const amplitude=options.waveAmplitude??0;
      const temporal=2*Math.PI*(options.time??0)/(4*beatDuration);
      lines.curve(u=>[
        lerp(a[0],b[0],u),
        lerp(a[1],b[1],u)+amplitude*Math.sin(Math.PI*u)*Math.sin(4*Math.PI*u)*Math.sin(temporal),
        Z,
      ],0,1,80,0.81*reveal*alpha);
    }else lines.line(a,b,(index===0?0.81:0.22)*reveal*alpha,index!==0);
  });
}

export function relationshipNode(side:-1|1,index:number):V{return point(side,index);}
