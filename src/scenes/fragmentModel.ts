import { Drawing, type V } from './Drawing';
import { randomAt } from '../utils/random';
import { lerp } from '../utils/math';

type P=readonly [number,number];
type Segment=readonly [P,P];
type Cell={site:P; polygon:P[]; grid:Segment[]; curve:Segment[]; offset:P};
const Z=-14;
const bounds:P[]=[[-6.1,-3.2],[6.1,-3.2],[6.1,3.2],[-6.1,3.2]];
const cross=(a:P,b:P)=>a[0]*b[1]-a[1]*b[0];
const sub=(a:P,b:P):P=>[a[0]-b[0],a[1]-b[1]];
const add=(a:P,b:P,t:number):P=>[a[0]+b[0]*t,a[1]+b[1]*t];

function clipPolygon(poly:P[],normal:P,constant:number):P[]{
  const output:P[]=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    const da=constant-a[0]*normal[0]-a[1]*normal[1];
    const db=constant-b[0]*normal[0]-b[1]*normal[1];
    if(da>=-1e-9)output.push(a);
    if((da<0&&db>0)||(da>0&&db<0)){
      const u=da/(da-db);
      output.push([lerp(a[0],b[0],u),lerp(a[1],b[1],u)]);
    }
  }
  return output;
}

function clipSegment(a:P,b:P,polygon:P[]):Segment|null{
  let low=0,high=1;
  const direction=sub(b,a);
  for(let i=0;i<polygon.length;i++){
    const edge=sub(polygon[(i+1)%polygon.length],polygon[i]);
    const numerator=cross(edge,sub(a,polygon[i]));
    const denominator=cross(edge,direction);
    if(Math.abs(denominator)<1e-10){if(numerator<0)return null;continue;}
    const limit=-numerator/denominator;
    if(denominator>0)low=Math.max(low,limit);else high=Math.min(high,limit);
    if(low>=high)return null;
  }
  return [add(a,direction,low),add(a,direction,high)];
}

export class FragmentField {
  readonly cells:readonly Cell[];
  readonly focusIndex=12;

  constructor(){
    const sites:P[]=[];
    for(let row=0;row<4;row++)for(let col=0;col<5;col++){
      const i=row*5+col;
      sites.push([-4.8+col*2.4+(randomAt(2619,i*2)-0.5)*0.52,
        -2.32+row*1.55+(randomAt(2619,i*2+1)-0.5)*0.34]);
    }
    this.cells=sites.map((site,index)=>{
      let polygon:P[]=[...bounds];
      for(const other of sites){
        if(other===site)continue;
        const normal:P=[other[0]-site[0],other[1]-site[1]];
        const constant=(other[0]*other[0]+other[1]*other[1]-site[0]*site[0]-site[1]*site[1])/2;
        polygon=clipPolygon(polygon,normal,constant);
      }
      const grid:Segment[]=[],curve:Segment[]=[];
      for(let x=-6;x<=6;x++){
        const segment=clipSegment([x,-3.2],[x,3.2],polygon);
        if(segment)grid.push(segment);
      }
      for(let y=-3;y<=3;y++){
        const segment=clipSegment([-6.1,y],[6.1,y],polygon);
        if(segment)grid.push(segment);
      }
      const wave=(x:number)=>0.58*Math.sin(1.42*x)+0.14*Math.cos(2.15*x);
      for(let j=0;j<244;j++){
        const a=-6.1+j*0.05,b=a+0.05;
        const segment=clipSegment([a,wave(a)],[b,wave(b)],polygon);
        if(segment)curve.push(segment);
      }
      const offset:P=[0.24*site[0]/6+(randomAt(3917,index*2)-0.5)*0.28,
        0.20*site[1]/3+(randomAt(3917,index*2+1)-0.5)*0.26];
      return {site,polygon,grid,curve,offset};
    });
  }

  private moved(p:P,cell:Cell,separation:number,zoom=0):V{
    const x=p[0]+cell.offset[0]*separation,y=p[1]+cell.offset[1]*separation;
    return [lerp(x,(p[0]-cell.site[0])*2.8,zoom),
      lerp(y,(p[1]-cell.site[1])*2.8,zoom),Z];
  }

  draw(lines:Drawing,separation:number,alpha:number,borderAlpha=0.2,focus?:{index:number;zoom:number}):void{
    this.cells.forEach((cell,index)=>{
      if(focus&&focus.index!==index)return;
      const zoom=focus?.zoom??0;
      const move=(p:P)=>this.moved(p,cell,separation,zoom);
      cell.polygon.forEach((p,j)=>lines.line(move(p),move(cell.polygon[(j+1)%cell.polygon.length]),alpha*borderAlpha,true));
      cell.grid.forEach(([a,b])=>lines.line(move(a),move(b),alpha*0.17,true));
      cell.curve.forEach(([a,b])=>lines.line(move(a),move(b),alpha*0.64));
    });
  }
}
