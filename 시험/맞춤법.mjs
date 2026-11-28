// 맞춤법 검사 창 시험: node 시험/맞춤법.mjs  (크롬만 있으면 돼요. 실제 서버에는 붙지 않아요. SHOT=폴더 를 주면 화면을 찍어요)
// 검사 중에 X로 창만 닫아도 검사는 계속 · 끝나면 알림의 '보기'로 다시 열기 · 결과 창도 X로 닫기
import http from 'http';import fs from 'fs';import os from 'os';import path from 'path';import {spawn} from 'child_process';import {fileURLToPath} from 'url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT=process.env.SHOT,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-spell-')),z=ms=>new Promise(r=>setTimeout(r,ms));
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  if(q.url.startsWith('/config.js'))return r.end('window.HOGAM_CONFIG={SUPABASE_URL:"https://example.invalid",SUPABASE_ANON_KEY:"x"};');
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end();}
  r.setHeader('content-type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f));});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const host=`http://127.0.0.1:${srv.address().port}`,base=host+'/index.html';
const ch=spawn(CHROME,[...(process.env.HEAD?[]:['--headless=new']),'--remote-debugging-port=0',`--user-data-dir=${tmp}`,'--no-first-run','--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
const url=await new Promise(r=>{let b='';ch.stderr.on('data',d=>{b+=d;const m=b.match(/ws:\/\/\S+/);if(m)r(m[0]);});});
const ws=new WebSocket(url);await new Promise(r=>ws.onopen=r);let n=0,wait={},errs=[];
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){wait[d.id]?.(d);delete wait[d.id];}
  if(d.method==='Runtime.exceptionThrown'){const t=d.params.exceptionDetails;errs.push(t.exception?.description||t.text);}
  if(d.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true},d.sessionId);};
