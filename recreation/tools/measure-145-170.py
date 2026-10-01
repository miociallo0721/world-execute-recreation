"""Measure isolated layout, typography and motion for the execution segment.

Outputs vector outlines, text lengths, rectangles, circles and colour summaries;
no reference frames are included in the website.
"""
import json, subprocess, sys
from pathlib import Path
import cv2
import numpy as np
from PIL import ImageFont

root=Path(__file__).resolve().parents[2]
cache=Path('/workspace/video-analysis/finale')
all_times=np.array(json.loads((cache/'times.json').read_text()))
start=float(sys.argv[1]) if len(sys.argv)>1 else 145
end=float(sys.argv[2]) if len(sys.argv)>2 else 170.81
times=all_times[(all_times>=start)&(all_times<end)]
small=np.load(cache/'frames.npy',mmap_mode='r')
font=ImageFont.truetype(str(root/'recreation/public/fonts/Roboto-Light.ttf'),34)
strings=['> Run Emergency Protocol','> date 2017-01-01','> user : [Undefined]']
baselines=[54,94,134]
lefts=[26,26,26]
for i in range(9):
 strings.extend(['execution' if i<4 else 'EXECUTION','> succeed in executing world.'])
 baselines.extend([229+i*84,269+i*84]);lefts.extend([26,64])
widths=[np.array([font.getlength(s[:n])*.96 for n in range(len(s)+1)]) for s in strings]
previous=np.zeros(len(strings),int)

