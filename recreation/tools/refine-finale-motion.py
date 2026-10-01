"""Measure semantic geometry and layout for the second-half refinement.

Only vector contours, scene layouts and colour statistics are shipped. Text,
backgrounds, grids and digital noise remain independently drawn by the player.
"""
import json, subprocess, re
from pathlib import Path
import cv2
import numpy as np

root=Path(__file__).resolve().parents[2]
cache=Path('/workspace/video-analysis/finale')
times=np.array(json.loads((cache/'times.json').read_text()))
times=times[(times>=119.9)&(times<208.5)]
out=root/'recreation/src/assets/finale-refinement.json'
Y,X=np.mgrid[:540,:960]
def region(box):
 x0,y0,x1,y1=[int(v/2) for v in box]
 return (X>=x0)&(X<x1)&(Y>=y0)&(Y<y1)
def vector(mask,eps=.55,holes=True):
 cs,_=cv2.findContours(mask.astype('uint8'),cv2.RETR_LIST if holes else cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 a=[]
 for c in cs:
  if abs(cv2.contourArea(c))<1:continue
  p=cv2.approxPolyDP(c,eps,True)[:,0,:]
  if len(p)>2:a.append('M'+' L'.join(f'{x*2},{y*2}' for x,y in p)+' Z')
 return ' '.join(a)
def components(mask,minarea=80):
 n,l,s,_=cv2.connectedComponentsWithStats(mask.astype('uint8'))
 return l,s,[i for i in range(1,n) if s[i,4]>=minarea]
def geometry(mask,color):
 p=vector(mask)
 return [p,color] if p else None
def color_layers(rgb,roi,minimum=25):
 # Brightness and channel dominance separate the coloured wire fragments.
 a=rgb.astype(float);g=a.mean(2);mx=a.max(2);mn=a.min(2)
 layers=[]
 for lo,col in [(minimum,'#171717'),(60,'#777777'),(130,'#cccccc')]:
  v=geometry(roi&(g>lo)&((mx-mn)<25),col)
  if v:layers.append(v)
 for k,cols in enumerate([['#61051b','#d51d38'],['#075b14','#24ec35'],['#100458','#2a32d6']]):
  dominant=(a[:,:,k]>np.max(np.delete(a,k,axis=2),axis=2)*1.25)&((mx-mn)>15)
  for th,col in zip([minimum,110],cols):
   v=geometry(roi&dominant&(a[:,:,k]>th),col)
   if v:layers.append(v)
 # Yellow and cyan fragments are common in the fragmented heart.
 for a0,b0,c0,col in [(0,1,2,'#c5d50d'),(1,2,0,'#09adbb')]:
  v=geometry(roi&(a[:,:,a0]>80)&(a[:,:,b0]>80)&(a[:,:,c0]<np.minimum(a[:,:,a0],a[:,:,b0])*.65),col)
  if v:layers.append(v)
 return layers

proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-ss','119','-copyts','-i',str(root/'media/reference.mp4'),'-vf',"select='gte(t,119.9)*lt(t,208.5)',scale=960:540",'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
rows=[]
small=np.load(cache/'frames.npy',mmap_mode='r')
sy,sx=np.mgrid[:180,:320]
glow=np.exp(-(((sx*6-970)/930)**2+((sy*6-535)/820)**2)*1.5)
empty=((sx<80)|(sx>240)|(sy<20)|(sy>153))
for n,t in enumerate(times):
 raw=proc.stdout.read(960*540*3)
 if len(raw)!=960*540*3:raise RuntimeError(t)
 rgb=np.frombuffer(raw,np.uint8).reshape(540,960,3)
 g=cv2.GaussianBlur(rgb.mean(2).astype('float32'),(7,3),1.1,sigmaY=.4)
 row={'frame':round(t*30000/1001)}
 src=small[n].astype(float)
 bg=empty&(src.mean(2)<40)
 if bg.sum()>500:
  coef=np.linalg.lstsq(np.column_stack([np.ones(bg.sum()),glow[bg]]),src[bg]/.85,rcond=None)[0]
  row['darkBg']=[*coef[0].round(3),*coef[1].round(3)]
 if 122.72<=t<123.623:
  l,s,ids=components(g>125,800)
  if ids:
   i=max(ids,key=lambda i:s[i,4]);x,y,w,h,_=map(int,s[i]);row['erasePanel']=[x*2,y*2,w*2,h*2]
 if 123.623<=t<124.625:
  # The panel rises before the final broken strips. Clip to its actual extent.
  profile=np.median(g[:,276:283],axis=1);ids=np.where(profile>145)[0]
  groups=np.split(ids,np.where(np.diff(ids)>1)[0]+1);groups=[p for p in groups if len(p)>12]
  if groups:
   main=max(groups,key=len);top=int(main[0])*2;bottom=int(main[-1]+1)*2
   row['feeling']={'panel':[545,top,1362,bottom],'rows':[]}
   # Recognise red vs grey by channel difference, measuring clipping rather
   # than storing letter pixels. Rows have a fixed 73-pixel line height.
   for i in range(12):
    y0=int((top+169+i*73)/2);y1=int((top+211+i*73)/2)
    r=rgb[max(0,y0):min(540,y1),295:550].astype(float)
    gray=g[max(0,y0):min(540,y1),295:550]
    if not len(gray):row['feeling']['rows'].append([]);continue
    red=(r[:,:,0]-r[:,:,1]>6)&(r[:,:,0]>45)&(gray<192)
    dark=(gray<145)&~red
    state='red' if red.sum()>5 else 'dark'
    mask=red if state=='red' else dark
    ys,xs=np.where(mask)
    row['feeling']['rows'].append([int(xs.min()*2),int((xs.max()+1)*2),state] if len(xs)>2 else [])
 if 131.231<=t<134.168:
  row['illegal']=color_layers(rgb,region([745,340,1180,740]),10)
  # Fine binary text is authored separately; measure the occupied ribbons.
  ink=(g-cv2.GaussianBlur(g,(0,0),15)>2.5)&~region([745,340,1180,740])
  occupied=np.where(ink.mean(1)>.08)[0]
  ribbons=np.split(occupied,np.where(np.diff(occupied)>6)[0]+1)
  row['binary']=[]
  for ys in ribbons:
   if len(ys)<4:continue
   xs=np.where(ink[ys].sum(0)>1)[0]
   if len(xs)>60:
    glyphs=rgb[ys[0]:ys[-1]+1][ink[ys[0]:ys[-1]+1]]
    color=(np.percentile(glyphs,85,axis=0)/.85).clip(0,255).round(2).tolist()
    row['binary'].append([int(xs[0]*2),int(ys[0]*2),int((xs[-1]-xs[0]+1)*2),int((ys[-1]-ys[0]+1)*2),*color])
 if 163.664<=t<165.032:
  row['stable']=[]
  # Separate the white reveal field, curved rules and repeated font rows.
  white=cv2.morphologyEx((g>150).astype('uint8'),cv2.MORPH_CLOSE,np.ones((13,17),np.uint8))
  l,s,chosen=components(white,1200);field=np.isin(l,chosen)
  row['stableField']=vector(field,holes=False)
  dark=(g<177)&field;l,s,ids=components(dark,120)
  rules=[i for i in ids if s[i,2]>470 and s[i,3]<25]
  row['stableRules']=vector(np.isin(l,rules))
  boundaries=sorted([0,540]+[int(np.median(np.where(l==i)[0])) for i in rules])
  for y0,y1 in zip(boundaries,boundaries[1:]):
   if y1-y0<25:continue
   roi=field&(Y>y0+8)&(Y<y1-8)&~np.isin(l,rules)
   py,px=np.where(roi&(g<140))
   text_y=int(np.percentile(py,99)*2+2) if len(py)>10 else y0*2+170
   row['stable'].append(['',y0*2,y1*2,text_y])
 if 165.032<=t<165.35:
  row['brokenStable']=[]
  for th,level in [(35,70),(90,155),(145,230)]:
   mask=(g>th)&((rgb.max(2).astype(int)-rgb.min(2))<40)
   p=vector(mask,eps=.8)
   if p:row['brokenStable'].append([p,level])
  a=cv2.GaussianBlur(rgb.astype('float32'),(0,0),4)
  row['stableFields']=[]
  for mask in [(a[:,:,1]>a[:,:,0]+18)&(a[:,:,2]>a[:,:,0]+18),(a[:,:,0]>a[:,:,1]+22)&(a[:,:,0]>a[:,:,2]+15)]:
   mask=cv2.morphologyEx(mask.astype('uint8'),cv2.MORPH_CLOSE,np.ones((9,9),np.uint8));l,s,ids=components(mask,180)
   for i in ids:
    shape=l==i;row['stableFields'].append([vector(shape,holes=False),np.mean(rgb[shape],axis=0).round(2).tolist()])
 if 166.4<=t<168.935:
  # Grey grid lines cannot make the unlit field visible. The previous 6-level
  # threshold included the background and painted grids into black regions.
  visible=(g>27).astype('uint8');visible[255:358,300:662]=0
  visible=cv2.morphologyEx(visible,cv2.MORPH_CLOSE,np.ones((23,23),np.uint8))
  l,s,ids=components(visible,2200)
  row['gridMask']=vector(np.isin(l,ids),holes=False)
  bright=cv2.morphologyEx((g>130).astype('uint8'),cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
  l,s,ids=components(bright,2200);white=np.isin(l,ids);row['whiteGrid']=vector(white,holes=False)
  # Smooth across grid lines first, so isolated lines do not become a grey
  # filled field when morphology joins their intersections.
  gray=cv2.morphologyEx(((cv2.GaussianBlur(g,(0,0),3)>40)&~white).astype('uint8'),cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
  l,s,ids=components(gray,1800);row['grayGrid']=vector(np.isin(l,ids),holes=False)
 if 172.90<=t<173.74:
  # Recover the expanding disk's moving centre from its curved boundary.
  mask=(g<40)&region([410,0,1920,1080]);l,s,ids=components(mask,25000)
  if ids:
   i=max(ids,key=lambda i:s[i,4]);cs,_=cv2.findContours((l==i).astype('uint8'),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
   p=max(cs,key=cv2.contourArea)[:,0,:].astype(float)*2
   p=p[(p[:,0]>450)&(p[:,0]<1890)&(p[:,1]>20)&(p[:,1]<1060)]
   if len(p)>8:
    cx,cy,k=np.linalg.lstsq(np.column_stack([2*p[:,0],2*p[:,1],np.ones(len(p))]),(p*p).sum(1),rcond=None)[0]
    radius=np.sqrt(max(0,k+cx*cx+cy*cy))
    if 100<radius<3500:row['disk']=[round(cx,2),round(cy,2),round(radius,2)]
 if 178.38<=t<180.08:
  roi=region([610,500,1310,800]);l,s,ids=components(roi&(g>92),60)
  candidates=[i for i in ids if s[i,2]>250 and 4<s[i,3]<42]
  if candidates:
   x,y,w,h,_=map(int,s[max(candidates,key=lambda i:s[i,2])]);inside=g[y+max(2,h//4):y+max(3,h*3//4),x+4:x+w-4]
   cols=np.median(inside,axis=0)>135
   extent=np.where(cols)[0]
   row['search']=[x*2,y*2,w*2,h*2,float((extent.max()+1)/(w-8)) if len(extent) else 0]
 if 181.281<=t<182.983:
  roi=region([730,0,1180,900]);l,s,ids=components(roi&(g>42),60)
  candidates=[i for i in ids if s[i,3]>s[i,2]*.35 and s[i,2]>28 and s[i,3]>25]
  if candidates:
   x,y,w,h,_=map(int,s[max(candidates,key=lambda i:s[i,4])]);box=region([x*2-5,y*2-5,(x+w)*2+5,(y+h)*2+5])
   row['question']={'box':[x*2,y*2,w*2,h*2],'layers':[]}
   for th,level in [(42,75),(100,160),(160,225)]:
    p=vector(box&(g>th))
    if p:row['question']['layers'].append([p,level])
 if (180.08<=t<181.281) or (183.817<=t<184.584):
  # Trace only the broken wire motifs, leaving the field and noise procedural.
  dark=(g<70);l,s,ids=components(dark,15)
  chosen=[i for i in ids if s[i,4]<200000 and s[i,2]>5 and s[i,3]>4]
  row['networkWire']=vector(np.isin(l,chosen))
  row['networkTiles']=bool(np.median(g)<140 and np.std(g)>38)
 if 184.584<=t<185.786:
  # Preserve the faint fragments which the old 35-level threshold discarded.
  roi=region([630,270,1280,870]);blur=cv2.GaussianBlur(g,(0,0),25)
  row['heartDust']=[]
  for threshold,level in [(2.5,18),(5,28),(10,42)]:
   mask=roi&((g-blur)>threshold)&(g<65);p=vector(mask)
   if p:row['heartDust'].append([p,level])
 if 187.421<=t<188.655:row['heartColor']=color_layers(rgb,region([650,275,1280,860]),20)
 if 188.655<=t<190.457:
  l,s,ids=components(g>135,3000)
  candidates=[i for i in ids if s[i,2]>100 and 60<s[i,3]<250]
  if candidates:
   i=max(candidates,key=lambda i:s[i,4]);x,y,w,h,_=map(int,s[i]);white=cv2.morphologyEx((l==i).astype('uint8'),cv2.MORPH_CLOSE,np.ones((13,35),np.uint8))
   # The figure and doorway are black silhouettes inside the white runway.
   inside=region([x*2+8,y*2+6,(x+w)*2-8,(y+h)*2-6])
   dark=inside&(g<65);dl,ds,dids=components(dark,80)
   dids=[j for j in dids if ds[j,3]>30 and ds[j,2]>20]
   row['exit']={'box':[x*2,y*2,w*2,h*2],'silhouette':vector(np.isin(dl,dids))}
 # Statistical colour palettes for procedural corruption, not image tiles.
 if (155.188<=t<158.825) or (165.35<=t<166.20):
  row['noiseMean']=np.mean(rgb,axis=(0,1)).round(2).tolist()
 if len(row)>1:rows.append(row)
 if (n+1)%600==0:print(f'{n+1}/{len(times)} source frames checked',flush=True)
if proc.wait():raise RuntimeError('Source decode failed')

# Exact static icon outlines, kept separate from text and procedural fields.
icons={}
for name,t,box,polarity,threshold in [
 ('sim',202.5,[850,430,1080,695],'light',26),
 ('recoveryClock',172.75,[1370,410,1640,690],'red',15),
 ('shield',183.5,[815,330,1100,725],'dark',95),
 ('loadingClock',171.4,[850,410,1075,670],'light',76),
 ('chip',169.02,[840,410,1080,670],'light',120),
 ('recoverySide',172.75,[0,0,415,1080],'dark',110),
]:
 raw=subprocess.check_output(['ffmpeg','-v','error','-ss',str(t),'-i',str(root/'media/reference.mp4'),'-frames:v','1','-vf','scale=960:540','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
 rgb=np.frombuffer(raw,np.uint8).reshape(540,960,3).astype(float);g=cv2.GaussianBlur(rgb.mean(2).astype('float32'),(7,3),1.1,sigmaY=.4)
 mask=region(box)&((rgb[:,:,0]-rgb[:,:,1]>threshold) if polarity=='red' else (g<threshold) if polarity=='dark' else (g>threshold))
 icons[name]=vector(mask)
# The two credited glitch examples use independently generated effects. Keep
# their measured aggregate scan-band timings and noise palette, not image data.
all_times=np.array(json.loads((cache/'times.json').read_text()))
for idx,t in enumerate(all_times):
 if not 223.49<=t<228.495:continue
 src=small[idx].astype(float);a=src[54:109,34:132];bands=[]
 profile=np.mean(a,axis=1);levels=(np.round(profile/16)*16).clip(0,255)
 start=0
 for y in range(1,len(levels)+1):
  if y==len(levels) or np.max(abs(levels[y]-levels[start]))>18:
   col=np.mean(profile[start:y],axis=0).round(2).tolist();bands.append([start*6,(y-start)*6,*col]);start=y
 noise=src[54:109,188:283]
 cut=np.zeros((180,320),np.uint8);cut[54:109,188:283]=(noise.mean(2)<50)
 l,s,ids=components(cut,12);ids=[i for i in ids if s[i,2]>20]
 cut=cv2.resize(np.isin(l,ids).astype('uint8'),(960,540),interpolation=cv2.INTER_NEAREST)
 rows.append({'frame':round(t*30000/1001),'creditBands':bands,'creditNoise':np.mean(noise,axis=(0,1)).round(2).tolist(),'creditCuts':vector(cut)})
out.write_text(json.dumps({'samples':rows,'icons':icons},separators=(',',':'))+'\n')
print('Saved',len(rows),'semantic geometry/layout samples;',out.stat().st_size,'bytes',flush=True)