const send=(method,params={},sessionId)=>new Promise((r,j)=>{const id=++n,t=setTimeout(()=>{delete wait[id];j(new Error("20초 동안 답 없음: "+method+" "+JSON.stringify(params).slice(0,200)));},20000);wait[id]=d=>{clearTimeout(t);r(d);};ws.send(JSON.stringify({id,method,params,sessionId}));});
const pages=async()=>(await send('Target.getTargets')).result.targetInfos.filter(t=>t.type==='page');
const S=(await send('Target.attachToTarget',{targetId:(await pages())[0].targetId,flatten:true})).result.sessionId;
for(const m of ['Runtime.enable','Page.enable'])await send(m,{},S);
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true,userGesture:true},S);if(r.result?.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description||'eval');return r.result?.result?.value;};
const until=async(e,ms=20000)=>{const t=Date.now();while(Date.now()-t<ms){if(await ev(`return !!(${e})`).catch(()=>0))return true;await z(150);}return false;};
let ok=0,bad=0;const is=(name,v)=>{v?ok++:bad++;console.log(v?'통과':'실패',name);};
const shot=async f=>{if(SHOT)fs.writeFileSync(path.join(SHOT,f),Buffer.from((await send('Page.captureScreenshot',{format:'png'},S)).result.data,'base64'));};
const vis=id=>`(()=>{const e=$('${id}');return !!e&&e.getClientRects().length>0})()`;
try{
  await send('Page.navigate',{url:base},S);await until(`document.readyState==='complete'&&typeof afterLogin==='function'`);await z(1200);
  // 가짜 AI: 부르면 GO()를 부를 때까지 기다려요
  await ev(`$('gate').classList.remove('on');me={id:'u1',name:'김목자',church:'c1',role:'member'};
    window.OPEN=false;window.Q=[];window.GO=()=>{OPEN=true;Q.splice(0).forEach(f=>f());}; // GO 전까지는 AI가 답하지 않아요 (검사는 AI를 여러 번 불러요)
    Object.defineProperty(sb,'functions',{configurable:true,value:{invoke:()=>new Promise(r=>{const f=()=>r({data:{text:'[{"line":1,"before":"하나님이","after":"하나님께서","type":"맞춤법","reason":"시험","keep":true}]'},error:null});OPEN?f():Q.push(f);})}});
    sb.rpc=async()=>({data:null,error:null});
    window.AIR=[{line:0,before:'하나님이',after:'하나님께서',type:'맞춤법',reason:'시험',kind:'sp'}];aiCheck=async()=>{await new Promise(r=>OPEN?r():Q.push(r));return JSON.parse(JSON.stringify(AIR));};
    const ta=$('outText');ta.value='만복의 근원 하나님이\\n온 백성 찬송 드리고';ta.dispatchEvent(new Event('input',{bubbles:true}));setPage('song');await new Promise(r=>setTimeout(r,300));$('checkBtn').click();await new Promise(r=>setTimeout(r,300))`);
  is('검사 중 창에 X 단추',await ev(`return ${vis('fixbar')}&&${vis('fxX')}&&$('fixbar').textContent.includes('확인하고 있어요')`));
  await shot('1-working.png');
  await ev(`$('fxX').click();await new Promise(r=>setTimeout(r,200))`);
  is('X를 누르면 창만 닫히고 검사는 계속 (단추는 도는 중)',await ev(`return !${vis('fixbar')}&&$('checkBtn').disabled&&checkMsg==='working'&&$('toast').textContent.includes('계속')`));
  await ev(`GO();await new Promise(r=>setTimeout(r,400))`);
  is('검사가 끝나도 창은 닫힌 채, 알림에 고칠 곳 수와 "보기"',await ev(`const b=$('toast').querySelector('.tundo');return !${vis('fixbar')}&&!$('checkBtn').disabled&&$('toast').textContent.includes('고칠 곳 1곳')&&b&&b.textContent==='보기'`));
  await ev(`$('toast').querySelector('.tundo').click();await new Promise(r=>setTimeout(r,200))`);
  is('보기 → 결과 창이 다시 열림',await ev(`return ${vis('fixbar')}&&$('fixbar').textContent.includes('하나님께서')`));
  is('위 줄(번호·이전·다음)이 한 줄',await ev(`const t=$('fixbar').querySelector('.top'),a=$('fxPrev').getBoundingClientRect(),n=$('fxNext').getBoundingClientRect(),c=t.querySelector('.cnt').getBoundingClientRect();return Math.abs(a.top-n.top)<3&&Math.abs(a.top-c.top)<8`));
  is('X는 창 오른쪽 위 모서리',await ev(`const b=$('fixbar').getBoundingClientRect(),x=$('fxX').getBoundingClientRect();return b.right-x.right<12&&x.top-b.top<12`));
  await shot('2-result.png');
  await ev(`$('fxX').click();await new Promise(r=>setTimeout(r,200))`);
  is('결과 창도 X로 닫힘',await ev(`return !${vis('fixbar')}`));
  await ev(`OPEN=false;$('checkBtn').click();await new Promise(r=>setTimeout(r,200))`);
  is('다시 검사하면 창이 다시 보임',await ev(`return ${vis('fixbar')}&&${vis('fxX')}`));
  await ev(`GO();await new Promise(r=>setTimeout(r,400))`);
  await ev(`OPEN=false;AIR=[];$('checkBtn').click();await new Promise(r=>setTimeout(r,200));$('fxX').click();GO();await new Promise(r=>setTimeout(r,400))`);
  is('고칠 곳이 없으면 "보기" 없이 알림만',await ev(`return $('toast').textContent.includes('고칠 곳이 없어요')&&!$('toast').querySelector('.tundo')`));
  await ev(`AIR=[{line:0,before:'하나님이',after:'하나님께서',type:'맞춤법',reason:'시험',kind:'sp'}];OPEN=false;$('checkBtn').click();await new Promise(r=>setTimeout(r,200));GO();await new Promise(r=>setTimeout(r,400))`);
  is('창을 안 닫았으면 끝나도 알림 없이 결과가 바로',await ev(`return ${vis('fixbar')}&&!($('toast').querySelector('.tundo')&&$('toast').classList.contains('on')&&$('toast').textContent.includes('검사가 끝났어요'))`));
  is('코드 오류 없음',!errs.filter(e=>!/fetch|network|invalid|Failed/i.test(e)).length);if(errs.length)console.log(errs.slice(0,3).map(e=>e.slice(0,300)));
}catch(e){bad++;console.log('멈춤',e.message);}
console.log(`통과 ${ok} · 실패 ${bad}`);ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(bad?1:0);
