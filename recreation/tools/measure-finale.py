"""Development-only measurement of isolated geometry and glitch timing.

Output is polygon geometry and layout/effect parameters. No decoded image or
reference video is shipped to the player. Text, grids, noise and credits remain
independent program-generated elements.
"""
import json, subprocess
from pathlib import Path
import cv2
import numpy as np

root = Path(__file__).resolve().parents[2]
cache = Path('/workspace/video-analysis/finale')
times = np.array(json.loads((cache/'times.json').read_text()))
frames = np.load(cache/'frames.npy', mmap_mode='r')
output = root/'recreation/src/assets/finale-motion.json'
yy, xx = np.mgrid[:180,:320]
glow = np.exp(-(((xx*6-970)/930)**2+((yy*6-535)/820)**2)*1.5)
empty = ((yy<36)|(yy>152)) & (xx>10) & (xx<310)
design = np.stack([np.ones_like(glow[empty]),glow[empty]],1)
backgrounds = {}
for name,t in {'dark':120,'red':125.3,'blue':126.2,'white':129.5,'console':151.2,'consoleGray':153.8,'announce':161,'execution':162.3,'recovery':171.4,'heart':186.5}.items():
    rgb=frames[np.argmin(abs(times-t))]
    coef=np.linalg.lstsq(design,rgb[empty].astype(float)/.85,rcond=None)[0]
    backgrounds[name]=[*coef[0].round(3),*coef[1].round(3)]

def region(box):
    out=np.zeros((540,960),dtype=bool)
    x0,y0,x1,y1=[round(v/2) for v in box]
    out[max(0,y0):min(540,y1),max(0,x0):min(960,x1)]=True
    return out

