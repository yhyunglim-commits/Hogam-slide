// 관리 홈 시험: node 시험/관리홈.mjs  (크롬만 있으면 돼요. 실제 서버에는 붙지 않아요. SHOT=폴더 를 주면 화면을 찍어요)
// 마스터가 교회 없이 들어오면 관리 홈 · 숫자 · NEW · 카드 옮기기(끌기·키보드) · 처음 순서로
import http from 'http';import fs from 'fs';import os from 'os';import path from 'path';import {spawn} from 'child_process';import {fileURLToPath} from 'url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT=process.env.SHOT,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-adm-')),z=ms=>new Promise(r=>setTimeout(r,ms));
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
const send=(method,params={},sessionId)=>new Promise(r=>{wait[++n]=r;ws.send(JSON.stringify({id:n,method,params,sessionId}));});
const pages=async()=>(await send('Target.getTargets')).result.targetInfos.filter(t=>t.type==='page');
const S=(await send('Target.attachToTarget',{targetId:(await pages())[0].targetId,flatten:true})).result.sessionId;
for(const m of ['Runtime.enable','Page.enable'])await send(m,{},S);
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true,userGesture:true},S);if(r.result?.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description||'eval');return r.result?.result?.value;};
const until=async(e,ms=20000)=>{const t=Date.now();while(Date.now()-t<ms){if(await ev(`return !!(${e})`).catch(()=>0))return true;await z(150);}return false;};
let ok=0,bad=0;const is=(name,v)=>{v?ok++:bad++;console.log(v?'통과':'실패',name);};
const shot=async f=>{if(SHOT)fs.writeFileSync(path.join(SHOT,f),Buffer.from((await send('Page.captureScreenshot',{format:'png'},S)).result.data,'base64'));};

const day=n=>new Date(Date.now()-n*864e5).toISOString();
const CS=[{id:'c1',name:'옥수교회',created_at:day(40),is_new:false,suspended_at:null,ai_month:12,ai_limit:50,bytes:1048576,last_used:day(1)},
  {id:'c2',name:'새빛교회',created_at:day(2),is_new:true,suspended_at:null,ai_month:50,ai_limit:50,bytes:2097152,last_used:day(0)},
  {id:'c3',name:'쉬는교회',created_at:day(90),is_new:false,suspended_at:day(5),ai_month:0,ai_limit:50,bytes:0,last_used:day(60)}];
const HOME={ai_month:62,ai_service:3000,ai_days:[0,1,2,3,4,5,6,7,8,9,10,11,12,13],tokens:{claude_in:12000,claude_out:5000},people:7,agreed:5,terms_ver:1,log:[{at:day(1),what:'교회를 멈춤',church:'쉬는교회'}]};
const fake=(o={})=>ev(`window.CALLS=[];window.SUPER=${JSON.stringify(o.sup??true)};window.CS=${JSON.stringify(o.cs||CS)};window.HOME=${JSON.stringify(HOME)};
  const q=d=>{const x={select:()=>x,eq:()=>x,order:()=>x,then:r=>r({data:d,error:null})};return x;};
  sb.from=t=>q(t==='members'?[]:t==='churches'?CS:[]);
  sb.rpc=async(f,a)=>{CALLS.push(f);if(f==='is_super')return {data:SUPER,error:null};if(f==='super_home')return {data:HOME,error:null};if(f==='super_churches')return {data:CS,error:null};if(f==='super_church')return {data:{memo:'',bytes:{},history:[],ai_kinds:[],ai_days:Array(14).fill(0)},error:null};if(f==='super_members')return {data:[],error:null};return {data:null,error:null};};
  sb.auth.signOut=async()=>({error:null});window.U={id:'m1',user_metadata:{nickname:'호감'},identities:[{provider:'kakao'}]};`);
