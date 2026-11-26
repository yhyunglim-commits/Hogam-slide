// 가입 시험: node 시험/가입.mjs  (크롬만 있으면 돼요. 실제 서버에는 붙지 않아요. SHOT=폴더 를 주면 화면을 찍어요)
// 초대 코드 없이 온 사람의 '무료로 시작 / 초대 코드' 고르기, 약관 동의, 이미 쓰던 사람의 동의 창
import http from 'http';import fs from 'fs';import os from 'os';import path from 'path';import {spawn} from 'child_process';import {fileURLToPath} from 'url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT=process.env.SHOT,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-join-')),z=ms=>new Promise(r=>setTimeout(r,ms));
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
// 가짜 서버: 부른 함수를 CALLS에 적고, 정해 둔 답을 돌려줘요
const fake=(o={})=>ev(`window.CALLS=[];window.MS=${JSON.stringify(o.ms||[])};window.AGREED=${JSON.stringify(o.agreed??false)};window.OUT=0;
  const q=d=>{const x={select:()=>x,eq:()=>x,order:()=>x,then:r=>r({data:d,error:null})};return x;};
  sb.from=t=>q(t==='members'?MS:t==='churches'?[{id:'c1',name:'옛교회'}]:[]);
  sb.rpc=async(f,a)=>{CALLS.push([f,a]);
    if(f==='agreed')return AGREED==='missing'?{data:null,error:{code:'PGRST202'}}:{data:AGREED,error:null};
    if(f==='agree_terms')return {data:{ok:a.p_ver===1},error:null};
    if(f==='create_church'||f==='join_church')return {data:{ok:false,error:'(시험) 멈춤'},error:null};
    return {data:null,error:null};};
  sb.auth.signOut=async()=>{OUT++;return {error:null};};
  if(${JSON.stringify(!!(o.ms||[]).length)})CH='c1';window.U={id:'u1',user_metadata:{nickname:'카카오닉'},identities:[{provider:'kakao'}]};`);
