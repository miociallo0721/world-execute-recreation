"""Check decoded deliverable frames against independent browser captures."""
from pathlib import Path
import subprocess,json
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
rows=[]
points=[30.4,41.9,50.5,71.4,98.9,108.9,116.9,119.9]
selection='+'.join(f'eq(n,{round(t*60)})' for t in points)
# Select decoded frame indices. Timestamp seeking may round a boundary upward.
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(root/'output/recreation-0-120-1080p60.mp4'),'-vf',f"select='{selection}'",'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
frames=np.frombuffer(raw,np.uint8).reshape(len(points),1080,1920,3)
for t,decoded in zip(points,frames):
 expected=np.array(Image.open(root/f'output/continuation-checks/{t}.png').convert('RGB'))
 difference=np.abs(decoded.astype(float)-expected)
 error=float(difference.mean());assert error<3,(t,error)
 rows.append({'time':t,'decodedFrame':round(t*60),'rgbMeanAbsoluteError':round(error,4),'maxCompressionDifference':int(difference.max())})
 print(f'PASS: t={t:g}s decoded frame agrees with browser, RGB MAE {error:.4f}')
(root/'output/refined-frame-verification.json').write_text(json.dumps(rows,indent=2)+'\n')
