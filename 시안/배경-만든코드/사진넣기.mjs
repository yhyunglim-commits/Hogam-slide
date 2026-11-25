// 사진을 기본 배경에 넣기: node 시안/배경-만든코드/사진넣기.mjs 사진폴더   (사진폴더/번호.jpg, 번호는 사진.json의 n. 크롬만 있으면 돼요)
import http from 'http';import fs from 'fs';import os from 'os';import path from 'path';import {spawn,spawnSync} from 'child_process';import {fileURLToPath} from 'url';
const HERE=path.dirname(fileURLToPath(import.meta.url)),OUT=path.join(HERE,'../../brand/bg'),IN=path.resolve(process.argv[2]),P=JSON.parse(fs.readFileSync(path.join(HERE,'사진.json')));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-ph-'));
const srv=http.createServer((q,r)=>{const f=path.join(tmp,path.basename(q.url));if(q.url==='/'||!fs.existsSync(f)){r.setHeader('content-type','text/html');return r.end('<meta charset=utf-8>');}r.setHeader('content-type','image/jpeg');r.end(fs.readFileSync(f));});await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const ch=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${tmp}/pf`,'--no-first-run',`http://127.0.0.1:${srv.address().port}/`],{stdio:['ignore','ignore','pipe']});
const url=await new Promise(r=>{let b='';ch.stderr.on('data',d=>{b+=d;const m=b.match(/ws:\/\/\S+/);if(m)r(m[0]);});});await new Promise(r=>setTimeout(r,1500));
const ws=new WebSocket(url);await new Promise(r=>ws.onopen=r);let n=0,wait={};ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){wait[d.id]?.(d);delete wait[d.id];}};
const send=(method,params={},sessionId)=>new Promise(r=>{wait[++n]=r;ws.send(JSON.stringify({id:n,method,params,sessionId}));});
const t=(await send('Target.getTargets')).result.targetInfos.find(x=>x.type==='page').targetId,S=(await send('Target.attachToTarget',{targetId:t,flatten:true})).result.sessionId;
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true},S);if(r.result?.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description||'eval');return r.result?.result?.value;};
// 글자 자리(가운데)의 명암비가 평균 4·밝은 곳 2.5가 되는 가장 작은 '어둡게' 값(5 단위, 최대 60)
for(const p of P){const f=path.join(tmp,p.n+'.jpg');let src=path.join(IN,p.n+'.jpg');if(p.crop){const[x,y,w,h]=p.crop,c=path.join(tmp,'c'+p.n+'.jpg');spawnSync('sips',['-c',h,w,'--cropOffset',y,x,src,'--out',c].map(String));src=c;}
  if(spawnSync('sips',['-Z','2600',src,'--out',f]).status)throw new Error('사진 없음 '+p.n);
  const o=await ev(`(async()=>{const im=new Image();im.src='/${p.n}.jpg';await im.decode();const mk=(w,q)=>{const h=w*9/16,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),k=Math.max(w/im.width,h/im.height);x.imageSmoothingQuality='high';x.drawImage(im,(w-im.width*k)/2,(h-im.height*k)/2,im.width*k,im.height*k);return[c,c.toDataURL('image/webp',q).split(',')[1]]};
    const[c,a]=mk(1920,.82),d=c.getContext('2d').getImageData(384,389,1152,475).data;let dim=0,m,h;for(;dim<=60;dim+=5){const f=q=>{q=q*(1-dim/100)/255;return q<=.03928?q/12.92:Math.pow((q+.055)/1.055,2.4)},v=[];for(let i=0;i<d.length;i+=164)v.push(.2126*f(d[i])+.7152*f(d[i+1])+.0722*f(d[i+2]));v.sort((a,b)=>a-b);m=1.05/(v.reduce((a,b)=>a+b,0)/v.length+.05);h=1.05/(v[v.length*.95|0]+.05);if(m>=4&&h>=2.5)break;}
    return{a,t:mk(384,.8)[1],dim:Math.min(60,dim),m,h}})()`);
  fs.writeFileSync(path.join(OUT,p.id+'.webp'),Buffer.from(o.a,'base64'));fs.writeFileSync(path.join(OUT,p.id+'-s.webp'),Buffer.from(o.t,'base64'));p.d=o.dim;
  console.log(o.m<4||o.h<2.5?'밝음':'  ok',p.id,p.name,'어둡게',o.dim,'평균',o.m.toFixed(1),'밝은 곳',o.h.toFixed(1),(o.a.length*.75/1024|0)+'KB');}
fs.writeFileSync(path.join(HERE,'사진.json'),'['+P.map(p=>JSON.stringify(p)).join(',\n')+']\n');
// 목록 순서
const CATS=['대림절','성탄절','새해','주현절','사순절','부활절','성령강림절','감사절','봄','여름','가을','겨울','하늘','산과 잎','빛과 색','질감'];
const L=JSON.parse(fs.readFileSync(path.join(OUT,'list.json'))).filter(o=>!P.some(p=>p.id===o.id));fs.writeFileSync(path.join(OUT,'list.json'),JSON.stringify([...P.map(({id,cat,name,d})=>({id,cat,name,...(d?{d}:{})})),...L].sort((a,b)=>CATS.indexOf(a.cat)-CATS.indexOf(b.cat))));
console.log('모두',P.length+L.length,'장');ch.kill();ws.close();srv.close();setTimeout(()=>{fs.rmSync(tmp,{recursive:true,force:true});process.exit(0)},600);
