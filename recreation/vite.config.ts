import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Serve the authorized local soundtrack without duplicating the 236-second asset.
export default defineConfig({ build:{rollupOptions:{output:{manualChunks(id){if(id.endsWith('/segment-145-170.json'))return 'execution-segment';if(id.endsWith('/finale-refinement.json'))return 'finale-refinement';if(id.endsWith('/finale-motion.json'))return 'finale-motion';}}}}, plugins: [{
  name: 'local-soundtrack',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'soundtrack.m4a', source: readFileSync(resolve('..', 'media', 'soundtrack.m4a')) });
  },
  configureServer(server) {
    server.middlewares.use('/soundtrack.m4a', (req, res) => {
      const data=readFileSync(resolve('..', 'media', 'soundtrack.m4a'));
      res.setHeader('Content-Type', 'audio/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if(range){
        const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):data.length-1,data.length-1);
        if(start>end||start>=data.length){res.statusCode=416;res.setHeader('Content-Range',`bytes */${data.length}`);res.end();return;}
        res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${data.length}`);
        res.setHeader('Content-Length',end-start+1);res.end(data.subarray(start,end+1));
      }else{res.setHeader('Content-Length',data.length);res.end(data);}
    });
  },
}] });