def vector(mask,epsilon=.38,holes=True):
    contours,_=cv2.findContours(mask.astype('uint8'),cv2.RETR_LIST if holes else cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    paths=[]
    for contour in contours:
        if abs(cv2.contourArea(contour))<.8:continue
        points=cv2.approxPolyDP(contour,epsilon,True)[:,0,:]
        if len(points)>2:paths.append('M'+' L'.join(f'{x*2},{y*2}' for x,y in points)+' Z')
    return ' '.join(paths)

selected=times[(times>=119.9)&(times<208.5)]
proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-ss','119','-copyts','-i',str(root/'media/reference.mp4'),'-vf',"select='gte(t,119.9)*lt(t,208.5)',scale=960:540",'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
samples=[]
for n,t in enumerate(selected):
    raw=proc.stdout.read(960*540*3)
    if len(raw)!=960*540*3:raise RuntimeError(f'Incomplete source frame {t}')
    rgb=np.frombuffer(raw,dtype=np.uint8).reshape(540,960,3)
    g=cv2.GaussianBlur(rgb.mean(axis=2).astype('float32'),(7,3),1.1,sigmaY=.4)
    sample={'frame':round(t*30000/1001)}
    kind=None;roi=None;layers=None;polarity='light'
    if 119.9<=t<122.19:
        kind='trash';roi=region([565,447,745,680]);polarity='dark'
    elif 122.19<=t<122.72:
        kind='erasePieces';roi=region([535,400,1400,685]);layers=[(105,250)]
        roi &= ~region([730,506,1190,588])
    elif 166.4<=t<168.935:
        kind='gridWipe';roi=region([0,0,1920,1080]);layers=[(120,241)]
    elif 169.936<=t<170.804:
        kind='clock';roi=region([640,220,1280,870]);layers=[(48,95),(115,250)]
    elif 174.474<=t<175.742:
        kind='trap';roi=region([0,320,1500,900]);layers=[(48,95),(120,250)]
    elif 177.277<=t<178.38:
        kind='spider';roi=region([800,0,1120,1080]);layers=[(42,75),(90,246)]
    elif 178.38<=t<179.246:
        kind='search';roi=region([735,245,1190,715]);layers=[(45,90),(120,250)]
    elif 181.281<=t<182.983:
        baseline=np.interp(t,[181.281,181.53,181.86,182.0,182.23,182.60],[269,319,607,688,724,730])
        kind='question';roi=region([745,baseline-300,1175,baseline-20]);layers=[(48,85),(110,248)]
        # 'Check Network' and its baseline are authored separately.
    elif 184.584<=t<187.421:
        kind='heartFill';roi=region([660,280,1230,820]);layers=[(35,55),(70,100),(115,155),(165,213),(208,250)]
        # Independently set the lyric over the shape.
    elif 187.421<=t<188.655:
        kind='heartGlitch';roi=region([600,290,1300,855]);layers=[(28,50),(80,160),(150,245)]
    elif 190.457<=t<193.96:
        kind='heartWire';roi=region([650,300,1270,850]);layers=[(20,30),(38,65),(65,110),(105,175)]
    elif 193.96<=t<204.25:
        kind='rebuild';roi=region([825,350,1100,735]);layers=[(12,20),(27,48),(48,90),(85,145)]
    if kind:
        if polarity=='dark':layers=[(100,4)];mask=roi&(g<100)
        sample['kind']=kind
        sample['vectors']=[]
        for th,level in layers:
            mask=roi & ((g<th) if polarity=='dark' else (g>th))
            if kind=='gridWipe':mask=cv2.morphologyEx(mask.astype('uint8'),cv2.MORPH_CLOSE,np.ones((7,7),dtype='uint8'))
            if kind=='heartFill':mask=cv2.morphologyEx(mask.astype('uint8'),cv2.MORPH_OPEN,np.ones((3,3),dtype='uint8'))
            sample['vectors'].append([vector(mask,holes=kind!='gridWipe'),level])
        sample['vectors']=[p for p in sample['vectors'] if p[0]]
    if 166.4<=t<168.935:
        visible=(g>6).astype('uint8')
        visible[250:355,275:675]=0
        visible=cv2.morphologyEx(visible,cv2.MORPH_CLOSE,np.ones((29,29),dtype='uint8'))
        count,labels,stats,_=cv2.connectedComponentsWithStats(visible)
        visible=np.isin(labels,[i for i in range(1,count) if stats[i,cv2.CC_STAT_AREA]>2500])
        sample['gridMask']=vector(visible,holes=False)
    # Exact high exposure bar intervals. Noise is recreated procedurally.
    glitch=any(a<=t<b for a,b in [(124.458,124.825),(126.793,128.161),(131.231,134.168),(151.652,151.919),(155.188,155.488),(158.825,159.025),(161.862,162.163),(162.663,162.863),(165.198,166.4),(167.634,167.868),(175.742,177.01),(180.08,181.081),(182.249,182.983),(183.817,184.584)])
    if glitch:
        mid=np.median(g[:,15:945],axis=1)
        ys=np.where(mid>235)[0]
        groups=np.split(ys,np.where(np.diff(ys)>2)[0]+1)
        groups=[a for a in groups if len(a)>12 and len(a)<320]
        if groups:
            sample['bars']=[[round(float(a[0]/540),5),round(float((a[-1]+1)/540),5)] for a in groups[:3]]
            sample['level']=round(float(np.median(mid[np.concatenate(groups)])/255/.85),4)
        if np.std(g[:190])>22 and np.median(g[:190])>45:
            sample['tiles']=True
        if np.median(g)>247:sample['flash']=True
    samples.append(sample)
    if (n+1)%600==0:print(f'{n+1}/{len(selected)} measured',flush=True)
proc.wait()

static={}
for name,t,box,polarity,th in [
    ('clock',170.55,[830,410,1090,680],'light',100),
    ('spider',178.02,[845,465,1075,685],'light',100),
    ('search',178.93,[858,432,1090,631],'light',100),
    ('running',189.02,[830,440,1080,735],'dark',90),
    ('korean',213.8,[926,630,1006,685],'light',100),
]:
    raw=subprocess.check_output(['ffmpeg','-v','error','-ss',str(t),'-i',str(root/'media/reference.mp4'),'-frames:v','1','-vf','scale=960:540','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
    g=cv2.GaussianBlur(np.frombuffer(raw,dtype='uint8').reshape(540,960,3).mean(axis=2).astype('float32'),(7,3),1.1,sigmaY=.4)
    mask=region(box)&((g<th) if polarity=='dark' else (g>th))
    static[name]={'path':vector(mask),'box':box}

output.write_text(json.dumps({'backgrounds':backgrounds,'samples':samples,'icons':static},separators=(',',':'))+'\n')
print('Wrote',len(samples),'samples;',output.stat().st_size,'bytes',flush=True)
