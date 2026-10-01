"""Blurred image error and foreground overlap against matching source PTS.

These are visual regression measurements, not a claim of pixel identity.
"""
import json,subprocess
from pathlib import Path
import cv2
import numpy as np
from PIL import Image,ImageDraw

root=Path(__file__).resolve().parents[1];output=root/'output/refinement-50-120'
label=__import__('sys').argv[1] if len(__import__('sys').argv)>1 else 'after'
legacy=Path('/workspace/video-analysis/continuation')
cache=output/'reference-cache'
if (legacy/'frames.npy').exists() and (legacy/'frame-times.json').exists():
    cache=legacy
elif not (cache/'frames.npy').exists():
    cache.mkdir(parents=True,exist_ok=True)
    video=root.parent/'media/reference.mp4'
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','frame=best_effort_timestamp_time','-of','json',str(video)]))
    pts=[float(f['best_effort_timestamp_time']) for f in probe['frames'] if 49.4<=float(f['best_effort_timestamp_time'])<120.04]
    store=np.lib.format.open_memmap(cache/'frames.npy',mode='w+',dtype=np.uint8,shape=(len(pts),180,320,3))
    process=subprocess.Popen(['ffmpeg','-v','error','-i',str(video),'-vf',"select='gte(t,49.4)*lt(t,120.04)',scale=320:180",'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
    for i in range(len(pts)):
        raw=process.stdout.read(320*180*3)
        if len(raw)!=320*180*3:raise RuntimeError('Incomplete reference frame')
        store[i]=np.frombuffer(raw,dtype=np.uint8).reshape(180,320,3)
    if process.wait():raise RuntimeError('Reference decoding failed')
    store.flush();(cache/'frame-times.json').write_text(json.dumps(pts))
frames=np.load(cache/'frames.npy',mmap_mode='r')
times=np.array(json.loads((cache/'frame-times.json').read_text()))
rows=[]
for path in sorted((output/label).glob('*.png'),key=lambda p:float(p.stem)):
    t=float(path.stem);ref=frames[np.argmin(abs(times-t))]
    new=np.array(Image.open(path).convert('RGB').resize((320,180),Image.Resampling.LANCZOS))
    before=np.array(Image.open(output/'before'/path.name).convert('RGB').resize((320,180),Image.Resampling.LANCZOS))
    def error(a):
        aa=cv2.GaussianBlur(a.astype('float32'),(5,5),.9)
        rr=cv2.GaussianBlur(ref.astype('float32'),(5,5),.9)
        return float(np.abs(aa-rr).mean())
    rows.append({'time':t,'before':error(before),'after':error(new)})
summary={'samples':len(rows),'before_mae':float(np.mean([r['before'] for r in rows])),'after_mae':float(np.mean([r['after'] for r in rows]))}
summary['reduction_percent']=100*(1-summary['after_mae']/summary['before_mae'])
summary['segments']=[]
for lo,hi in [(50,59.225),(59.225,66.331),(66.331,74.241),(74.241,84.751),(84.751,92.442),(92.442,99.933),(99.933,109.744),(109.744,120)]:
    group=[r for r in rows if lo<=r['time']<hi]
    if not group:continue
    b=np.mean([r['before'] for r in group]);a=np.mean([r['after'] for r in group])
    summary['segments'].append({'start':lo,'end':hi,'before':round(float(b),3),'after':round(float(a),3),'reduction_percent':round(float((1-a/b)*100),1)})
for start in [50,58,66,74,82,90,98,106,114]:
    im=Image.new('RGB',(1280,8*204));d=ImageDraw.Draw(im)
    for row,t in enumerate(np.arange(start,min(120,start+8),1)):
        for col,q in enumerate([t,t+.5]):
            path=output/label/f'{q:.2f}.png'
            if not path.exists():continue
            im.paste(Image.fromarray(frames[np.argmin(abs(times-q))]),(col*640,row*204+24))
            im.paste(Image.open(path).resize((320,180)),(col*640+320,row*204+24))
            d.text((col*640+8,row*204+5),f'{q:.2f} | reference / {label}',fill='white')
    im.save(output/f'{label}-{start}.jpg')
(output/f'{label}-metrics.json').write_text(json.dumps({'summary':summary,'frames':rows},indent=2)+'\n')
print(json.dumps(summary,indent=2))
print('Largest remaining differences:',[(r['time'],round(r['after'],1)) for r in sorted(rows,key=lambda r:r['after'],reverse=True)[:20]])
