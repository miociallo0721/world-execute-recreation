"""Development-only source/before/after contact sheets and coarse error report."""
import json,sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[2]
cache=Path('/workspace/video-analysis/finale')
ts=np.array(json.loads((cache/'times.json').read_text()))
source=np.load(cache/'frames.npy',mmap_mode='r')
label=sys.argv[1] if len(sys.argv)>1 else 'finale-refine-second'
captures=root/'recreation/output/refinement-50-120'
files=sorted((captures/label).glob('*.png'),key=lambda p:float(p.stem))
out=cache/'refine';out.mkdir(exist_ok=True)
report=[]
def reduced(path):return np.array(Image.open(path).convert('RGB').resize((320,180),Image.Resampling.BOX))
def error(a,b):
 a=cv2.GaussianBlur(a.astype('float32'),(0,0),1.2);b=cv2.GaussianBlur(b.astype('float32'),(0,0),1.2)
 return round(float(abs(a-b).mean()),3)
for j in range(0,len(files),8):
 sheet=Image.new('RGB',(1440,300*min(8,len(files)-j)),'#111');draw=ImageDraw.Draw(sheet)
 for k,f in enumerate(files[j:j+8]):
  t=float(f.stem);src=source[abs(ts-t).argmin()];before=reduced(captures/'finale-refine-before'/f.name);after=reduced(f)
  record={'time':t,'before':error(src,before),'after':error(src,after)};report.append(record)
  draw.text((8,k*300+4),f"{t:.2f}s   SOURCE | BEFORE | {label}; coarse MAE {record['before']:.2f} -> {record['after']:.2f}",fill='white')
  for col,img in enumerate([src,before,after]):sheet.paste(Image.fromarray(img).resize((480,270)),(col*480,k*300+22))
 sheet.save(out/f'{label}-{j//8+1}.jpg',quality=95)
(out/(label+'.json')).write_text(json.dumps(report,indent=2)+'\n')
print('Compared',len(report),'timestamps; mean coarse MAE',round(np.mean([r['before'] for r in report]),3),'->',round(np.mean([r['after'] for r in report]),3))
print('Remaining largest differences:',sorted(report,key=lambda r:-r['after'])[:12])
