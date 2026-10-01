import icons from './assets/reference-icons.json';

export const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export const smooth=(v:number)=>{const p=clamp(v);return p*p*(3-2*p);};
export const lerp=(a:number,b:number,p:number)=>a+(b-a)*p;
export const keys=(t:number,list:[number,number][])=>{
  if(t<=list[0][0])return list[0][1];
  for(let i=1;i<list.length;i++)if(t<list[i][0])return lerp(list[i-1][1],list[i][1],(t-list[i-1][0])/(list[i][0]-list[i-1][0]));
  return list[list.length-1][1];
};
export const typed=(s:string,elapsed:number,rate=20)=>s.slice(0,Math.floor(Math.max(0,elapsed)*rate));
export type IconName=keyof typeof icons;
export class Drawing {
  protected readonly paths=new Map<IconName,Path2D>();
  constructor(protected readonly c:CanvasRenderingContext2D){
    for(const k of Object.keys(icons) as IconName[])this.paths.set(k,new Path2D(icons[k].path));
  }
  protected text(s:string,x:number,y:number,size=56,color='#fafafa',align:CanvasTextAlign='left',font='TitleThin'){
    const c=this.c;c.font=`${size}px ${font}`;c.fillStyle=color;c.textAlign=align;c.textBaseline='alphabetic';c.fillText(s,x,y);
  }
  protected fitted(s:string,box:[number,number,number,number],color='#fafafa',font='TitleLight'){
    const c=this.c;c.save();c.font=`200px ${font}`;c.textAlign='left';c.textBaseline='alphabetic';
    const m=c.measureText(s),[x,y,w,h]=box;c.translate(x,y);c.scale(w/(m.actualBoundingBoxLeft+m.actualBoundingBoxRight),h/(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent));c.fillStyle=color;c.fillText(s,m.actualBoundingBoxLeft,m.actualBoundingBoxAscent);c.restore();
  }
  protected spaced(s:string,x:number,y:number,size:number,spacing:number,color='#fafafa',center=true,font='TitleThin'){
    const c=this.c;c.save();c.font=`${size}px ${font}`;c.textAlign='left';c.textBaseline='alphabetic';c.fillStyle=color;
    const width=[...s].reduce((w,ch)=>w+c.measureText(ch).width+spacing,0)-spacing;if(center)x-=width/2;
    for(const ch of s){c.fillText(ch,x,y);x+=c.measureText(ch).width+spacing;}c.restore();
  }
  protected line(x1:number,y1:number,x2:number,y2:number,width=3,color='#fafafa'){
    const length=Math.hypot(x2-x1,y2-y1);if(length<1e-8)return;
    const dx=-(y2-y1)*width/(2*length),dy=(x2-x1)*width/(2*length);
    this.polygon([[x1+dx,y1+dy],[x2+dx,y2+dy],[x2-dx,y2-dy],[x1-dx,y1-dy]],color);
  }
  protected polygon(points:[number,number][],color='#fafafa'){
    const c=this.c;c.beginPath();c.moveTo(...points[0]);for(const point of points.slice(1))c.lineTo(...point);c.closePath();c.fillStyle=color;c.fill();
  }
  protected ring(x:number,y:number,r:number,width=3,color='#fafafa',end=Math.PI*1.5,start=-Math.PI/2){
    const c=this.c;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,r,start,end);c.stroke();
  }
  protected icon(name:IconName,x:number,y:number,width?:number,height?:number,color='#fafafa'){
    const c=this.c,a=icons[name],w=width??a.width,h=height??a.height;c.save();c.translate(x,y);c.scale(w/a.width,h/a.height);c.fillStyle=color;c.fill(this.paths.get(name)!,'evenodd');c.restore();
  }
  protected referenceIcon(name:IconName,dx=0,dy=0,color='#fafafa'){
    const a=icons[name];this.icon(name,a.referenceBounds[0]+dx,a.referenceBounds[1]+dy,a.width,a.height,color);
  }
  protected bar(x:number,y:number,w:number,p:number,height=68){
    const c=this.c;c.strokeStyle='#eee';c.lineWidth=5;c.strokeRect(x,y,w,height);c.fillStyle='#f8f8f8';
    const step=31,n=Math.ceil((w-12)/step);for(let i=0;i<Math.floor(n*clamp(p));i++)c.fillRect(x+8+i*step,y+8,Math.min(24,w-16-i*step),height-16);
  }
  protected chip(x:number,y:number,size:number,color='#f8f8f8'){
    const c=this.c;c.save();c.translate(x,y);c.fillStyle=color;c.beginPath();c.rect(-size*.35,-size*.35,size*.7,size*.7);c.rect(-size*.19,-size*.19,size*.38,size*.38);c.fill('evenodd');
    for(let i=-3;i<=3;i++)for(const s of [-1,1]){c.fillRect(i*size*.09-size*.023,s*size*.39-size*.06,size*.046,size*.12);c.fillRect(s*size*.39-size*.06,i*size*.09-size*.023,size*.12,size*.046);}
    c.restore();
  }
  protected cube(x:number,y:number,r:number,color='#fafafa'){
    const c=this.c;c.save();c.translate(x,y);const points=Array.from({length:6},(_,i)=>[Math.sin(i*Math.PI/3)*r,-Math.cos(i*Math.PI/3)*r]);
    for(let i=0;i<6;i++)this.line(...points[i] as [number,number],...points[(i+1)%6] as [number,number],5,color);
    for(const i of [0,2,4])this.line(0,0,...points[i] as [number,number],5,color);
    this.line(0,0,0,r,5,color);this.line(-r*.866,-r*.5,r*.866,r*.5,4,color);c.restore();
  }
  protected warning(x:number,y:number,size:number,color='#fafafa',inside='#181818'){
    this.polygon([[x,y-size*.6],[x+size*.58,y+size*.43],[x-size*.58,y+size*.43]],color);
    const c=this.c;c.fillStyle=inside;c.fillRect(x-size*.045,y-size*.29,size*.09,size*.37);c.beginPath();c.arc(x,y+size*.25,size*.052,0,Math.PI*2);c.fill();
  }
  protected shield(x:number,y:number,w:number,color='#fafafa',hole='#101010'){
    const c=this.c;c.save();c.translate(x,y);c.scale(w/300,w/300);c.fillStyle=color;
    c.beginPath();c.moveTo(0,-175);c.lineTo(155,-78);c.bezierCurveTo(150,74,86,173,0,219);c.bezierCurveTo(-86,173,-150,74,-155,-78);c.closePath();c.fill();
    c.fillStyle=hole;c.beginPath();c.arc(0,-5,34,0,Math.PI*2);c.fill();this.polygon([[-20,18],[20,18],[38,85],[-38,85]],hole);c.restore();
  }
  protected door(x:number,y:number,w=153,h=264){
    const c=this.c;c.fillStyle='#121212';c.beginPath();c.roundRect(x,y,w,h,7);c.fill();
    for(const cy of [y+h*.29,y+h*.72])this.polygon([[x+w*.30,cy-h*.105],[x+w*.53,cy-h*.14],[x+w*.72,cy-h*.10],[x+w*.72,cy+h*.10],[x+w*.52,cy+h*.13],[x+w*.30,cy+h*.09]],'#e7e7e7');
    c.fillStyle='#eee';c.beginPath();c.arc(x+w*.16,y+h*.51,w*.035,0,Math.PI*2);c.fill();
  }
  protected ban(x:number,y:number,r=102,alpha=1){
    const c=this.c;c.save();c.globalAlpha*=alpha;this.ring(x,y,r,13,'#a92a2e');this.line(x-r*.7,y+r*.7,x+r*.7,y-r*.7,13,'#a92a2e');c.restore();
  }
}
