// (앱에는 안 씀. 호감이 2026-11-25 그린 그림을 빼기로 함. 임시 폴더에만 만들어요)
// 기본 배경 만들기: node 시안/배경-만든코드/만들기.mjs [폴더]  (크롬만 있으면 돼요)
import fs from 'fs';import os from 'os';import path from 'path';import {spawn} from 'child_process';import {fileURLToPath} from 'url';
const HERE=path.dirname(fileURLToPath(import.meta.url)),OUT=path.resolve(process.argv[2]||path.join(os.tmpdir(),'hogam-bg-out')),ONLY=process.env.ONLY;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-bg-'));fs.mkdirSync(OUT,{recursive:true});
const ch=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${tmp}`,'--no-first-run','about:blank'],{stdio:['ignore','ignore','pipe']});
const url=await new Promise(r=>{let b='';ch.stderr.on('data',d=>{b+=d;const m=b.match(/ws:\/\/\S+/);if(m)r(m[0]);});});
const ws=new WebSocket(url);await new Promise(r=>ws.onopen=r);let n=0,wait={};ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){wait[d.id]?.(d);delete wait[d.id];}};
const send=(method,params={},sessionId)=>new Promise(r=>{wait[++n]=r;ws.send(JSON.stringify({id:n,method,params,sessionId}));});
const t=(await send('Target.getTargets')).result.targetInfos.find(x=>x.type==='page').targetId,S=(await send('Target.attachToTarget',{targetId:t,flatten:true})).result.sessionId;
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true},S);if(r.result?.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description||'eval');return r.result?.result?.value;};
await ev(fs.readFileSync(path.join(HERE,'그리기.js'),'utf8')+';0');
const meta=await ev('SC.map(s=>s.slice(0,3))'),cnt={},list=[];let low=0;
for(const[i,[k,cat,name]]of meta.entries()){cnt[k]=(cnt[k]||0)+1;const id=`${k}-${cnt[k]}`;list.push({id,cat,name});if(ONLY&&!id.startsWith(ONLY))continue;
  const o=await ev(`(async()=>{const cv=draw(${i}),f=async(w,q)=>{const c=document.createElement('canvas');c.width=w;c.height=w*9/16;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(cv,0,0,c.width,c.height);return c.toDataURL('image/webp',q).split(',')[1]};return{z:zone(cv),a:await f(1920,.86),t:await f(384,.8)}})()`);
  fs.writeFileSync(path.join(OUT,id+'.webp'),Buffer.from(o.a,'base64'));fs.writeFileSync(path.join(OUT,id+'-s.webp'),Buffer.from(o.t,'base64'));
  const bad=o.z[0]<4||o.z[1]<2.5;if(bad)low++;console.log(bad?'밝음':'  ok',id,name,'평균',o.z[0].toFixed(1),'밝은 곳',o.z[1].toFixed(1),(o.a.length*.75/1024|0)+'KB');}
const PH=JSON.parse(fs.readFileSync(path.join(HERE,'사진.json'))).map(({id,cat,name,d})=>({id,cat,name,...(d?{d}:{})})); // 사진(사진넣기.mjs)은 목록 앞에 그대로
fs.writeFileSync(path.join(OUT,'list.json'),JSON.stringify([...PH,...list]));console.log(`${list.length}장 · 글자 자리가 밝은 것 ${low}장`);ch.kill();ws.close();setTimeout(()=>{fs.rmSync(tmp,{recursive:true,force:true});process.exit(0)},600);