const vis=id=>`(()=>{const e=$('${id}');return !!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'})()`;
const calls=()=>ev(`return CALLS.map(c=>c[0]).join(',')`);
try{
  await send('Page.navigate',{url:base},S);await until(`document.readyState==='complete'&&typeof afterLogin==='function'`);await z(1200);
  // 1) 교회도 초대 링크도 없는 사람 → 고르기
  await fake();await ev(`await afterLogin(U)`);
  is('초대 코드 없이 오면 고르기 화면',await ev(`return ${vis('gPick')}&&!${vis('gStart')}&&!${vis('gJoin')}&&!${vis('gFree')}`));
  is('고르기 화면에서는 노트북 소개가 숨음',await ev(`return !${vis('gvl')}`));
  is('카드 두 장이 나란히 (넓은 화면)',await ev(`const a=$('pkFree').getBoundingClientRect(),b=$('pkCode').getBoundingClientRect();return Math.abs(a.top-b.top)<2&&a.right<=b.left&&Math.abs(a.height-b.height)<2`));
  is('무료 카드에 한도 세 가지',await ev(`const t=$('pkFree').textContent;return t.includes('무료')&&t.includes('50번')&&t.includes('5명')&&t.includes('50MB')`));
  await shot('1-pick.png');
  // 2) 무료로 시작
  await ev(`$('pkFree').click()`);
  is('무료 카드를 누르면 무료 시작 화면',await ev(`return ${vis('gFree')}&&!${vis('gPick')}`));
  is('내 이름에 카카오 닉네임이 미리 들어감',await ev(`return $('gfName').value==='카카오닉'`));
  is('약관 링크 두 개는 새 창으로',await ev(`const a=[...$('gfAgree').querySelectorAll('a')];return a.length===2&&a[0].getAttribute('href')==='terms.html'&&a[1].getAttribute('href')==='privacy.html'&&a.every(x=>x.target==='_blank')`));
  for(const f of ['terms.html','privacy.html'])is(f+' 이 열림',(await fetch(host+'/'+f)).status===200);
  await ev(`$('gfChurch').value='호감교회';$('gfGo').click();await new Promise(r=>setTimeout(r,300))`);
  is('동의 안 하면 막고 서버를 안 부름',await ev(`return $('gfErr').textContent.includes('동의')`)&&(await calls())==='');
  is('모두 동의를 누르면 둘 다 체크',await ev(`const b=$('gfAgree'),all=b.querySelector('[data-all]');all.click();return [...b.querySelectorAll('[data-one]')].every(x=>x.checked)`));
  is('하나를 끄면 모두 동의도 꺼짐',await ev(`const b=$('gfAgree');b.querySelectorAll('[data-one]')[1].click();return !b.querySelector('[data-all]').checked`));
  await ev(`$('gfAgree').querySelectorAll('[data-one]')[1].click()`);
  await ev(`$('gfChurch').value='가';$('gfGo').click();await new Promise(r=>setTimeout(r,200))`);
  is('교회 이름이 짧으면 막음',await ev(`return $('gfErr').textContent.includes('교회 이름')`)&&(await calls())==='');
  await shot('2-free.png');
  await ev(`$('gfChurch').value='호감교회';$('gfGo').click();await new Promise(r=>setTimeout(r,500))`);
  is('동의를 먼저 남기고 교회를 만듦',(await calls())==='agree_terms,create_church'&&await ev(`return CALLS[0][1].p_ver===1&&CALLS[1][1].p_church==='호감교회'&&CALLS[1][1].p_name==='카카오닉'`));
  is('서버 답(오류)을 그대로 보여 줌',await ev(`return $('gfErr').textContent==='(시험) 멈춤'`));
  // 3) 다시 고르기 · 초대 코드
  await ev(`document.querySelector('#gFree [data-gback]').click()`);is('다시 고르기',await ev(`return ${vis('gPick')}`));
  await ev(`$('pkCode').click();await new Promise(r=>setTimeout(r,200))`);is('초대 코드 카드 → 교회에 들어가기',await ev(`return ${vis('gJoin')}&&document.activeElement===$('jCode')`));
  await ev(`CALLS.length=0;$('jCode').value='ABCDEFGH';$('jGo').click();await new Promise(r=>setTimeout(r,300))`);
  is('초대 코드도 동의 안 하면 막음',await ev(`return $('jErr').textContent.includes('동의')`)&&(await calls())==='');
  await ev(`$('jAgree').querySelector('[data-all]').click();$('jGo').click();await new Promise(r=>setTimeout(r,500))`);
  is('동의 → 교회 들어가기 순서',(await calls())==='agree_terms,join_church');
  await shot('3-join.png');
  await ev(`$('jMake').click()`);is('초대 코드 화면에서 무료 시작으로',await ev(`return ${vis('gFree')}`));
  // 4) 초대 링크로 온 사람은 바로 코드 넣기
  await ev(`store.set('joinCode','XYZXYZXY')`);await fake();await ev(`await afterLogin(U)`);
  is('초대 링크로 오면 바로 교회에 들어가기 (코드 채움)',await ev(`return ${vis('gJoin')}&&$('jCode').value==='XYZXYZXY'`));
  await ev(`store.set('joinCode',null)`);
  // 5) 다른 카카오 계정으로 = 로그아웃
  await fake();await ev(`await afterLogin(U);$('jOut').click();await new Promise(r=>setTimeout(r,300))`);
  is('다른 카카오 계정으로 → 로그아웃하고 첫 화면',await ev(`return OUT===1&&${vis('gStart')}&&${vis('gvl')}`));
  // 6) 이미 쓰던 사람: 동의 안 했으면 창
  const member=[{name:'옛팀원',church_id:'c1',role:'member'}];
  await fake({ms:member,agreed:false});ev(`await afterLogin(U)`).catch(()=>{});
  is('이미 쓰던 사람도 동의 전이면 동의 창',await until(`$('agDlg').open`,5000));
  await shot('4-agree.png');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},S);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},S);await z(300);
  is('Esc로 닫히지 않음',await ev(`return $('agDlg').open`));
  await ev(`$('agGo').click();await new Promise(r=>setTimeout(r,200))`);
  is('체크 없이 누르면 막음',await ev(`return $('agDlg').open&&$('agErr').textContent.includes('동의')&&!CALLS.some(c=>c[0]==='agree_terms')`));
  await ev(`$('agNo').click();await new Promise(r=>setTimeout(r,400))`);
  is('동의하지 않으면 로그아웃하고 첫 화면',await ev(`return !$('agDlg').open&&OUT===1&&${vis('gStart')}`));
  await fake({ms:member,agreed:false});ev(`await afterLogin(U)`).catch(()=>{});await until(`$('agDlg').open`,5000);
  is('다시 열면 체크가 비어 있음',await ev(`return [...$('agBox').querySelectorAll('input')].every(x=>!x.checked)`));
  await ev(`$('agBox').querySelector('[data-all]').click();$('agGo').click();await new Promise(r=>setTimeout(r,400))`);
  is('동의하면 창이 닫히고 계속',await ev(`return !$('agDlg').open&&CALLS.some(c=>c[0]==='agree_terms'&&c[1].p_ver===1)&&OUT===0`));
  // 7) 이미 동의한 사람 · 14단계 전 서버
  for(const [a,nm] of [[true,'이미 동의한 사람은 창이 안 뜸'],['missing','서버에 동의 기능이 아직 없으면 묻지 않음']]){
    await send('Page.navigate',{url:base},S);await until(`document.readyState==='complete'&&typeof afterLogin==='function'`);await z(800);
    await fake({ms:member,agreed:a});ev(`await afterLogin(U)`).catch(()=>{});await z(800);
    is(nm,await ev(`return !$('agDlg').open&&CALLS[0][0]==='agreed'`));}
  // 8) 휴대폰 폭
  await send('Page.navigate',{url:base},S);await until(`document.readyState==='complete'&&typeof afterLogin==='function'`);await z(800);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true},S);await z(300);
  await fake();await ev(`await afterLogin(U)`);await z(300);
  is('휴대폰 폭: 카드가 위아래로, 옆으로 안 넘침',await ev(`const a=$('pkFree').getBoundingClientRect(),b=$('pkCode').getBoundingClientRect();return b.top>=a.bottom&&a.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth`));
  await shot('5-phone-pick.png');
  await ev(`$('pkFree').click()`);await z(200);
  is('휴대폰 폭: 무료 시작 화면도 안 넘침',await ev(`return document.documentElement.scrollWidth<=innerWidth&&$('gfAgree').getBoundingClientRect().right<=innerWidth`));
  await shot('6-phone-free.png');
  is('코드 오류 없음',!errs.filter(e=>!/fetch|network|invalid|Failed/i.test(e)).length);if(errs.length)console.log(errs.slice(0,3).map(e=>e.slice(0,200)));
}catch(e){bad++;console.log('멈춤',e.message);}
console.log(`통과 ${ok} · 실패 ${bad}`);ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(bad?1:0);