const vis=id=>`(()=>{const e=$('${id}');return !!e&&e.getClientRects().length>0})()`;
const order=()=>ev(`return [...$('admGrid').children].map(e=>e.dataset.k).join()`);
const load=async()=>{await send('Page.navigate',{url:base},S);await until(`document.readyState==='complete'&&typeof afterLogin==='function'`);await z(800);};
try{
  await load();await ev(`localStorage.clear()`);await load();
  await fake();await ev(`await afterLogin(U);await new Promise(r=>setTimeout(r,200))`);
  is('마스터가 교회 없이 들어오면 관리 홈 (고르기 화면 아님)',await ev(`return ${vis('adm')}&&!$('gate').classList.contains('on')`));
  is('위쪽 숫자: 교회 3 · AI 62 · 팀원 7(동의 5·아직 2) · 확인할 일 2',await ev(`const t=[...$('admKpi').children].map(e=>e.querySelector('b').textContent).join();return t==='3,62,7,2'&&$('admKpi').textContent.includes('아직 2')`));
  is('카드 8장이 정한 순서로',(await order())==='churches,usage,pay,terms,mail,log,forms,manual');
  is('새 교회가 있으면 교회 관리에 NEW',await ev(`return !!document.querySelector('[data-k=churches] .anew')`));
  is('한도를 다 쓴 교회가 있으면 사용 현황에 NEW와 경고',await ev(`const c=document.querySelector('[data-k=usage]');return !!c.querySelector('.anew')&&c.querySelector('.acnt').classList.contains('warn')`));
  is('알림이 없는 카드에는 NEW 없음',await ev(`return ['pay','terms','mail','log','forms','manual'].every(k=>!document.querySelector('[data-k='+k+'] .anew'))`));
  is('최근 14일 막대 14개',await ev(`return document.querySelectorAll('[data-k=usage] .aspark i').length===14`));
  await shot('1-adm.png');
  await ev(`document.querySelector('[data-k=churches] .aopen').click();await new Promise(r=>setTimeout(r,300))`);
  is('열기 → 팝업 없이 교회 관리 페이지, 사이드바에 표시, NEW 사라짐',await ev(`return !$('spDlg').open&&${vis('admChurches')}&&!${vis('admHome')}&&document.querySelector('#admSide [aria-current=page]').dataset.p==='churches'&&$('admT').textContent==='교회 관리'&&!document.querySelector('[data-k=churches] .anew')`));
  is('교회 카드: 10분 안에 쓴 교회는 깜박이는 불, 쉬는 교회는 불 없음',await ev(`const cards=[...$('spGrid').querySelectorAll('.spcard')];const f=n=>cards.find(c=>c.textContent.includes(n));return !!f('새빛교회').querySelector('.splive.blink')&&!f('쉬는교회').querySelector('.splive')&&getComputedStyle(f('새빛교회').querySelector('.splive')).animationName==='spBlink'`));
  await shot('3-churches.png');
  await ev(`document.querySelector('#spGrid .spcard').click();await new Promise(r=>setTimeout(r,300))`);
  is('교회를 누르면 상세가 같은 자리에, 사이드바는 그대로',await ev(`return ${vis('spOne')}&&${vis('admSide')}`));
  await ev(`document.querySelector('#admSide [data-p=home]').click();await new Promise(r=>setTimeout(r,200))`);
  is('사이드바 관리 홈으로 돌아옴',await ev(`return ${vis('admHome')}&&!${vis('admChurches')}&&$('admT').textContent==='관리 홈'`));
  await ev(`document.querySelector('[data-k=usage] .aopen').click();await new Promise(r=>setTimeout(r,200))`);
  is('사용 현황 페이지: 교회별 AI가 많은 순',await ev(`return ${vis('admOther')}&&[...$('admOther').querySelectorAll('.aurow b')].map(b=>b.textContent).join()==='새빛교회,옥수교회,쉬는교회'`));
  await shot('4-usage.png');
  await ev(`document.querySelector('#admSide [data-p=home]').click();await showAdm()`);is('다시 열어도 본 NEW는 안 뜸',await ev(`return !document.querySelector('[data-k=churches] .anew')&&!document.querySelector('[data-k=usage] .anew')`));
  await ev(`CS.push({id:'c4',name:'또새교회',created_at:new Date().toISOString(),is_new:true,suspended_at:null,ai_month:0,ai_limit:50,bytes:0,last_used:null});await showAdm()`);
  is('새 교회가 또 생기면 다시 NEW',await ev(`return !!document.querySelector('[data-k=churches] .anew')`));
  // 키보드로 옮기기
  await ev(`document.querySelector('[data-k=churches] .adrag').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},S);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},S);await z(200);
  is('키보드 화살표로 한 칸 뒤로, 손잡이에 초점 유지',(await order()).startsWith('usage,churches')&&await ev(`return document.activeElement===document.querySelector('[data-k=churches] .adrag')`));
  // 마우스로 끌기: 교회 관리 손잡이 → 매뉴얼 카드 아래쪽
  const pt=await ev(`const a=document.querySelector('[data-k=churches] .adrag').getBoundingClientRect(),b=document.querySelector('[data-k=manual]').getBoundingClientRect();return [a.x+a.width/2,a.y+a.height/2,b.x+b.width*0.6,b.y+b.height*0.8]`);
  const m=(type,x,y,extra={})=>send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,...extra},S);
  const H=await ev(`return innerHeight`);
  await m('mouseMoved',pt[0],pt[1],{buttons:0});await m('mousePressed',pt[0],pt[1]);
  for(let i=1;i<=6;i++){await m('mouseMoved',pt[0]+(pt[2]-pt[0])*i/6,Math.min(H-20,pt[1]+(H-20-pt[1])*i/6));await z(40);}
  await z(1200); // 화면 아래 끝에 머물면 저절로 내려가요
  const p2=await ev(`const b=document.querySelector('[data-k=manual]').getBoundingClientRect();return [b.x+b.width*0.6,b.y+b.height*0.8]`);
  for(let i=1;i<=4;i++){await m('mouseMoved',pt[2]+(p2[0]-pt[2])*i/4,(H-20)+(p2[1]-(H-20))*i/4);await z(40);}
  await m('mouseReleased',p2[0],p2[1]);await z(300);
  is('끌다가 화면 아래 끝에 닿으면 저절로 내려감',await ev(`return $('adm').scrollTop>0`));
  const o1=await order();is('마우스로 끌면 그 자리로 옮겨짐',o1.endsWith('manual,churches'));
  await load();await fake();await ev(`await afterLogin(U);await new Promise(r=>setTimeout(r,200))`);
  is('새로고침해도 옮긴 순서 그대로',(await order()).endsWith('manual,churches'));
  await ev(`$('admReset').click();await new Promise(r=>setTimeout(r,300))`);
  is('처음 순서로',(await order())==='churches,usage,pay,terms,mail,log,forms,manual');
  // 교회로 들어가기 → 고르기 → 관리 홈으로
  await ev(`$('admEnter').click();await new Promise(r=>setTimeout(r,200))`);
  is('교회로 들어가기 → 고르기 화면, 관리 홈으로 단추',await ev(`return !${vis('adm')}&&${vis('gPick')}&&${vis('pkAdm')}`));
  await ev(`$('pkAdm').click();await new Promise(r=>setTimeout(r,200))`);is('관리 홈으로 돌아옴',await ev(`return ${vis('adm')}`));
  await ev(`$('admOut').click();await new Promise(r=>setTimeout(r,300))`);is('로그아웃하면 첫 화면',await ev(`return !${vis('adm')}&&${vis('gStart')}`));
  // 마스터가 아니면 관리 홈 없음
  await fake({sup:false});await ev(`await afterLogin(U);await new Promise(r=>setTimeout(r,200))`);
  is('마스터가 아니면 고르기 화면 (관리 홈으로 단추 없음)',await ev(`return !${vis('adm')}&&${vis('gPick')}&&!${vis('pkAdm')}`)||await ev(`return !${vis('adm')}&&${vis('gPick')}`));
  // 첫 화면 숨김 고친 것: 초대 링크로 오면 '초대 코드가 있나요?' 숨김
  await ev(`store.set('joinCode','ABCDEFGH');showGate()`);is('초대 링크로 오면 첫 화면의 초대 코드 링크는 숨김',await ev(`return !${vis('gCodeOpen')}`));
  await ev(`store.set('joinCode',null);showGate()`);is('평소에는 보임',await ev(`return ${vis('gCodeOpen')}`));
  // 휴대폰 폭
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true},S);
  await fake();await ev(`await showAdm()`);await z(300);
  is('휴대폰 폭: 사이드바는 위 가로 줄',await ev(`const a=document.querySelector('#admSide [data-p=home]').getBoundingClientRect(),b=document.querySelector('#admSide [data-p=churches]').getBoundingClientRect();return Math.abs(a.top-b.top)<2`));
  is('휴대폰 폭: 카드 한 줄, 옆으로 안 넘침',await ev(`return getComputedStyle($('admGrid')).gridTemplateColumns.split(' ').length===1&&$('adm').scrollWidth<=innerWidth`));
  await shot('2-adm-phone.png');
  is('코드 오류 없음',!errs.filter(e=>!/fetch|network|invalid|Failed/i.test(e)).length);if(errs.length)console.log(errs.slice(0,3).map(e=>e.slice(0,200)));
}catch(e){bad++;console.log('멈춤',e.message);}
console.log(`통과 ${ok} · 실패 ${bad}`);ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(bad?1:0);
