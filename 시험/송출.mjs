// 송출 화면 시험: node 시험/송출.mjs  (크롬만 있으면 돼요. 실제 서버에는 붙지 않아요)
import http from 'http';import fs from 'fs';import os from 'os';import path from 'path';import {spawn} from 'child_process';import {fileURLToPath} from 'url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT=process.env.SHOT,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-live-')),z=ms=>new Promise(r=>setTimeout(r,ms));
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  if(q.url.startsWith('/config.js'))return r.end('window.HOGAM_CONFIG={SUPABASE_URL:"https://example.invalid",SUPABASE_ANON_KEY:"x"};');
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end();}
  r.setHeader('content-type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'})[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f));});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${srv.address().port}/index.html`;
const ch=spawn(CHROME,[...(process.env.HEAD?[]:['--headless=new']),'--remote-debugging-port=0',`--user-data-dir=${tmp}`,'--no-first-run','--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
const url=await new Promise(r=>{let b='';ch.stderr.on('data',d=>{b+=d;const m=b.match(/ws:\/\/\S+/);if(m)r(m[0]);});});
const ws=new WebSocket(url);await new Promise(r=>ws.onopen=r);let n=0,wait={},errs=[];
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){wait[d.id]?.(d);delete wait[d.id];}
  if(d.method==='Runtime.exceptionThrown'){const t=d.params.exceptionDetails;errs.push(t.exception?.description||t.text);}
  if(d.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true},d.sessionId);};
const send=(method,params={},sessionId)=>new Promise(r=>{wait[++n]=r;ws.send(JSON.stringify({id:n,method,params,sessionId}));});
const attach=async id=>{const s=(await send('Target.attachToTarget',{targetId:id,flatten:true})).result.sessionId;for(const m of ['Runtime.enable','Page.enable','Network.enable'])await send(m,{},s);await send('Emulation.setFocusEmulationEnabled',{enabled:true},s);return s;};
const pages=async()=>(await send('Target.getTargets')).result.targetInfos.filter(t=>t.type==='page');
let S=await attach((await pages())[0].targetId);const main=(await pages())[0].targetId;
const ev=async(e,s=S)=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true,userGesture:true},s);if(r.result?.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description||'eval');return r.result?.result?.value;};
const until=async(e,ms=40000,s=S)=>{const t=Date.now();while(Date.now()-t<ms){if(await ev(`return !!(${e})`,s).catch(()=>0))return true;await z(150);}return false;};
let ok=0,bad=0;const is=(name,v)=>{v?ok++:bad++;console.log(v?'통과':'실패',name);};
const key=async(k,code,s=S)=>{const vk={ArrowRight:39,ArrowLeft:37,Enter:13,' ':32}[k]||k.toUpperCase().charCodeAt(0);if(process.env.HEAD){await send('Page.bringToFront',{},s);await z(250);}for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:k,code:code||k,windowsVirtualKeyCode:vk},s);await z(350);};
const open=async()=>{await send('Page.navigate',{url:base},S);await until(`document.readyState==='complete'&&typeof liveRestore==='function'&&LOOK`);await z(1500);await ev(`$('gate').classList.remove('on')`);};
// 송출 창 그림의 지문 (실제로 보이는 픽셀)
const pix=s=>ev(`const c=document.getElementById('c'),d=c.getContext('2d').getImageData(0,0,1920,1080).data;let h=0;for(let i=0;i<d.length;i+=404)h=(h*31+d[i]+d[i+1]*3+d[i+2]*7)|0;return h+':'+[...d.slice(0,3)]`,s);
const shot=async(f,s)=>{if(SHOT)fs.writeFileSync(path.join(SHOT,f),Buffer.from((await send('Page.captureScreenshot',{format:'png'},s)).result.data,'base64'));};
try{
  await ev(`localStorage`).catch(()=>{});await send('Page.navigate',{url:base},S);await z(2500);
  await ev(`sessionStorage.setItem('cj_church','test-church')`);await open();
  await ev(`for(const [id,v] of [['outText','만복의 근원 하나님\\n온 백성 찬송 드리고\\n\\n저 천사여 찬송하세\\n찬송 성부 성자 성령\\n\\n아멘 아멘\\n아멘'],['wordText','요한복음 3:16\\n하나님이 세상을 이처럼 사랑하사\\n독생자를 주셨으니\\n\\n이는 저를 믿는 자마다\\n멸망치 않고 영생을 얻게'],['quoteText','시편 23:1\\n여호와는 나의 목자시니\\n내가 부족함이 없으리로다']]){const e=$(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}
    LOOK.quote.quoteStyle='caption';setPage('slides')`);await z(1500);
  const total=await ev(`return allShots().length`);is(`화면이 생김 (${total}장)`,total>=3);is('투명 자막 화면이 들어 있음',await ev(`return allShots().some(isCaption)`));
  // 참고 구절 자막(투명)도 검사
  await z(300);is('송출 단추가 로고·아래 문구 바로 옆',await ev(`return $('rgLive').previousElementSibling?.dataset.k==='logo'`));
  is('폭 1440에서도 송출 단추가 다 보임',await ev(`const r=$('dlLive').getBoundingClientRect();return r.width>0&&r.right<=innerWidth&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('#dlLive')!==null`));
  is('참고 구절에서도 하나만 남아 있음',await ev(`lookTab='quote';buildLookUI();await 0;await 0;const ok=document.querySelectorAll('#lookCtl #dlLive').length===1;lookTab='song';buildLookUI();return ok`));
  await ev(`setPage('slides');$('dlLive').click()`);is('받아 두기가 끝나 시작 단추가 켜짐',await until(`!$('lvStart').disabled`));await shot('1-start.png',S);
  await ev(`$('lvStart').click()`);await z(1500);
  const popT=async()=>(await pages()).find(t=>t.targetId!==main);let pt=await popT();is('송출 창이 열림',!!pt);let P=await attach(pt.targetId);await z(500);
  const first=await pix(P);await ev(`document.documentElement.dataset.theme='light'`);await z(300);await shot('2-console.png',S);await shot('3-output.png',P);
  await key('ArrowRight');const second=await pix(P);is('→ 로 넘기면 송출 창 그림이 바뀜',first!==second);
  await key('ArrowLeft');is('← 로 돌아오면 첫 그림과 같음',await pix(P)===first);
  await key(' ','Space');is('스페이스로 한 장만 넘어감',await ev(`return LIVE.i`)===1);
  await key('ArrowRight','ArrowRight',P);is('송출 창에서 눌러도 넘어감',await ev(`return LIVE.i`)===2);
  await key('1','Digit1');await key('Enter');is('번호+Enter로 바로 감',await ev(`return LIVE.i`)===0);
  await key('b','KeyB');is('검은 화면',(await pix(P)).endsWith(':0,0,0'));await key('b','KeyB');is('검은 화면 풀면 돌아옴',await pix(P)===first);
  await key('c','KeyC');const cl=await pix(P);is('자막만 지움 (글자 없음 · 검정 아님)',cl!==first&&!cl.endsWith(':0,0,0'));await key('c','KeyC');
  await ev(`$('lvBgGreen').click()`);await z(600);is('초록 배경',(await pix(P)).endsWith(':0,177,64'));await shot('4-green.png',P);await ev(`$('lvBgPic').click()`);await z(500);
  is('배경으로 돌아오면 첫 그림과 같음',await pix(P)===first);
  // 문구 · 배치
  is('ON AIR · 현재 슬라이드 · 원본 그대로',await ev(`return $('lvSt').textContent==='ON AIR'&&$('lvNowT').textContent==='현재 슬라이드'&&$('lvBgPic').textContent==='원본 그대로'&&!document.getElementById('lvOrd')`));
  is('이전·다음이 정중앙',await ev(`const a=$('lvPrev').getBoundingClientRect(),b=$('lvGo').getBoundingClientRect(),p=$('livebox');return Math.abs((a.left+b.right)/2-p.clientWidth/2)<3`));
  is('위 단추가 가운데',await ev(`const r=document.querySelector('.lvbtns').getBoundingClientRect();return Math.abs((r.left+r.right)/2-$('livebox').clientWidth/2)<3`));
  // 끌어서 순서 바꾸기 (첫 화면을 맨 뒤로)
  const ids=()=>ev(`return LIVE.slides.map(x=>x.id).join()`),o0=await ids();
  await ev(`const g=$('lvGrid').children,a=g[0],b=g[g.length-1],dt=new DataTransfer(),r=b.getBoundingClientRect();a.dispatchEvent(new DragEvent('dragstart',{dataTransfer:dt,bubbles:true}));for(const t of ['dragover','drop'])b.dispatchEvent(new DragEvent(t,{dataTransfer:dt,clientX:r.right-4,clientY:r.top+9,bubbles:true,cancelable:true}));a.dispatchEvent(new DragEvent('dragend',{dataTransfer:dt}))`);await z(500);
  is('끌면 순서가 바뀜',await ids()!==o0&&(await ids()).split(',').pop()===o0.split(',')[0]);is('나가 있는 화면은 그대로 따라감',await pix(P)===first&&await ev(`return LIVE.i===LIVE.slides.length-1`));
  const o1=await ids();
  // 편집 → 바로 반영. 사람이 편집 화면을 만지기 전(저절로 바뀐 것)에는 안 나감
  const fix=t=>ev(`const s0=songGroups().flatMap(g=>g.items).find(x=>x.type==='song'),w=$('outText');w.value=w.value.replace(s0.lines[0],s0.lines[0]+' ${t}');w.dispatchEvent(new Event('input',{bubbles:true}))`);
  await fix('가');is('사람이 안 만졌는데 바뀌면 알림만',await until(`!$('lvChg').classList.contains('hidden')`,6000)&&await pix(P)===first);
  await ev(`$('lvEdit').click()`);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:720,y:160,button:'left',clickCount:1},S);
  const t1=Date.now();await fix('나');let fast=0;while(Date.now()-t1<8000){if(await ev(`return LIVE.sig===liveSig()`)){fast=Date.now()-t1;break;}await z(60);}
  await z(400);const edited=await pix(P);is(`편집하면 단추 없이 나감 (${fast}ms)`,fast>0&&edited!==first);is('바꾼 송출 순서는 지켜짐',await ids()===o1);
  // 팀원이 바꾼 모양은 저절로 안 나감
  await ev(`teamApply('look',{...LOOK,song:{...LOOK.song,size:LOOK.song.size+1}})`);await z(2500);is('팀원이 바꾼 모양은 저절로 안 나감',await pix(P)===edited);
  await ev(`$('lvPill').click()`);is('팀원 모양 알림',await until(`!$('lvChg').classList.contains('hidden')&&$('lvChgTx').textContent.includes('팀원')`,4000));
  await ev(`$('lvApply').click()`);is('반영을 누르면 나감',await until(`LIVE.sig===liveSig()&&$('lvChg').classList.contains('hidden')`)&&(await z(800),await pix(P))!==edited);
  await ev(`$('lvOrder0').click()`);is('원래 순서로',await ids()===o0);
  // 인터넷 끊기 → 처음부터 끝까지, 창 닫았다 열기
  const off=v=>Promise.all([S,P].map(s=>send('Network.emulateNetworkConditions',{offline:v,latency:0,downloadThroughput:-1,uploadThroughput:-1},s)));
  await off(true);const seen=[];await ev(`liveMove(0)`);await z(400);for(let i=0;i<total;i++){seen.push(await pix(P));await key('ArrowRight');}
  is('인터넷 없이 끝까지 넘어감 (모두 다른 그림)',new Set(seen).size===total);
  await ev(`liveMove(1)`);await z(400);const keep=await pix(P);
  await send('Target.closeTarget',{targetId:pt.targetId});is('창이 닫히면 알림이 뜸',await until(`!$('lvGone').classList.contains('hidden')`,6000));await shot('5-closed.png',S);
  await ev(`$('lvReopen').click()`);await z(1500);pt=await popT();P=await attach(pt.targetId);await z(400);is('인터넷 없이 다시 열면 같은 화면',await pix(P)===keep);
  await off(false);
  // 조작 창 새로고침
  await ev(`liveMove(2);LIVE.bg='green';liveNow()`);await z(600);const kg=await pix(P);await open();
  is('새로고침 뒤 이어가기 단추',await until(`LIVE&&!$('lvPill').classList.contains('hidden')`,8000));is('같은 자리 · 같은 배경',await ev(`return LIVE.i===2&&LIVE.bg==='green'`));
  is('새로고침해도 송출 창은 그대로 남음',!!(await popT())&&await pix(P)===kg);
  await ev(`$('lvPill').click()`);await ev(`$('lvReopen').click()`);await z(800);is('다시 이어지고 창은 하나',(await pages()).length===2);
  await key('ArrowLeft');is('이어서 넘기면 송출 창이 바뀜',await pix(P)!==kg);
  await key('ArrowRight','ArrowRight',P);is('이어진 뒤 송출 창 키도 됨',await ev(`return LIVE.i`)===2);
  // 전체 화면: 크롬은 시험이 흉내 낸 클릭에는 전체 화면을 안 내줘서, 요청을 보내는지만 봐요 (진짜 전환은 손으로 확인)
  await ev(`window.__f=0;const o=document.documentElement;o.requestFullscreen=()=>{window.__f++;return Promise.resolve();}`,P);
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:200,y:200,button:'left',clickCount:1},P);await z(500);
  is('송출 창을 누르면 전체 화면을 요청함',await ev(`const n=window.__f;delete document.documentElement.requestFullscreen;return n===1`,P));
  await ev(`$('lvFull').click()`);await z(1200);is('조작 창 단추로 전체 화면',await ev(`return !!document.fullscreenElement`,P));
  const ms=await ev(`const g=songGroups,one=g();window.__g=songGroups;songGroups=()=>one.map(x=>({...x,items:Array(20).fill(x.items[0])}));const t=performance.now(),d=await liveBake();songGroups=g;return Math.round((performance.now()-t))+'ms · '+d.slides.length+'장 · '+(d.slides.reduce((a,s)=>a+s.full.size+s.clear.size+s.green.size+s.thumb.size,0)/1048576).toFixed(1)+'MB'`);console.log('받아 두는 시간',ms);
  // 하루 지난 것 · 나가기
  await ev(`$('lvEnd').click()`);await z(900);is('끝내면 창이 닫히고 저장한 그림도 지워짐',(await pages()).length===1&&await ev(`return (await liveKv('readonly',o=>o.getAllKeys())).length`)===0);
  await ev(`await liveKv('readwrite',o=>o.put({at:Date.now()-25*3600e3,ch:'x'},'data:x'))`);await open();await z(800);is('하루 지난 그림은 지워짐',await ev(`return (await liveKv('readonly',o=>o.getAllKeys())).length`)===0);
  const mine=errs.filter(e=>/live/i.test(e));is('송출 코드 오류 없음',!mine.length);if(mine.length)console.log(mine.slice(0,3));
}catch(e){bad++;console.log('멈춤',e.message);}
console.log(`통과 ${ok} · 실패 ${bad}`);ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(bad?1:0);