def vector(mask,epsilon=.7,holes=True,scale=2,min_area=2):
 contours,_=cv2.findContours(mask.astype('uint8'),cv2.RETR_LIST if holes else cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 paths=[]
 for c in contours:
  if abs(cv2.contourArea(c))<min_area:continue
  p=cv2.approxPolyDP(c,epsilon,True)[:,0,:]
  if len(p)>2:
   points=p.astype(float)*scale
   def num(v):return str(int(v)) if v==int(v) else str(round(v,2))
   path='M'+num(points[0,0])+','+num(points[0,1])
   for start,end in zip(points,points[1:]):
    dx,dy=end-start
    path+=('h'+num(dx)) if dy==0 else ('v'+num(dy)) if dx==0 else ('l'+num(dx)+','+num(dy))
   paths.append(path+'Z')
 return ' '.join(paths)

def components(mask,area=50):
 n,l,s,_=cv2.connectedComponentsWithStats(mask.astype('uint8'))
 return l,s,[i for i in range(1,n) if s[i,4]>=area]

def circle(mask):
 l,s,ids=components(mask,5000)
 if not ids:return None
 i=max(ids,key=lambda i:s[i,4]);cs,_=cv2.findContours((l==i).astype('uint8'),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 p=max(cs,key=cv2.contourArea)[:,0,:].astype(float)*2
 p=p[(p[:,0]>8)&(p[:,0]<1910)&(p[:,1]>8)&(p[:,1]<1070)]
 if len(p)<8:return None
 cx,cy,k=np.linalg.lstsq(np.column_stack([2*p[:,0],2*p[:,1],np.ones(len(p))]),(p*p).sum(1),rcond=None)[0]
 radius=np.sqrt(max(0,k+cx*cx+cy*cy))
 return [round(cx,2),round(cy,2),round(radius,2)] if 50<radius<2000 else None

proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-ss',str(int(start)-1),'-copyts','-i',str(root/'media/reference.mp4'),'-vf',f"select='gte(t,{start})*lt(t,{end})'",'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
rows=[];Y,X=np.mgrid[:540,:960]
for n,t in enumerate(times):
 raw=proc.stdout.read(1920*1080*3)
 if len(raw)!=1920*1080*3:raise RuntimeError(f'Source PTS {t}')
 full=np.frombuffer(raw,np.uint8).reshape(1080,1920,3)
 rgb=cv2.resize(full,(960,540),interpolation=cv2.INTER_AREA)
 g=cv2.GaussianBlur(rgb.mean(2).astype('float32'),(7,3),1.1,sigmaY=.4)
 row={'frame':round(t*30000/1001)}
 if 146.38<=t<151.652:
  counts=[]
  for j,(s,y,x) in enumerate(zip(strings,baselines,lefts)):
   if y>1080:counts.append(0);continue
   roi=g[max(0,int((y-34)/2)):min(540,int((y+2)/2)),max(0,int(x/2)):305]
   if t<155.188: ink=roi>48
   else:
    red=rgb[max(0,int((y-34)/2)):min(540,int((y+2)/2)),max(0,int(x/2)):305,0].astype('float32')
    ink=(red-cv2.GaussianBlur(red,(0,0),4)>12)
   ys,xs=np.where(ink)
   length=float(xs.max()*2) if len(xs)>3 else 0
   count=int(abs(widths[j]-length).argmin()) if length else 0
   previous[j]=max(previous[j],count);counts.append(int(previous[j]))
  row['consoleChars']=counts
 if 151.652<=t<158.825:
  # Match the red field palette and sparse corrupted fragments, not a noisy
  # checkerboard or a new set of random black horizontal cut-outs.
  row['consoleColor']=np.median(rgb,axis=(0,1)).round(2).tolist()
  # The terminal itself is sliced and scrolls through the red field. Retain
  # those glyph outlines separately so the backdrop never hides its text.
  row['terminalInk']=[]
  fg=cv2.GaussianBlur(full.mean(2).astype('float32'),(3,1),.65)
  channel=full[:,:,0] if t>=155.188 else fg
  for low,high in [(40,80),(80,135),(135,195),(195,256)]:
   mask=channel>low;mask[:,700:]=False
   if t>=155.188:mask &= full[:,:,1]>7
   p=vector(cv2.dilate(mask.astype('uint8'),np.ones((2,2),np.uint8)),.75,scale=1,min_area=.5)
   within=mask&(channel<=high)
   if p and within.sum():
    color=np.median(full[within],axis=0)/.85
    row['terminalInk'].append([p,'rgb('+ ' '.join(str(round(v,1)) for v in color)+')'])
  if t>=155.188:
   noise=cv2.GaussianBlur(rgb.astype('float32'),(0,0),1.5)
   difference=noise.max(2)-noise.min(2)
   blue=(noise[:,:,2]>noise[:,:,0]+6)&(difference>10)
   black=(noise.mean(2)<8)&(X>30)&(X<942)
   row['redDust']=[[vector(black),'#080a03'],[vector(blue),'#160952']]
 if 159.025<=t<161.862:
  cards=[]
  for y0,y1,threshold in [(25,192,3),(190,355,15),(345,535,3)]:
   mask=(g>threshold)&(Y>=y0)&(Y<y1)
   mask=cv2.morphologyEx(mask.astype('uint8'),cv2.MORPH_CLOSE,np.ones((3,5),np.uint8))
   l,s,ids=components(mask,700)
   for i in ids:
    x,y,w,h,_=map(int,s[i])
    if 42<w<95 and 105<h<150:
     level=float(np.percentile(g[l==i],65)/.85)
     cards.append([x*2,y*2,w*2,h*2,round(level,2)])
  row['cards']=cards
  roi=(X>435)&(X<525)&(Y>290)&(Y<306)
  l,s,ids=components(roi&(g>55),3);dots=[]
  for i in ids:
   x,y,w,h,_=map(int,s[i])
   if 2<w<10 and 2<h<11:
    cx=x+w/2;cy=y+h/2;level=float(g[int(cy),int(cx)])
    dots.append([cx*2,cy*2,max(w,h),int(level>135)])
  row['dots']=sorted(dots)
 if 162.863<=t<163.664:
  row['loadLines']=[]
  for y0,y1 in [(262,274),(305,317)]:
   l,s,ids=components((g>60)&(Y>=y0)&(Y<y1),10)
   candidates=[i for i in ids if s[i,2]>10 and s[i,3]<8]
   if candidates:
    x,y,w,h,_=map(int,s[max(candidates,key=lambda i:s[i,2])]);row['loadLines'].append([x*2,y*2,w*2,h*2])
  ys,xs=np.where((g>45)&(X>320)&(X<650)&(Y>278)&(Y<304))
  if len(xs)>25:row['loadLabel']=[int(xs.min()*2),int(ys.min()*2),int((xs.max()-xs.min()+1)*2),int((ys.max()-ys.min()+1)*2)]
 if 163.664<=t<165.032:
  row['stableBackdrop']=[]
  thresholds=[30,70,120,170]
  for lo,hi in zip(thresholds,thresholds[1:]+[256]):
   mask=cv2.morphologyEx((g>lo).astype('uint8'),cv2.MORPH_CLOSE,np.ones((13,17),np.uint8))
   l,s,ids=components(mask,600);mask=np.isin(l,ids)
   within=mask&(g>lo)&(g<hi)
   level=float(np.median(g[within])/.85) if within.sum()>20 else (lo+hi)/2/.85
   row['stableBackdrop'].append([vector(mask,holes=False),round(min(255,level),2)])
  # Infer each row from the left, away from the execution overlay. Word
  # columns are independent of long rules and survive the late motion blur.
  contrast=cv2.GaussianBlur(g,(0,0),12)-g
  letters=(contrast>4)&(g<225)
  profile=letters[:,:370].mean(1)
  occupied=np.where(profile>.08)[0]
  bands=np.split(occupied,np.where(np.diff(occupied)>6)[0]+1)
  bands=[ys for ys in bands if len(ys)>10 and ys[-1]-ys[0]>13]
  words=[]
  for ys in bands:
   y0,y1=int(ys[0]),int(ys[-1]+1)
   band=letters[y0:y1].copy()
   if t>=164.764:
    band[:,390:575]=False
   xs=np.where(band.sum(0)>2)[0]
   chunks=np.split(xs,np.where(np.diff(xs)>18)[0]+1)
   full_words=[v for v in chunks if 90<len(v) and v[-1]-v[0]<165]
   nominal=int(np.median([v[-1]-v[0]+1 for v in full_words])) if full_words else 123
   for xs in chunks:
    if len(xs)<10 or xs[-1]-xs[0]>165:continue
    left,right=int(xs[0]),int(xs[-1]+1)
    actual=band[:,left:right];py,px=np.where(actual)
    if len(px)<25:continue
    top,bottom=y0+int(py.min()),y0+int(py.max()+1)
    if left<3:left=right-nominal
    if right>957:right=left+nominal
    if t>=164.764 and 360<left<590:continue
    if right-left<85 and left>=3 and right<=957:continue
    words.append([left*2,top*2,(right-left)*2,(bottom-top)*2])
  row['stableWords']=words
  row['stableGlyphs']=[]
  fg=cv2.GaussianBlur(full.mean(2).astype('float32'),(7,1),1.2)
  local=cv2.GaussianBlur(fg,(0,0),20)
  ink=(local-fg>7)&(local>40)
  if t<164.05:ink[530:628,:]=False
  if t>=164.764:ink[330:750,750:1180] &= fg[330:750,750:1180]>135
  for low,high in [(0,80),(80,140),(140,180),(180,220)]:
   mask=ink&(fg>low)&(fg<=high)
   p=vector(cv2.dilate(mask.astype('uint8'),np.ones((2,2),np.uint8)),1.,scale=1,min_area=1)
   if p:row['stableGlyphs'].append([p,round(float(np.median(fg[mask])/.85),1)])
 if 164.764<=t<165.032:
  row['captions']=[]
  for x0,y0,x1,y1 in [(680,492,1250,538),(675,544,1270,600),(775,628,1165,708)]:
   mask=(X>x0/2)&(X<x1/2)&(Y>y0/2)&(Y<y1/2)&(g<135)
   if mask.sum()>140:
    ys,xs=np.where(mask);row['captions'].append([int(xs.min()*2),int(ys.min()*2),int((xs.max()-xs.min()+1)*2),int((ys.max()-ys.min()+1)*2)])
   else:row['captions'].append([])
 if 165.35<=t<166.4:
  # Aggregate patch palette at the source's larger, spatially correlated scale.
  row['noiseBands']=[]
  src=small[abs(all_times-t).argmin()].astype(float)
  for y in range(0,180,12):
   line=[]
   for x in range(0,320,16):line.append(np.mean(src[y:y+12,x:x+16],axis=(0,1)).round(1).tolist())
   row['noiseBands'].append(line)
  row['noiseCuts']=vector(g<12)
  a=cv2.GaussianBlur(rgb.astype('float32'),(0,0),3);R,G,B=a.transpose(2,0,1);L=a.mean(2)
  masks=[(G>R*.7)&(G>35)&(t<166.1),(B>G+8)&(B>25)&(t<166.1),(G>R+5)&(B>R+6),(abs(R-G)<16)&(abs(G-B)<16)&(L>75)&(L<210),(L>210)]
  row['noiseRegions']=[]
  for mask in masks:
   p=vector(mask,1.2,min_area=5)
   if p:
    color=np.median(rgb[mask],axis=0)/.85
    row['noiseRegions'].append([p,'rgb('+ ' '.join(str(round(v,1)) for v in color)+')'])
 if 166.4<=t<168.935:
  # Project broad illumination across grid cells. A threshold on grid strokes
  # alone changes the step shape and paints the unlit region white.
  blur=cv2.GaussianBlur(g,(0,0),3)
  row['gridFields']=[]
  for lo,hi in [(55,110),(110,165),(165,256)]:
   field=blur>lo
   field=cv2.morphologyEx(field.astype('uint8'),cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
   l,s,ids=components(field,900);field=np.isin(l,ids)
   inside=field&(blur>lo)&(blur<hi)
   level=float(np.median(blur[inside])/.85) if inside.sum()>20 else (lo+hi)/2/.85
   row['gridFields'].append([vector(field,holes=False),round(min(255,level),2)])
  mask=cv2.morphologyEx((g>12).astype('uint8'),cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
  l,s,ids=components(mask,900)
  row['gridPresence']=vector(np.isin(l,ids),holes=False)
  if t>=168.18:
   light=bool(np.median(g[230:280,435:525])<80)
   ink=(g>65) if light else (g<75)
   roi=(X>325)&(X<635)&(Y>285)&(Y<375)
   l,s,ids=components(ink&roi,30)
   rules=[i for i in ids if s[i,2]>160 and s[i,3]<8]
   if rules:
    x,y,w,h,_=map(int,s[max(rules,key=lambda i:s[i,2])]);row['gridRule']=[x*2,y*2,w*2,h*2]
    mask=ink&(X>330)&(X<630)&(Y>y+h+4)&(Y<min(y+h+40,410))
    ys,xs=np.where(mask)
    if len(xs)>40:row['gridCaption']=[int(xs.min()*2),int(ys.min()*2),int((xs.max()-xs.min()+1)*2),int((ys.max()-ys.min()+1)*2)]
   # Track the moving simulation motif separately from the page's dark header.
   row['gridCube']=[]
   fg=cv2.GaussianBlur(full.mean(2).astype('float32'),(3,1),.65)
   local=cv2.GaussianBlur(fg,(0,0),10)
   roi=np.zeros((1080,1920),bool);roi[:650,860:1060]=True
   light=bool(np.median(g[230:280,435:525])<80)
   contrast=fg-local if light else local-fg
   mask=roi&(contrast>12)&((fg>65) if light else (fg<145))
   core=cv2.dilate(mask.astype('uint8'),np.ones((5,5),np.uint8)).astype(bool)
   for th,value in ([(60,130),(120,210)] if light else [(160,145),(105,65)]):
    shape=roi&core&((fg>th) if light else (fg<th));p=vector(shape,.5,scale=1,min_area=1)
    if p:row['gridCube'].append([p,value])
 if 169.936<=t<170.22:
  row['clockDisks']=[]
  for threshold,level in [(195,215),(175,188),(150,160),(125,135),(100,105),(70,75),(45,5)]:
   disk=circle(g<threshold)
   if disk:row['clockDisks'].append([*disk,level])
 if len(row)>1:rows.append(row)
 if (n+1)%200==0:print(f'{n+1}/{len(times)} frames measured',flush=True)
if proc.wait():raise RuntimeError('Source decode failed')
out=root/'recreation/src/assets/segment-145-170.json'
if start!=145 or end!=170.81:
 old=json.loads(out.read_text())['samples']
 rows=sorted({r['frame']:r for r in [r for r in old if not start<=r['frame']*1001/30000<end]+rows}.values(),key=lambda r:r['frame'])
out.write_text(json.dumps({'samples':rows,'terminal':{'strings':strings,'baselines':baselines,'lefts':lefts}},separators=(',',':'))+'\n')
print('Saved',len(rows),'samples;',out.stat().st_size,'bytes',flush=True)
