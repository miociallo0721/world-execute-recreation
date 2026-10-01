export const fragmentShader=`
precision highp float;
uniform sampler2D source,raster;uniform float time,tear,rgb,bands,flash;
uniform float rgbY,chunks,black,tint,split,border;uniform vec2 band1,band2,band3;
uniform float noise,bandLevel;
varying vec2 uv0;
float hash(float x){return fract(sin(x*127.1+19.19)*43758.5453);}
vec3 legacyFrame(){
 vec2 p=uv0;float frame=floor(time*29.97003);float row=floor(p.y*540.);
 float jitter=(hash(row+frame*3.)-.5)*.09*tear;
 float slab=floor(p.y*18.);float s=(hash(slab+frame)-.5)*.12*tear*step(.78,hash(slab+frame*2.));
 p.x+=jitter+s;
 vec3 col=texture2D(source,p).rgb;
 float off=rgb/1920.;col.r=texture2D(source,p+vec2(off,0.)).r;col.b=texture2D(source,p-vec2(off,0.)).b;
 if(bands>.5){
   float moving=fract(time*.37);float local=fract(uv0.y+moving);
   float whiteBand=step(.20,local)*step(local,.49)+step(.54,local)*step(local,.82);
   float edge=step(.49,local)*step(local,.507)+step(.82,local)*step(local,.837);
   float redEdge=step(.185,local)*step(local,.20)+step(.525,local)*step(local,.54);
   float checker=hash(floor(uv0.x*12.)+floor(uv0.y*10.)*13.+frame*.2);
   col=mix(col,vec3(.50+.1*checker),whiteBand*.95);
   col=mix(col,vec3(.02,.38,.35),edge*.8);col=mix(col,vec3(.40,.04,.08),redEdge*.8);
 }
 col=mix(col,vec3(.84),flash);
 col*=.96+.04*step(.5,fract(gl_FragCoord.x*.5));
 col+=(hash(gl_FragCoord.x+gl_FragCoord.y*1920.+frame)-.5)*.006;
 return clamp(col,0.,1.);
}
float bar(vec2 interval,float y){return step(interval.x,y)*step(y,interval.y);}
float edge(vec2 interval,float y,float offset){
 return step(interval.x+offset,y)*step(y,interval.x+offset+.012)
      +step(interval.y+offset,y)*step(y,interval.y+offset+.012);
}
vec3 continuationFrame(){
 float frame=floor(time*29.97003+.5),row=floor((1.-uv0.y)*1080.);
 vec2 p=uv0;if(tear>.001){p.x+=(hash(row+frame*53.)-.5)*70.*tear/1920.;
 p.x+=(hash(floor(row/34.)+frame*7.)-.5)*28.*tear/1920.;}
 vec2 shift=vec2(rgb/1920.,rgbY/1080.);
 vec3 col=texture2D(source,p).rgb;
 if(abs(rgb)+abs(rgbY)>.001){col.r=texture2D(source,p+shift).r;col.b=texture2D(source,p-shift).b;}
 if(tear>.001)col*=1.-step(.88,hash(row+frame*2.))*tear*.42;
 float y=1.-uv0.y,mask=clamp(bar(band1,y)+bar(band2,y)+bar(band3,y),0.,1.);
 if(bands>.5){
  float level=bandLevel*(.95+.05*exp(-pow((uv0.x-.5)*2.,2.)));
  col=mix(col,vec3(level),mask);
  float red=clamp(edge(band1,y,-.008)+edge(band2,y,-.008)+edge(band3,y,-.008),0.,1.);
  float cyan=clamp(edge(band1,y,.004)+edge(band2,y,.004)+edge(band3,y,.004),0.,1.);
  col=mix(col,vec3(.56,.10,.12),red*(frame>=4956.&&frame<4987.?0.:frame>=5024.&&frame<5041.?.12:.7));col=mix(col,frame>=4956.&&frame<4987.?vec3(.0,.93,.95):vec3(.0,.69,.70),cyan*(frame>=5024.&&frame<5041.?.12:.8));
 }
 if(abs(noise)>.001){
   float tile=time<50.?floor(uv0.x*160.)+floor(y*105.)*191.:floor(uv0.x*256.)+floor(y*180.)*293.;
   vec3 randomColor=vec3(hash(tile+frame*13.),hash(tile*7.+frame*19.),hash(tile*3.+frame*23.));
   float coverage=noise<0.?step(1.+noise,hash(tile+frame*43.)):noise;
   if(time>69.1&&time<69.4&&frame==2075.)coverage*=step(.178,y);
   if(time>36.&&time<37.)coverage*=step(y,.43);
   vec3 glitch=noise<0.?randomColor:(time<50.?vec3(.32)+randomColor*.66:vec3(.22,.30,.23)+randomColor*.60);
   col=mix(col,glitch,coverage);
 }
 // Source raster repeats every five physical pixels. Dark surfaces carry an
 // additive scan component; a multiplicative-only raster loses that texture.
 float stripe=texture2D(raster,vec2(uv0.x,.5)).r*2.-1.;
 float luminance=max(col.r,max(col.g,col.b));
 float sourceTime=frame/29.97003;
 if(time>=120.&&time<208.55){
   float footprint=max(1.,abs(dFdx(uv0.x))*1920.);
   stripe=cos((uv0.x*1920.-.5)*1.2566370614-.471)*sin(footprint*.6283185307)/(footprint*.5877852523);
   float dark=1.-smoothstep(.08,.30,luminance);
   col*=.85+.20*stripe*(2.*dark-1.);
   col+=.025*stripe*dark*step(.005,luminance);
 }else{
   col*=time>=208.55?1.:(sourceTime>=71.004&&sourceTime<72.005?.98+.02*stripe:(time>=47.947&&time<51.252?.95+.03*stripe:.85+.20*stripe));
   if(time<208.55)col+=.025*stripe*(1.-smoothstep(.08,.30,luminance))*step(.005,luminance);
 }
 if(time>=84.751&&time<88.956&&bands>.5)col=mix(col,vec3(bandLevel),mask);
 if(frame>=4956.&&frame<4987.&&bands>.5)col=mix(col,vec3(clamp(bandLevel*.85,0.,1.)),mask);
 // Grain is already present in the program-generated source backgrounds.
 if(border>.001){
  float side=step(min(uv0.x,1.-uv0.x),(.001+.004*hash(row+frame))*border);
  col=mix(col,vec3(0.),side);
 }
 col=mix(col,vec3(.97),flash);
 return clamp(col,0.,1.);
}
void main(){
 if(time>=30.){gl_FragColor=vec4(continuationFrame(),1.);return;}
 if(time<14.){gl_FragColor=vec4(legacyFrame(),1.);return;}
 float frame=floor(time*29.97003);float y=1.-uv0.y;
 float row=floor(y*1080.);float rnd=hash(row+frame*53.);
 vec2 p=uv0;
 // Fine scan displacement tears letters without moving the whole title block.
 p.x+=(rnd-.5)*54.*tear/1920.;
 float slab=floor(y*45.);p.x+=(hash(slab+frame*7.)-.5)*20.*tear/1920.;
 if(split>.5&&y>.436&&y<.552){p.y+=(step(.490,y)-.5)*21./1080.;}
 vec2 shift=vec2(rgb/1920.,rgbY/1080.);
 vec3 col=texture2D(source,p).rgb;
 col.r=texture2D(source,p+shift).r;col.b=texture2D(source,p-shift).b;
 float holes=step(.86,hash(row*3.+frame));
 col=mix(col,vec3(.055),holes*tear*.48*step(.18,max(col.r,max(col.g,col.b))));
 col=mix(col,vec3(1.),flash);
 if(bands>.5){
   float mask=clamp(bar(band1,y)+bar(band2,y)+bar(band3,y),0.,1.);
   float uneven=(hash(row*.7+frame)-.5)*.003*tear;
   float red=clamp(edge(band1,y,-.008)+edge(band2,y,-.008),0.,1.);
   float cyan=clamp(edge(band1,y,.004)+edge(band2,y,.004),0.,1.);
   float centerGlow=exp(-pow((uv0.x-.53)*2.,2.)*2.3);
   float level=.535*(.78+.42*centerGlow);
   float block=hash(floor(uv0.x*8.)+floor(y*11.)*13.+frame*.17);
   vec3 bandColor=vec3(level);
   vec3 r=tint>.5?vec3(.34,.03,.32):vec3(.34,.075,.095);
   vec3 b=tint>.5?vec3(.02,.34,.04):vec3(.02,.29,.26);
   float backgroundMask=1.-step(.22,max(col.r,max(col.g,col.b)));
   col*=1.-black*backgroundMask;
   float dirty=chunks*step(y,.62)*backgroundMask;
   vec3 dirtyColor=vec3(max(.13,level+(block-.72)*.33));
   col=mix(col,dirtyColor,dirty);
   col=mix(col,bandColor,mask);
   col=mix(col,r,red*.76);col=mix(col,b,cyan*.76);
   col+=uneven;
 }
 // Match the fine vertical raster seen in both the source lettering and background.
 float raster=1.-.23*(1.-flash*.92)*pow(abs(sin(uv0.x*1920.*1.04719755)),2.);
 col*=raster;
 col+=(hash(gl_FragCoord.x+gl_FragCoord.y*1920.+frame)-.5)*.008;
 float side=step(min(uv0.x,1.-uv0.x),(.0015+.006*hash(row+frame))*border);
 col=mix(col,vec3(0.),side);
 gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

// Compile the longer sequence separately. Software WebGL drivers otherwise
// carry the entire title shader through every continuation frame.
export const continuationShader=fragmentShader.slice(0,fragmentShader.indexOf('vec3 legacyFrame'))
 +fragmentShader.slice(fragmentShader.indexOf('float bar'),fragmentShader.indexOf('void main'))
 +'void main(){gl_FragColor=vec4(continuationFrame(),1.);}';

export const cleanContinuationShader=`
precision highp float;
uniform sampler2D source,raster;uniform float time,flash;varying vec2 uv0;
void main(){
 vec3 col=texture2D(source,uv0).rgb;
 float stripe=texture2D(raster,vec2(uv0.x,.5)).r*2.-1.;
 float luminance=max(col.r,max(col.g,col.b));
 float sourceTime=floor(time*29.97003+.5)/29.97003;
 if(time>=120.&&time<208.55){
   float footprint=max(1.,abs(dFdx(uv0.x))*1920.);
   stripe=cos((uv0.x*1920.-.5)*1.2566370614-.471)*sin(footprint*.6283185307)/(footprint*.5877852523);
   float dark=1.-smoothstep(.08,.30,luminance);
   col*=.85+.20*stripe*(2.*dark-1.);
   col+=.025*stripe*dark*step(.005,luminance);
 }else{
   col*=time>=208.55?1.:(sourceTime>=71.004&&sourceTime<72.005?.98+.02*stripe:(time>=47.947&&time<51.252?.95+.03*stripe:.85+.20*stripe));
   if(time<208.55)col+=.025*stripe*(1.-smoothstep(.08,.30,luminance))*step(.005,luminance);
 }
 col=mix(col,vec3(.97),flash);
 gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;
