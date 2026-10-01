"""Compare decoded exports against the corresponding original audio windows."""
from pathlib import Path
import json,subprocess
import numpy as np
from scipy.signal import correlate,correlation_lags

root=Path(__file__).resolve().parents[1]
source=root.parent/'media/soundtrack.m4a'
def pcm(file,time):
    raw=subprocess.check_output(['ffmpeg','-v','error','-ss',str(time),'-i',str(file),'-t','1','-vn','-ac','1','-ar','8000','-f','f32le','pipe:1'])
    samples=np.frombuffer(raw,dtype=np.float32).astype(float)
    return samples-samples.mean()

results=[]
for name,offset,times in [
    ('continuation-30-120-1080p60.mp4',30,[1,45,88]),
    ('recreation-0-120-1080p60.mp4',0,[1,29.5,30.5,75,118]),
]:
    for time in times:
        reference=pcm(source,time+offset);actual=pcm(root/'output'/name,time)
        size=min(len(reference),len(actual));reference=reference[:size];actual=actual[:size]
        similarity=float(np.dot(reference,actual)/(np.linalg.norm(reference)*np.linalg.norm(actual)))
        cross=correlate(actual,reference,method='fft');lags=correlation_lags(size,size);valid=np.abs(lags)<=80
        lag=int(lags[valid][np.argmax(cross[valid])]);lag_ms=lag/8
        assert similarity>.98,(name,time,similarity)
        assert abs(lag_ms)<=2,(name,time,lag_ms)
        results.append({'file':name,'outputTime':time,'sourceTime':time+offset,'zeroLagCorrelation':round(similarity,6),'lagMilliseconds':lag_ms})
        print(f'PASS: {name} t={time}s correlation={similarity:.6f} lag={lag_ms:.3f}ms')
(root/'output/audio-verification.json').write_text(json.dumps(results,indent=2)+'\n')
