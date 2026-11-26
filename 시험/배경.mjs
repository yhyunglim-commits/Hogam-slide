// 배경 보관함 시험: node 시험/배경.mjs  (크롬만 있으면 돼요. 실제 서버에는 붙지 않아요)
import http from 'http';import fs from 'fs';import os from 'os';import path from 'path';import {spawn} from 'child_process';import {fileURLToPath} from 'url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT=process.env.SHOT,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-bg-')),z=ms=>new Promise(r=>setTimeout(r,ms));
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
  await ev(`INFO=[{id:'a1',k:'cover',title:'감사주일',band:'주일예배',time:'11시',note:'작은글 하나\\n작은글 둘'},{id:'a2',k:'notice',body:'기도\\n홍길동 장로',note:'작은 안내\\n둘째 줄'},{id:'a3',k:'ad',title:'광고제목',body:'광고 내용입니다\\n둘째 줄'},{id:'a4',k:'sermon',title:'설교제목',sub:'부제목',who:'홍길동 목사',ref:'요 3:16'},{id:'a5',k:'text',title:'고백문',body:'전능하사 천지를\\n만드신'}];LOOK.quote.quoteStyle='body';renderInfoList();setPage('slides')`);await z(1200);
  await ev(`window.W=ms=>new Promise(r=>setTimeout(r,ms));const w=$('outText');w.value='만복의 근원 하나님\\n온 백성 찬송 드리고 //\\n\\n\\n곧 오소서\\n임마누엘 //\\n[빈 화면] //';w.dispatchEvent(new Event('input',{bubbles:true}));$('docTitle').value='11월 29일 주일예배';saveSession();await W(900);
    window.px=(s,si)=>{const c=document.createElement('canvas');c.width=480;c.height=270;drawScreen(c,s,si||0);const x=c.getContext('2d');return[...x.getImageData(3,3,1,1).data].join()+'|'+[...x.getImageData(470,200,1,1).data].join()+'|'+[...x.getImageData(20,250,1,1).data].join()};
    window.items=()=>songGroups().flatMap(g=>g.items.map(s=>({s,si:g.songIdx||0,k:bgKind(s),t:g.title})));window.all=()=>items().map(o=>px(o.s,o.si));window.gr=t=>songGroups().find(g=>g.title===t)`);
  const org=await ev(`return all()`),meta=await ev(`return items().map(o=>({k:o.k,t:o.t,blank:!!o.s.blank}))`),T2=meta.findIndex(m=>m.t==='곧 오소서');
  is('곡 두 개·빈 화면이 있음',T2>0&&meta.some(m=>m.blank));
  const L=JSON.parse(fs.readFileSync(path.join(ROOT,'brand/bg/list.json'))),cats={};for(const o of L)cats[o.cat]=(cats[o.cat]||0)+1;
  is(`그림 ${L.length}장 · 파일이 다 있고 남는 파일 없음`,fs.readdirSync(path.join(ROOT,'brand/bg')).filter(f=>f.endsWith('.webp')).length===L.length*2&&L.every(o=>['','-s'].every(x=>fs.existsSync(path.join(ROOT,'brand/bg',o.id+x+'.webp')))));
  // 절기 추천
  const sug=d=>ev(`const t=$('docTitle').value;$('docTitle').value='${d}';const r=bgSuggest(bgDate(new Date(2026,10,25))).map(x=>x.n);$('docTitle').value=t;return r`);
  const ds=d=>ev(`return bgSuggest(new Date(${d})).map(x=>x.n)`);
  is('11월 29일 → 대림절 먼저, 다음 성탄절',JSON.stringify(await sug('11월 29일 주일예배')).startsWith('["대림절","성탄절"'));
  is('1월 3일 → 다음 해의 새해',(await sug('1월 3일 주일예배'))[0]==='새해'||(await sug('1월 3일 주일예배')).slice(0,2).includes('새해'));
  is('부활절 날짜 (2026-04-05 · 2027-03-28 · 2028-04-16)',await ev(`return [2026,2027,2028].map(y=>{const e=easterOf(y);return (e.getMonth()+1)+'/'+e.getDate()}).join()==='4/5,3/28,4/16'`));
  is('대림절 첫 주일 (2026-11-29 · 2027-11-28 · 2028-12-03)',await ev(`return [2026,2027,2028].map(y=>{const e=churchDays(y).find(x=>x[0]==='대림절')[1];return (e.getMonth()+1)+'/'+e.getDate()}).join()==='11/29,11/28,12/3'`));
  is('절기 추천: 사순·부활·성령강림·맥추·추수·여름',(await ds('2027,2,21'))[0]==='사순절'&&(await ds('2027,2,28'))[0]==='부활절'&&(await ds('2027,4,16'))[0]==='성령강림절'&&(await ds('2027,6,4'))[0]==='감사절'&&(await ds('2026,10,15'))[0]==='감사절'&&(await ds('2027,7,8')).includes('여름')&&(await ds('2027,0,10')).includes('겨울'));
  is('어느 날이든 추천이 비지 않음',await ev(`await bgOpen(gr('곧 오소서'));await W(500);const t=$('docTitle').value;let r=true;for(const d of ['1월 10일','4월 4일','5월 16일','7월 4일','11월 15일','9월 5일']){$('docTitle').value=d+' 주일예배';bgTab='추천';bgList();r=r&&$('bgList').querySelectorAll('[data-b]').length>3}$('docTitle').value=t;$('bgDlg').close();return r`));
  is('모든 그림이 어느 탭에든 나옴',await ev(`await bgOpen(gr('곧 오소서'));await W(500);const seen=new Set();for(const t of ['절기','계절','자연·질감']){bgTab=t;bgList();$('bgList').querySelectorAll('[data-b]').forEach(b=>seen.add(b.dataset.b))}$('bgDlg').close();return seen.size===BGL.length`));
  is('밝은 사진을 고르면 어둡게 값이 같이 들어감',await ev(`await bgOpen(gr('곧 오소서'));await W(400);bgTab='자연·질감';bgList();const o=BGL.find(x=>x.d>=20&&x.cat==='빛과 색');$('bgList').querySelector('[data-b='+o.id+']').click();const r=bgDim===o.d;$('bgDlg').close();return r`));
  // 창
  await ev(`await bgOpen(gr('곧 오소서'))`);await z(900);await shot('1-open.png',S);
  is('창이 열리고 대림절 그림이 먼저',await ev(`return $('bgDlg').open&&$('bgList').querySelector('[data-b]').dataset.b.startsWith('advent')`));
  is('고르기 전엔 화면이 그대로',JSON.stringify(await ev(`return all()`))===JSON.stringify(org));
  await ev(`$('bgList').querySelector('[data-b=advent-5]').click()`);await until(`BGI['advent-5']?.img`);await z(300);await shot('2-pick.png',S);
  is('미리보기만 바뀌고 예배는 그대로',await ev(`const c=$('bgPv').getContext('2d').getImageData(500,300,1,1).data;return c[3]===255&&!Object.keys(SBG).length`)&&JSON.stringify(await ev(`return all()`))===JSON.stringify(org));
  await ev(`$('bgGo').click()`);await z(500);let now=await ev(`return all()`);
  is('이 곡만: 그 곡(빈 화면도)만 바뀜',now.every((v,i)=>(v!==org[i])===(meta[i].t==='곧 오소서')));
  is('묶음 머리줄에 이번 예배 배경',await ev(`setPage('slides');await W(700);return $('shots').textContent.includes('이번 예배 배경')&&!$('shots').querySelector('.bgopen')`));await shot('3-slides.png',S);
  const pick=(id,scope,g='곧 오소서',d=0)=>ev(`await bgOpen(gr('${g}'));bgSel='${id}';bgDim=${d};bgScope='${scope}';await bgLoad('${id}');bgView();$('bgGo').click();await W(400);return all()`);
  now=await pick('sky-4','song');is('찬양 전체: 찬양만 바뀌고 따로 정한 곡도 같이',now.every((v,i)=>(v!==org[i])===(meta[i].k==='song'))&&await ev(`return Object.keys(SBG).join()==='song'`));
  const before=JSON.stringify(now);now=await pick('nature-1','all','만복의 근원 하나님',30);is('예배 전체: 모두 바뀜',now.every((v,i)=>v!==org[i]));
  await ev(`$('toast').querySelector('.tundo').click()`);await z(400);is('되돌리기',JSON.stringify(await ev(`return all()`))===before);
  is('어둡게가 먹음',(await pick('nature-1','all','만복의 근원 하나님',0))[0]!==now[0]);
  const A=await ev(`return all()`);
  await ev(`lookTab='song';lookSlideKey=null;lookScope='all';buildLookUI();setRib('bg')`);await z(400);await shot('0-rib.png',S);
  is('배경 창에서 보관함이 열림 (찬양 전체부터)',await ev(`const b=$('lookCtl').querySelector('[data-ins=bg]'),r=b.getBoundingClientRect();b.click();await W(500);const ok=r.width>0&&$('bgDlg').open&&bgScope==='song'&&!ribOpen;$('bgDlg').close();return ok`));
  is('슬라이드를 고르고 열면 그 곡부터',await ev(`lookSlideKey=gr('곧 오소서').items[0].ovKey;buildLookUI();setRib('bg');$('lookCtl').querySelector('[data-ins=bg]').click();await W(400);const ok=bgScope==='this'&&bgPages[bgPi].g.title==='곧 오소서';$('bgDlg').close();lookSlideKey=null;buildLookUI();return ok`));
  is('말씀·순서 탭에서도 열림',await ev(`const r=[];for(const t of ['word','info']){lookTab=t;buildLookUI();setRib('bg');$('lookCtl').querySelector('[data-ins=bg]').click();await W(300);r.push(bgScope===t&&bgKind(bgPages[bgPi].s)===t);$('bgDlg').close()}lookTab='song';buildLookUI();return r.every(Boolean)`));
  // 저장 · 다른 예배
  const id1=await ev(`return curSess`),txt=await ev(`return curS().text`);
  is('예배 글에 번호만 적힘 (그림이 안 들어감)',txt.includes('"k":"bg"')&&!txt.includes('data:image')&&txt.length<3000);
  is('교회 설정은 안 바뀜',await ev(`return Object.values(MEDIA).every(v=>!v)`));
  is('옛 화면이 읽어도 이상한 글이 안 생김',await ev(`const sp=splitCombined(curS().text);return !JSON.stringify(sp).includes('"bg"')&&!sp.song.includes('〔')`));
  await ev(`newSessClick();$('outText').value='만복의 근원 하나님\\n온 백성 찬송 드리고 //';$('outText').dispatchEvent(new Event('input',{bubbles:true}));await W(700);saveSession()`);
  is('다른 예배는 그대로 (같은 곡인데 원래 배경)',(await ev(`return all()`))[0]===org[0]);
  await ev(`loadSession('${id1}');await W(600)`);is('돌아오면 그 배경 그대로',JSON.stringify(await ev(`return all()`))===JSON.stringify(A));
  await open();await ev(`window.W=ms=>new Promise(r=>setTimeout(r,ms));window.px=(s,si)=>{const c=document.createElement('canvas');c.width=480;c.height=270;drawScreen(c,s,si||0);const x=c.getContext('2d');return[...x.getImageData(3,3,1,1).data].join()+'|'+[...x.getImageData(470,200,1,1).data].join()+'|'+[...x.getImageData(20,250,1,1).data].join()};window.items=()=>songGroups().flatMap(g=>g.items.map(s=>({s,si:g.songIdx||0})));window.all=()=>items().map(o=>px(o.s,o.si));window.gr=t=>songGroups().find(g=>g.title===t);all();await bgReady();await W(500)`);
  is('새로고침해도 그대로 (색 오차 1까지)',await (async()=>{const B=await ev(`return all()`),f=v=>v.split(/[,|]/).map(Number);return B.length===A.length&&B.every((v,i)=>f(v).every((q,k)=>Math.abs(q-f(A[i])[k])<=1));})());
  // 내려받기 · 송출이 미리보기와 같은지 (그림을 안 받아 둔 채로 바로)
  const near=`const D=async(b,s,si)=>{const m=await createImageBitmap(b),a=document.createElement('canvas'),c=document.createElement('canvas');a.width=c.width=480;a.height=c.height=270;a.getContext('2d').drawImage(m,0,0,480,270);const t=document.createElement('canvas');t.width=1920;t.height=1080;drawScreen(t,s,si);c.getContext('2d').drawImage(t,0,0,480,270);const p=a.getContext('2d').getImageData(0,0,480,270).data,q=c.getContext('2d').getImageData(0,0,480,270).data;let d=0;for(let i=0;i<p.length;i++)d+=Math.abs(p[i]-q[i]);return d/p.length};`;
  const J=await ev(`${near}for(const k in BGI)delete BGI[k];let got=null;const o=makePdf;makePdf=async j=>{got=j;return new Blob(['x'])};const s0=saveBlob;saveBlob=async()=>{};await $('dlPdf').onclick();makePdf=o;saveBlob=s0;const it=items(),r=[];for(let i=0;i<it.length;i++)r.push(await D(got[i],it[i].s,it[i].si));return r`);
  is('내려받기(PDF 그림)가 미리보기와 같음 '+J.map(v=>v.toFixed(1)),J.length>3&&J.every(v=>v<3));
  const Lv=await ev(`${near}for(const k in BGI)delete BGI[k];const b=await liveBake();const it=items(),r=[];for(let i=0;i<it.length;i++)r.push(await D(b.slides[i].full,it[i].s,it[i].si));return r`);
  is('송출 그림이 미리보기와 같음 '+Lv.map(v=>v.toFixed(1)),Lv.length>3&&Lv.every(v=>v<3));
  is('투명 그림에는 배경이 안 남음',await ev(`DM.k='png';const c=document.createElement('canvas');c.width=480;c.height=270;dmDraw(c,dmRows()[0]);return c.getContext('2d').getImageData(3,3,1,1).data[3]===0`));
  is('송출: 배경을 바꾸면 달라진 걸 앎',await ev(`const a=liveSig(),k=SBG;SBG={};const r=liveSig()!==a;SBG=k;return r`));
  // 우리 교회 사진 (팀 서버 흉내)
  await ev(`window.DB={};window.Q=[];window.libs=()=>Object.keys(DB).filter(k=>k.startsWith('media.lib'));window.libN=()=>libs().reduce((a,k)=>a+JSON.stringify(DB[k]).length,0);const E=f=>{const o={_k:null,_like:null,_in:null,select(){o.m='s';return o},upsert(r){o.m='u';o.r=r;return o},delete(){o.m='d';return o},eq(a,b){o._k=b;return o},like(a,b){o._like=b.replace('%','');return o},in(a,b){o._in=b;return o},maybeSingle(){o.one=1;return o},then(ok){let d=null;Q.push([o.m,o._k||o._like||(o.r&&o.r.key)]);if(o.m==='u'){if(window.FULL)return ok({error:{message:'교회 저장 공간이 다 찼어요.'}});DB[o.r.key]=o.r.value}else if(o.m==='d')delete DB[o._k];else if(o.one)d=DB[o._k]!==undefined?{value:DB[o._k]}:null;else d=Object.keys(DB).filter(k=>o._like?k.startsWith(o._like):o._in?o._in.includes(k):true).map(k=>({key:k,value:DB[k]}));return ok({data:d,error:null})}};return o};window.keepFrom=sb.from;sb.from=E;sb.rpc=async()=>({data:{mb_limit:50,bytes:JSON.stringify(DB).length}});me=me||{name:'시험',church:'test-church'};pushSession=()=>{};confirm=()=>true;
    window.file=()=>new Promise(r=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const x=c.getContext('2d');for(let i=0;i<300;i++){x.fillStyle='hsl('+i*7+',60%,40%)';x.fillRect(Math.random()*1600,Math.random()*900,90,90)}c.toBlob(b=>r(new File([b],'우리 예배당.jpg',{type:'image/jpeg'})),'image/jpeg',.9)})`);
  await ev(`await bgOpen(gr('곧 오소서'));bgTab='우리 교회';bgList();await bgPick(await file())`);await z(300);await shot('4-up.png',S);
  is('올리기 전에 크기와 남은 용량을 보여 줌',await ev(`const t=$('bgList').querySelector('.bgup').textContent;return t.includes('남은 용량')&&/KB|MB/.test(t)&&!libs().length`));
  const u0=await ev(`return libN()`);await ev(`$('bgList').querySelector('.bgup .pri').click()`);await until(`BGC.length===1`);await z(500);
  const u1=await ev(`return libN()`);is(`올리면 교회 자료가 늘어남 (${Math.round((u1-u0)/1024)}KB)`,u1-u0>20000&&await ev(`return libs().length===2`));
  const cid=await ev(`return BGC[0].id`);now=await ev(`await bgLoad('${cid}');bgSel='${cid}';bgScope='this';bgView();$('bgGo').click();await W(400);return all()`);is('올린 사진을 이 곡에 씀',now.some((v,i)=>v!==A[i])&&await ev(`return SBG['g:곧 오소서'].b==='${cid}'`));
  is('다시 열 때 큰 사진은 안 받음',await ev(`Q.length=0;await bootTeam();await bgOpen(gr('곧 오소서'));await W(300);return !Q.some(q=>q[0]==='s'&&String(q[1]).startsWith('media.lib.'))`));
  await ev(`bgTab='우리 교회';bgList()`);await z(300);await shot('5-mine.png',S);
  await ev(`await bgDel(BGC[0]);await W(400)`);is('지우면 자료가 줄고 원래 배경으로',await ev(`return libN()`)===u0&&await ev(`const i=items().findIndex(o=>o.s.songKey==='곧 오소서');const k=SBG;const a=all()[i];SBG={};const b=all()[i];SBG=k;return a===b`));
  await ev(`window.FULL=1;bgTab='우리 교회';bgList();await bgPick(await file());$('bgList').querySelector('.bgup .pri').click();await W(600)`);is('서버가 용량을 막으면 안 올라가고 알려 줌',await ev(`return !libs().length&&$('toast').textContent.includes('저장 공간')`));
  await ev(`sb.rpc=async()=>({data:{mb_limit:1,bytes:1048000}});bgList();await bgPick(await file())`);is('모자라면 올리기 전에 알려 줌',await ev(`return $('toast').textContent.includes('모자라요')`));
  is('기본 배경은 교회 자료가 안 늘어남',await ev(`window.FULL=0;$('bgDlg').close();Q.length=0;await bgOpen(gr('곧 오소서'));bgSel='lent-5';bgScope='all';bgView();$('bgGo').click();await W(500);return !Q.some(q=>q[0]==='u'&&String(q[1]).startsWith('media'))&&!libs().length`));
  is('원래 배경으로',await ev(`await bgOpen(gr('곧 오소서'));bgScope='all';bgView();$('bgOff').click();await W(400);return !Object.keys(SBG).length&&!curS().text.includes('"k":"bg"')`)&&(await ev(`return all()`))[0]===org[0]);
  is('이상한 저장 글이 와도 안 깨짐',await ev(`return Object.keys(textBg('〔순서〕 {"k":"bg","v":{"song":{"b":"../../x"},"g:a":{"b":"advent-5","d":999},"z":1}}')).join()==='g:a'&&Object.keys(textBg('〔순서〕 {"k":"bg","v":null}')).length===0`));
  await ev(`document.documentElement.dataset.theme='light';await bgOpen(gr('곧 오소서'));bgTab='절기';bgList()`);await z(900);await shot('6-light.png',S);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},S);await z(500);await shot('7-phone.png',S);is('휴대폰 폭에서 창이 안 넘침',await ev(`const r=$('bgDlg').getBoundingClientRect();return r.right<=innerWidth&&$('bgDlg').scrollWidth<=$('bgDlg').clientWidth+1`));
  is('코드 오류 없음',!errs.filter(e=>!/fetch|network|invalid|Failed/i.test(e)).length);if(errs.length)console.log(errs.slice(0,3).map(e=>e.slice(0,200)));
}catch(e){bad++;console.log('멈춤',e.message);}
console.log(`통과 ${ok} · 실패 ${bad}`);ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(bad?1:0);
