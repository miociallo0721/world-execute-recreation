"""Measure isolated foreground vectors and UI bounds; never export video frames.

The runtime paints vector contours and authored text through the existing Canvas /
Three.js renderer. Video decoding and OpenCV are development-only dependencies.
"""
import json, subprocess
from pathlib import Path
import cv2
import numpy as np

root=Path(__file__).resolve().parents[2]
target=root/'recreation/src/assets/continuation-motion.json'
video=root/'media/reference.mp4'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','frame=best_effort_timestamp_time','-of','json',str(video)]))
times=[float(f['best_effort_timestamp_time']) for f in probe['frames'] if 49.4<=float(f['best_effort_timestamp_time'])<120.04]
proc=subprocess.Popen(['ffmpeg','-v','error','-i',str(video),'-vf',"select='gte(t,49.4)*lt(t,120.04)',scale=960:540",'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)

def vector(mask,epsilon=.5):
    contours,_=cv2.findContours(mask.astype('uint8'),cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    paths=[]
    for contour in contours:
        if abs(cv2.contourArea(contour))<1.3:continue
        p=cv2.approxPolyDP(contour,epsilon,True)[:,0,:]
        if len(p)<3:continue
        paths.append('M'+' L'.join(f'{x*2},{y*2}' for x,y in p)+' Z')
    return ' '.join(paths)

def region(shape,box):
    out=np.zeros(shape,dtype=bool)
    x0,y0,x1,y1=[round(p/2) for p in box];out[max(0,y0):min(shape[0],y1),max(0,x0):min(shape[1],x1)]=True
    return out

rows=[]
yy,xx=np.mgrid[:540,:960]
glow=np.exp(-(((xx*2-970)/930)**2+((yy*2-535)/820)**2)*1.5)
empty=(yy<105)|(yy>462)
design=np.stack([np.ones_like(glow[empty]),glow[empty]],1)
for n,t in enumerate(times):
    raw=proc.stdout.read(960*540*3)
    if len(raw)!=960*540*3:raise RuntimeError('Incomplete reference frame')
    rgb=np.frombuffer(raw,dtype=np.uint8).reshape(540,960,3)
    gray=cv2.GaussianBlur(rgb.astype('float32').mean(axis=2),(9,5),1.2,sigmaY=.55)
    frame={'frame':round(t*30000/1001)}
    if 53<=t<56.09:
        coefficients=np.linalg.lstsq(design,rgb[empty]/.85,rcond=None)[0]
        frame['bg']=[*coefficients[0].round(2),*coefficients[1].round(2)]
    if 70.103<=t<71.004:
        frame['veil']=round(float(np.clip((np.median(gray[100:160,180:240])-8)/247,0,1)),4)
    if 62.46<=t<65.16:
        frame['arrows']=[round(float(np.clip((np.median(gray[250:265,round((567+i*280)/2):round((600+i*280)/2)])-8)/207,0,1)),3) for i in range(3)]
    scan_windows=[(84.751,85.185),(86.72,87.153),(87.92,88.122),(88.689,88.956)]
    if any(lo<=t<hi for lo,hi in scan_windows):
        ys=np.where(np.median(gray[:,20:940],axis=1)>234)[0]
        groups=np.split(ys,np.where(np.diff(ys)>2)[0]+1)
        groups=[g for g in groups if len(g)>3]
        bars=[[round(float(g[0]/540),5),round(float((g[-1]+1)/540),5)] for g in groups[:3]]
        frame['scan']={'bars':bars,'level':round(float(np.median(gray[ys,20:940])/255),4)} if bars else None
    if 84.751<=t<85.152 or 88.689<=t<88.956:
        # Palette and exposure of the transient tiled field, as compact color
        # parameters. Only procedural rectangles are generated at runtime.
        colors=[]
        for y in range(0,540,45):
            for x in range(0,960,80):
                colors.extend(np.clip(np.median(rgb[y:y+45,x:x+80].reshape(-1,3),axis=0)/.85,0,255).round().astype(int).tolist())
        frame['tiles']=colors
    color_windows=[(49.4,51.72),(72.05,73.20),(76.94,77.34),(92.43,92.65),(95.72,95.94),(96.66,96.90),(97.0,97.22)]
    if any(lo<=t<hi for lo,hi in color_windows):
        r=rgb[:,:,0].astype('float32');b=rgb[:,:,2].astype('float32')
        r=np.maximum(0,r-cv2.GaussianBlur(r,(0,0),12));b=np.maximum(0,b-cv2.GaussianBlur(b,(0,0),12))
        shift,response=cv2.phaseCorrelate(b,r)
        dx,dy=shift
        if response>.08 and abs(dx)<110 and abs(dy)<150:
            frame['chromatic']=[round(-dx,2),round(dy,2)]
    # Actual horizontal edges and marker trajectory in the travelling banner.
    if 51.251<t<57.457 or 100.239<t<101.636:
        bright=gray>100
        counts=bright.sum(axis=1)
        full=np.where(counts>850)[0]
        groups=np.split(full,np.where(np.diff(full)>2)[0]+1)
        groups=[g for g in groups if len(g)]
        if len(groups)>=2:
            frame['banner']=[round(groups[0].mean()*2,2),round(groups[-1].mean()*2,2)]
            if t<56.09 and len(groups)>=3:
                axis=groups[-2].mean()
                area=(gray>120)&region(gray.shape,[0,(axis-54)*2,1920,(axis-8)*2])
                count,labels,stats,centers=cv2.connectedComponentsWithStats(area.astype('uint8'))
                candidates=[i for i in range(1,count) if stats[i,cv2.CC_STAT_AREA]>20 and 6<stats[i,cv2.CC_STAT_HEIGHT]<28]
                if candidates:
                    i=max(candidates,key=lambda i:stats[i,cv2.CC_STAT_AREA])
                    frame['marker']=[round(centers[i][0]*2,2),round(axis*2,2)]
    kind=None;mask=None;threshold=108
    if 74.107<=t<74.841:
        kind='processor';mask=region(gray.shape,[700,350,1220,740])
        # Progress and its annotation are authored separately.
        mask &= ~region(gray.shape,[730,548,1200,612])
    elif 74.841<=t<79.208:
        kind='food';mask=region(gray.shape,[811,0,1110,1080])
    elif 79.95<=t<84.751:
        kind='nutrients';mask=region(gray.shape,[0,0,1920,695])
        # The horizontal baseline is generated as a primitive below the icons.
    elif 88.923<=t<92.442:
        kind='gender';mask=region(gray.shape,[0,280,755,1020])|region(gray.shape,[1200,280,1920,1020])
    elif 92.442<=t<95.929:
        kind='dial';mask=np.ones(gray.shape,dtype=bool)
        mask &= ~region(gray.shape,[938,558,1010,605])
    elif 95.929<=t<99.333:
        kind='crown';mask=np.ones(gray.shape,dtype=bool)
    elif 99.333<=t<99.933:
        kind='yellowRing';mask=region(gray.shape,[460,620,1470,1040]);threshold=190
    elif 105.24<=t<108.176:
        kind='magnifier';mask=np.ones(gray.shape,dtype=bool)
        if t<105.50:mask &= ~region(gray.shape,[610,920,1320,1080])
    elif 109.744<=t<114.814:
        kind='sectors'
        # Only the bright travelling strip and the door cutouts are measured;
        # labels and prohibition marks remain independently animated text/paths.
        line=np.where((gray>105).sum(axis=1)>500)[0]
        if len(line):
            y0,y1=int(line.min()),int(line.max()+1)
            frame['strip']=[y0*2,y1*2]
            mask=region(gray.shape,[0,y0*2,1920,y1*2])
        else:mask=np.zeros(gray.shape,dtype=bool)
    elif 115.43<=t<117.87:
        kind='isolation';mask=region(gray.shape,[820,0,1100,1080])
    if kind and mask is not None:
        # Main contours preserve holes, fine arcs and clipping. A dim contour
        # layer supplies motion trails without storing any raster textures.
        if kind=='yellowRing':
            layers=[[vector(mask&(gray>202)),255]]
        else:
            layers=([[vector(mask&(gray>20)),35]] if kind=='nutrients' else [])+[[vector(mask&(gray>max(48,threshold*.57))),98],[vector(mask&(gray>threshold)),246]]
        # Keep the original prohibition symbol's trajectory, including its
        # independent position while the white card moves underneath it.
        if kind in ['sectors','isolation']:
            red=(rgb[:,:,0].astype(float)>rgb[:,:,1]*1.45+12)&(rgb[:,:,0]>45)
            frame['red']=vector(cv2.GaussianBlur(red.astype('float32'),(3,3),.6)>.42)
        frame['kind']=kind;frame['vectors']=[l for l in layers if l[0]]
    rows.append(frame)
    if (n+1)%300==0:print(f'{n+1}/{len(times)} measured',flush=True)
proc.wait()
# Trace the stationary translucent padlock as one isolated shape. Detrending
# the local blue glow prevents the background from entering its contour.
raw=subprocess.check_output(['ffmpeg','-v','error','-ss','100.10','-i',str(video),'-frames:v','1','-vf','scale=960:540','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
a=np.frombuffer(raw,dtype=np.uint8).reshape(540,960,3)[:,:,0].astype('float32')
empty=(xx<300)|(xx>625)|(yy<70)|(yy>510)
coef=np.linalg.lstsq(np.stack([np.ones_like(glow[empty]),glow[empty]],1),a[empty],rcond=None)[0]
a=cv2.GaussianBlur(a-coef[0]-coef[1]*glow,(11,7),2)
lock=(a>4)&region(a.shape,[600,140,1250,1020])
count,labels,stats,_=cv2.connectedComponentsWithStats(lock.astype('uint8'))
if count>1:
    i=max(range(1,count),key=lambda i:stats[i,cv2.CC_STAT_AREA]);lock=labels==i
target.write_text(json.dumps({'samples':rows,'lock':vector(lock)},separators=(',',':'))+'\n')
print('Wrote',len(rows),'motion samples,',target.stat().st_size,'bytes')
