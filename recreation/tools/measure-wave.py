"""Track the foreground sine curve as vector contours at actual source PTS."""
import json,subprocess
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi
# Reuse contour implementation without running the icon specification loop.
scope={};script=(Path(__file__).parent/'trace-icons.py').read_text();exec(script[script.index('def simplify'):script.index('icons={}')],{'np':np},scope)
simplify=scope['simplify'];contours=scope['contours'];contours.__globals__['simplify']=simplify;simplify.__globals__['simplify']=simplify
root=Path(__file__).resolve().parents[2];probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','frame=best_effort_timestamp_time','-of','json',str(root/'media/reference.mp4')]));times=[float(f['best_effort_timestamp_time']) for f in probe['frames'] if 37.86<=float(f['best_effort_timestamp_time'])<39.51]
proc=subprocess.Popen(['ffmpeg','-v','error','-i',str(root/'media/reference.mp4'),'-vf',"select='gte(t,37.86)*lt(t,39.51)',scale=960:540",'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
rows=[]
for t in times:
 raw=proc.stdout.read(960*540*3);a=np.frombuffer(raw,dtype=np.uint8).reshape(540,960,3).mean(axis=2)
 mask=ndi.gaussian_filter(a,(.4,.8))>125
 axis=int(np.argmax(mask.sum(axis=1)));mask[max(0,axis-8):min(540,axis+8)]=False
 labels,count=ndi.label(mask);sizes=np.bincount(labels.ravel());sizes[0]=0;mask=np.isin(labels,np.where(sizes>750)[0])

 if t>=38.10:
  lo=max(0,axis-65);hi=max(0,axis-13);xcap=320
  before=np.where(mask[max(0,lo-3):lo].any(axis=0))[0];after=np.where(mask[hi:min(540,hi+3)].any(axis=0))[0]
  mask[lo:hi,:xcap]=False
  if len(before) and len(after):
   x0=before.mean();x1=after.mean()
   for yy in range(lo,hi):
    xx=round(x0+(x1-x0)*(yy-lo)/max(1,hi-lo))
    if 0<=xx<xcap:mask[yy,max(0,xx-4):min(xcap,xx+5)]=True
 loops=contours(mask);path=' '.join('M'+' L'.join(f'{x*2},{y*2}' for x,y in loop)+' Z' for loop in loops)
 rows.append({'time':t,'axis':axis*2,'path':path})
proc.wait();target=root/'recreation/src/assets/wave-motion.json';target.write_text(json.dumps(rows,separators=(',',':'))+'\n');print('Tracked',len(rows),'source frames;',target.stat().st_size,'bytes')
