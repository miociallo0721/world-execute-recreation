"""Refine isolated padlock/gears and card bounds after the main motion pass."""
import json,subprocess,cv2,numpy as np
from pathlib import Path
root=Path(__file__).resolve().parents[2]
p=root/'recreation/src/assets/continuation-motion.json'; data=json.loads(p.read_text());rows={s['frame']:s for s in data['samples']}
v=str(root/'media/reference.mp4')
def vector(mask):
 cs,_=cv2.findContours(mask.astype('uint8'),cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE);paths=[]
 for c in cs:
  if abs(cv2.contourArea(c))<2:continue
  a=cv2.approxPolyDP(c,.5,True)[:,0,:]
  if len(a)>=3:paths.append('M'+' L'.join(f'{x*2},{y*2}' for x,y in a)+' Z')
 return ' '.join(paths)
raw=subprocess.check_output(['ffmpeg','-v','error','-ss','100.10','-i',v,'-frames:v','1','-vf','scale=960:540','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
a=np.frombuffer(raw,np.uint8).reshape(540,960,3).astype(float);y,x=np.mgrid[:540,:960];g=np.exp(-(((x*2-970)/930)**2+((y*2-535)/820)**2)*1.5)
background=(x<300)|(x>625)|(y<70)|(y>510)
coef=np.linalg.lstsq(np.stack([np.ones_like(g[background]),g[background]],1),a[:,:,0][background],rcond=None)[0]
res=cv2.GaussianBlur((a[:,:,0]-coef[0]-coef[1]*g).astype('float32'),(11,7),2)
mask=(res>4)&(x>300)&(x<625)&(y>70)&(y<510)
n,lab,stats,_=cv2.connectedComponentsWithStats(mask.astype('uint8'));mask=lab==(1+stats[1:,cv2.CC_STAT_AREA].argmax())
data['lock']=vector(mask)
print('Lock background',coef,'shape bounds',cv2.boundingRect(mask.astype('uint8')),'residual',np.median(res[mask]))
# Actual management panel bounds and isolated gear contours, not its text.
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','frame=best_effort_timestamp_time','-of','json',v]));ts=[float(f['best_effort_timestamp_time']) for f in probe['frames'] if 108.176<=float(f['best_effort_timestamp_time'])<110.11]
pr=subprocess.Popen(['ffmpeg','-v','error','-i',v,'-vf',"select='gte(t,108.176)*lt(t,110.11)',scale=960:540",'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
for t in ts:
 rgb=np.frombuffer(pr.stdout.read(960*540*3),np.uint8).reshape(540,960,3);a=cv2.GaussianBlur(rgb.mean(2).astype('float32'),(5,3),.7)
 bright=a>135; ys=np.where(bright.sum(1)>10)[0]
 if not len(ys):continue
 y0,y1=ys[0],ys[-1]+1;xs=np.where(bright[y0:y1].sum(0)>.7*(y1-y0))[0]
 if not len(xs):continue
 x0,x1=xs[0],xs[-1]+1;s=rows[round(t*30000/1001)];s['panel']=[int(x0*2),int(y0*2),int(x1*2),int(y1*2)]
 dark=(a<72)&(y>=max(y0,370//2))&(y<min(y1,740//2))&(x>=x0)&(x<x1)
 n,labels,stats,_=cv2.connectedComponentsWithStats(dark.astype('uint8'))
 chosen=[i for i in range(1,n) if stats[i,cv2.CC_STAT_AREA]>100 and stats[i,cv2.CC_STAT_WIDTH]>8 and stats[i,cv2.CC_STAT_WIDTH]<150]
 gears=np.isin(labels,chosen)
 s['gears']=vector(gears)
 # Once the doors arrive, exclude their components from the gear layer.
 if t>=109.64:s['gears']=''
 if 109.709<=t<109.744:
  # Source switches on this frame: keep the moving door strip, author its
  # departing title separately so text is never captured in a vector asset.
  strip=(y>=y0)&(y<y1);clean=a.copy();clean[(x<520)&(y>220)&(y<320)]=240
  s['kind']='sectors';s['strip']=[int(y0*2),int(y1*2)]
  s['vectors']=[[vector(strip&(clean>62)),98],[vector(strip&(clean>108)),246]]
 if abs(t-round(t*4)/4)<.013:print(round(t,3),s['panel'])
pr.wait();p.write_text(json.dumps(data,separators=(',',':'))+'\n')
