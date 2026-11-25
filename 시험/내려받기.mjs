// 다른 형식 내려받기 시험: node 시험/내려받기.mjs  (크롬만 있으면 돼요. 실제 서버에는 붙지 않아요)
import http from 'http';import fs from 'fs';import os from 'os';import path from 'path';import {spawn,spawnSync} from 'child_process';import {fileURLToPath} from 'url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT=process.env.SHOT,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-down-')),z=ms=>new Promise(r=>setTimeout(r,ms));
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
  // 실제로 만들어지는 파일을 받아 이쪽(노드·맥)에서 열어 봐요
  const make=async o=>{const r=await ev(`Object.assign(DM,{k:'txt',enc:'utf8',sep:'blank',mark:'---',n:'0',title:true,blank:false},${JSON.stringify(o)});const f=await dmMake();const u=new Uint8Array(await f.blob.arrayBuffer());let b='';for(let i=0;i<u.length;i+=32768)b+=String.fromCharCode(...u.subarray(i,i+32768));return{name:f.name,b:btoa(b)}`);return{name:r.name,buf:Buffer.from(r.b,'base64')};};
  const unzip=f=>{const z=path.join(tmp,'a.zip'),d=fs.mkdtempSync(path.join(tmp,'z-'));fs.writeFileSync(z,f.buf);const t=spawnSync('python3',['-I','-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;z.extractall(sys.argv[2]);print("\\n".join(z.namelist()))',z,d]);if(t.status)throw new Error('ZIP '+t.stderr);return t.stdout.toString().trim().split('\n').map(x=>path.join(d,x));};
  await ev(`INFO[2].body+=' 🙏';const w=$('outText');w.value='만복의 근원 하나님\\n온 백성 찬송 드리고 //\\n[빈 화면] //\\n만복의 근원 하나님\\n저 천사여 찬송하세\\n찬송 성부 성자 성령 //';w.dispatchEvent(new Event('input',{bubbles:true}));LOOK.quote.quoteStyle='caption'`);await z(1200);
  const all=await ev(`return songGroups().flatMap(g=>g.items).map(s=>({blank:!!s.blank,first:(s.lines||[])[0]||''}))`),real=all.filter(x=>!x.blank);
  is(`빈 화면이 하나 들어 있음 (모두 ${all.length}장)`,all.length-real.length===1);
  const raw=await make({}),txt=raw.buf.toString('utf8'),parts=t=>t.replace(/^﻿/,'').trim().split('\r\n\r\n');
  is('UTF-8 TXT: 첫 표시 · 윈도우 줄바꿈',raw.buf[0]===0xEF&&!/[^\r]\n/.test(txt));
  is('TXT 화면 수가 앱과 같음',parts(txt).length===real.length);
  let at=-1;is('TXT 순서가 앱과 같음',real.every(x=>{if(!x.first)return true;const k=txt.indexOf(x.first.replace(/\*\*/g,'').trim(),at+1);const r=k>at;at=k;return r;}));
  is('빈 화면 넣기: 기호로 나누면 화면 수가 앱과 같음',(await make({sep:'mark',mark:'###',blank:true})).buf.toString('utf8').split('###').length===all.length);
  const one=parts((await make({n:'1',title:false})).buf.toString('utf8'));is('최대 1줄: 화면마다 한 줄 · 글은 그대로',one.every(p=>!p.includes('\n'))&&one.join('').length===parts((await make({title:false})).buf.toString('utf8')).join('').replace(/\r\n/g,'').length);
  is('줄 수를 바꿔도 앱 화면은 그대로',await ev(`return songGroups().flatMap(g=>g.items).length`)===all.length);
  const kr=(await make({enc:'cp949'})).buf,dec=new TextDecoder('euc-kr').decode(kr);is('옛 윈도우 한글: 안 깨지고 이모지만 ?',dec===txt.replace(/^﻿/,'').replace(/🙏/gu,'?'));
  is('윈도우 글자 똠·햏도 들어감',await ev(`DM.enc='cp949';return new TextDecoder('euc-kr').decode(dmEncode('똠방각하 햏')).trim()==='똠방각하 햏'`));
  const csv=(await make({k:'csv'})).buf;const cf=path.join(tmp,'a.csv');fs.writeFileSync(cf,csv);const rd=spawnSync('python3',['-I','-c','import csv,sys,json;print(json.dumps(list(csv.reader(open(sys.argv[1],encoding="utf-8-sig",newline="")))))',cf]);const tb=JSON.parse(rd.stdout);
  is('CSV: 4칸 · 화면 수가 앱과 같음',tb.every(r=>r.length===4)&&tb.length===real.length+1);
  const diff=(a,b)=>ev(`const L=async t=>{const b=Uint8Array.from(atob(t),c=>c.charCodeAt(0)),m=await createImageBitmap(new Blob([b])),c=document.createElement('canvas');c.width=m.width;c.height=m.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(m,0,0);return x.getImageData(0,0,c.width,c.height).data};const p=await L('${fs.readFileSync(a).toString('base64')}'),q=await L('${fs.readFileSync(b).toString('base64')}');let mx=0,n=0;for(let i=3;i<p.length;i+=4){const d=Math.abs(p[i]-q[i]);if(d>mx)mx=d;if(d>6)n++;}return{mx,n}`);
  const alpha=f=>ev(`const b=Uint8Array.from(atob('${fs.readFileSync(f).toString('base64')}'),c=>c.charCodeAt(0)),m=await createImageBitmap(new Blob([b])),c=document.createElement('canvas');c.width=m.width;c.height=m.height;const x=c.getContext('2d');x.drawImage(m,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let on=0;for(let i=3;i<d.length;i+=4)if(d[i])on++;return{w:c.width,h:c.height,p:[...d.slice(0,4)].join(),on,all:d.length/4}`);
  // 배경 사진을 넣고도 안 남는지
  await ev(`const c=document.createElement('canvas');c.width=160;c.height=90;c.getContext('2d').fillStyle='#964';c.getContext('2d').fillRect(0,0,160,90);MEDIA.song=MEDIA.info=c.toDataURL();mediaImg('song');mediaImg('info')`);await z(800);
  const png=unzip(await make({k:'png'}));is('투명 PNG 장수',png.length===real.length);const A=[];for(const f of png)A.push(await alpha(f));
  is('투명 PNG: 모서리가 비고 글자는 있음 (모든 화면, 1920×1080)',A.every(a=>a.w===1920&&a.h===1080&&a.p==='0,0,0,0'&&a.on>500&&a.on<a.all*.95));if(!A.every(a=>a.p==='0,0,0,0'&&a.on>500&&a.on<a.all*.95))console.log(A.map((a,i)=>path.basename(png[i])+' '+a.p+' '+a.on));
  const gr=unzip(await make({k:'green',blank:true})),G=[];for(const f of gr)G.push(await alpha(f));is('초록 PNG: 모서리가 초록이고 투명한 곳 없음 (빈 화면도)',gr.length===all.length&&G.every(a=>a.p==='0,177,64,255'&&a.on===a.all));
  const t0=Date.now(),tf=await make({k:'tga'}),tga=unzip(tf);console.log(`  TGA ${tga.length}장 ${Date.now()-t0}ms, ZIP ${(tf.buf.length/1e6).toFixed(1)}MB`);
  is('TGA: 장수 · 크기',tga.length===real.length&&tga.every(f=>fs.statSync(f).size===18+1920*1080*4));
  let same=0;for(let i=0;i<tga.length;i++){const out=path.join(tmp,'t.png');if(spawnSync('sips',['-s','format','png',tga[i],'--out',out]).status)break;const a=await alpha(out),d=await diff(out,png[i]);if(d.n)console.log('  ',path.basename(tga[i]),JSON.stringify(d));if(a.p==='0,0,0,0'&&d.n===0)same++;}
  is('맥이 TGA를 열고, 투명한 자리가 PNG와 같음',same===tga.length);
  // 창
  await ev(`MEDIA.song=MEDIA.info=null;setPage('slides')`);await z(700);
  is('폭 1440에서 단추가 다 보임',await ev(`const r=$('dlMore').getBoundingClientRect();return r.width>0&&r.right<=innerWidth`));await shot('0-bar.png',S);
  await ev(`Object.assign(DM,{k:'txt',enc:'cp949',sep:'blank',n:'0',title:true,blank:false});$('dlMore').click()`);await z(400);await shot('1-txt.png',S);
  is('없는 글자를 알려 주고 바꿔 줌',await ev(`const w=document.querySelector('.dmwarn'),r=w.textContent.includes('🙏');w.querySelector('button').click();return r&&DM.enc==='utf8'&&!document.querySelector('.dmwarn')`));
  for(const k of ['png','tga','green','csv']){await ev(`document.querySelector('#dmKinds [data-k=${k}]').click()`);await z(400);await shot('2-'+k+'.png',S);}
  is('내려받기를 누르면 파일이 나가고 창이 닫힘',await ev(`let n='';const o=saveBlob;saveBlob=async a=>{n=a};await $('dmGo').onclick();saveBlob=o;return n.endsWith('.csv')&&!$('dmDlg').open`));
  is('고른 화면만 나감',await ev(`selKeys.add(shotKey(allShots()[0]));DM.k='txt';const r=dmRows().length===1;selKeys.clear();return r`));
  await ev(`document.documentElement.dataset.theme='dark';$('dlMore').click()`);await z(400);await shot('3-dark.png',S);await ev(`$('dmDlg').close();delete document.documentElement.dataset.theme`);
  // 첫 화면
  for(const[w,h]of[[1440,900],[390,844]]){await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<500},S);await ev(`$('gate').classList.add('on');document.querySelector('.gvl-out').scrollIntoView({block:'center'})`);await z(700);
    is(`첫 화면 파일 아이콘 6개 (폭 ${w})`,await ev(`const l=[...document.querySelectorAll('.gvl-out li')];return l.length===6&&l.every(x=>x.getBoundingClientRect().right<=innerWidth)`));await shot('4-gate'+w+'.png',S);}
  is('코드 오류 없음',!errs.filter(e=>!/fetch|network|invalid|Failed/i.test(e)).length);if(errs.length)console.log(errs.slice(0,3).map(e=>e.slice(0,200)));
}catch(e){bad++;console.log('멈춤',e.message);}
console.log(`통과 ${ok} · 실패 ${bad}`);ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(bad?1:0);
