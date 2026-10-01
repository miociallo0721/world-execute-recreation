"""Development-only vector tracing of isolated icons from authorized reference.

No source frame is bundled or used as a playback texture. Output contains only
polygon contours. Requires Pillow, numpy, scipy and measurement PNGs.
"""
from pathlib import Path
import json,sys,subprocess
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as ndi

root=Path(__file__).resolve().parents[2]
source=Path(sys.argv[1]) if len(sys.argv)>1 else root/'recreation/output/reference-analysis'
source.mkdir(parents=True,exist_ok=True)
target=Path(__file__).resolve().parents[1]/'src/assets/reference-icons.json'
# name: timestamp, isolated bounds, polarity, threshold after removing raster.
specs={
 'eggplant':(76.1,(850,470,1080,680),'dark',90),
 'tomato':(78.9,(835,435,1085,705),'light',100),
 'cup':(80.8,(875,455,1045,705),'light',105),
 'catWalk':(82.7,(790,475,1110,704),'light',100),
 'catSit':(83.5,(850,480,1070,730),'light',100),
 'thumb':(84.4,(640,570,835,750),'light',110),
 'crown':(97.5,(830,425,1140,580),'light',100),
 'femaleFilled':(90.8,(400,480,565,715),'light',110),
 'maleOutline':(90.8,(1310,440,1500,675),'light',110),
 'femaleOutline':(91.8,(330,435,585,740),'light',110),
 'maleFilled':(91.8,(1270,390,1545,715),'light',110),
 'combined':(94.5,(735,330,1185,735),'light',105),
 'gearPair':(107.8,(760,390,1170,740),'light',100),
 'angel':(88.4,(790,425,1135,745),'light',211),
}

def simplify(points,epsilon=.8):
 if len(points)<3:return points
 a,b=np.array(points[0]),np.array(points[-1]);v=b-a
 dist=np.linalg.norm(np.array(points)-a,axis=1) if np.linalg.norm(v)==0 else np.abs(v[0]*(np.array(points)-a)[:,1]-v[1]*(np.array(points)-a)[:,0])/np.linalg.norm(v)
 k=int(np.argmax(dist))
 if dist[k]<=epsilon:return [points[0],points[-1]]
 return simplify(points[:k+1],epsilon)[:-1]+simplify(points[k:],epsilon)

def contours(mask):
 h,w=mask.shape;edges={}
 for y,x in zip(*np.where(mask)):
  for neighbor,start,end in [((y-1,x),(x,y),(x+1,y)),((y,x+1),(x+1,y),(x+1,y+1)),((y+1,x),(x+1,y+1),(x,y+1)),((y,x-1),(x,y+1),(x,y))]:
   ny,nx=neighbor
   if ny<0 or nx<0 or ny>=h or nx>=w or not mask[ny,nx]:edges.setdefault(start,[]).append(end)
 loops=[]
 while edges:
  start=next(iter(edges));at=start;points=[start]
  while at in edges:
   end=edges[at].pop()
   if not edges[at]:del edges[at]
   points.append(end);at=end
   if at==start:break
  if len(points)>10:
   k=len(points)//2;loops.append(simplify(points[:k+1])[:-1]+simplify(points[k:])[:-1])
 return loops

icons={};sheet=Image.new('RGB',(700,220*((len(specs)+3)//4)),(30,30,30));draw=ImageDraw.Draw(sheet)
for n,(name,(t,box,polarity,threshold)) in enumerate(specs.items()):
 image_path=source/f'ref-{t}.png'
 if not image_path.exists():
  subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(root/'media/reference.mp4'),'-frames:v','1',str(image_path)],check=True)
 a=np.asarray(Image.open(image_path).convert('RGB').crop(box)).mean(axis=2)
 a=ndi.gaussian_filter(a,sigma=(.65,1.65));mask=a<threshold if polarity=='dark' else a>threshold
 # Baseline is a separate layout element, not part of the cat/hand silhouette.
 if name in ['catSit','thumb']:
  mask[mask.sum(axis=1)>mask.shape[1]*.98,:]=False
  mask=ndi.binary_closing(mask,structure=np.ones((5,1)))
 labels,count=ndi.label(mask);sizes=np.bincount(labels.ravel());mask=np.isin(labels,np.where(sizes>30)[0][1:])
 if name=='combined':
  sizes[0]=0;mask=labels==int(np.argmax(sizes))
 if name=='angel':mask[:,-8:]=False
 if not mask.any():raise ValueError(name)
 ys,xs=np.where(mask);x0,y0,x1,y1=xs.min(),ys.min(),xs.max()+1,ys.max()+1;mask=mask[y0:y1,x0:x1]
 loops=contours(mask);path=' '.join('M'+' L'.join(f'{x},{y}' for x,y in loop)+' Z' for loop in loops)
 icons[name]={'width':int(x1-x0),'height':int(y1-y0),'path':path,'referenceTime':t,'referenceBounds':[int(box[0]+x0),int(box[1]+y0),int(box[0]+x1),int(box[1]+y1)]}
 image=Image.fromarray(mask.astype('uint8')*255).convert('RGB');image.thumbnail((155,180));x=n%4*175;y=n//4*220;sheet.paste(image,(x,y+25));draw.text((x+5,y+5),name,fill='white')
target.parent.mkdir(exist_ok=True);target.write_text(json.dumps(icons,separators=(',',':'))+'\n');sheet.save(source/'traced-icons.jpg');print('Wrote',target,len(icons),'vector icons')
