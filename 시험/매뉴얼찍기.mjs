// 호감 매뉴얼 캡처: node 시험/매뉴얼찍기.mjs brand/manual  (화면이 바뀌면 다시 돌려요. 실제 서버에는 붙지 않아요)
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
const DIR=process.argv[2];if(!DIR)throw new Error('저장할 폴더를 적어 주세요');fs.mkdirSync(DIR,{recursive:true});
const M=[];
// 캡처 한 장 = 한 단계: 누를 곳(mark)을 가운데 두고 늘 16:10으로 잘라요. w는 보일 폭, center는 가운데 둘 곳
async function cap(topic,text,mark,w=560,center=mark){
  const h=w*10/16,r=await ev(`const q=x=>[...document.querySelectorAll(x)].map(e=>e.getBoundingClientRect()).find(r=>r.width&&r.height),m=q(${JSON.stringify(mark)}),o=q(${JSON.stringify(center)});if(!m||!o)return null;
    const at=(c,n,max)=>Math.max(0,Math.min(max-n,c-n/2)),x=at(o.left+o.width/2,${w},innerWidth),y=at(o.top+o.height/2,${h},innerHeight);
    return{x,y,m:{x:(m.left-x)/${w}*100,y:(m.top-y)/${h}*100,w:m.width/${w}*100,h:m.height/${h}*100}}`);
  if(!r){console.log('못 찍음',topic,text);process.exitCode=1;return;}
  const f=`${topic}-${M.filter(x=>x.topic===topic).length+1}.webp`;
  fs.writeFileSync(path.join(DIR,f),Buffer.from((await send('Page.captureScreenshot',{format:'webp',quality:82,clip:{x:r.x,y:r.y,width:w,height:h,scale:Math.min(1.4,700/w)}},S)).result.data,'base64'));
  M.push({topic,text,f,m:r.m});console.log(f,text);}
try{
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:680,deviceScaleFactor:1.5,mobile:false},S);
  await send('Page.navigate',{url:base},S);await z(2500);await ev(`sessionStorage.setItem('cj_church','manual');localStorage.setItem('cj_theme','"light"')`);await open();
  await ev(`const g=$('gate'),h=()=>g.classList.remove('on');h();new MutationObserver(h).observe(g,{attributes:true,attributeFilter:['class']});document.documentElement.dataset.theme='light';$('toast').style.display='none';for(const k of ['song','word','info'])if(LOOK[k]){LOOK[k].footer='';LOOK[k].footerOn=false;}setPage('song')`);await z(900);
  // 예배 준비
  await ev(`$('contiOff').checked=false;openStart()`);await z(700);
  await cap('plan','사진이나 글을 넣어요','#contiCardImg',1060,'#contibox .lcard');
  await ev(`setContiMode('form');CF=[{t:'cover',v:'주일 예배'},{t:'song',v:'만복의 근원 하나님'},{t:'notice',l:'대표기도',v:'○○○ 장로'},{t:'word',v:'요한복음 3:16'},{t:'sermon',v:'세상을 사랑하신 하나님',w:'○○○ 목사'}];renderCF()`);await z(600);
  await cap('plan','읽은 순서를 확인해요','#cfList',1060,'#contibox .lcard');
  await cap('plan','다음을 눌러요','#cfNext',1060,'#contibox .lcard');
  await ev(`$('cfNext').click()`);await z(1800);
  await cap('plan','넣기를 눌러요','#contiApply',1060,'#contibox .lcard');
  await ev(`$('contiClose').click();$('contibox').classList.remove('on','start');document.body.classList.remove('starting')`);await z(400);
  // 찬양
  await cap('song','악보를 올려요','#drop');
  await ev(`const SEC=[{label:'1절',slides:[['만복의 근원 하나님','온 백성 찬송 드리고'],['저 천사여 찬송하세','찬송 성부 성자 성령']]}];const s=newSong({mode:'text',text:'만복의 근원 하나님\\n온 백성 찬송 드리고\\n저 천사여 찬송하세\\n찬송 성부 성자 성령'});s.title='만복의 근원 하나님';s.result={title:s.title,linesUsed:2,charsUsed:17,sections:SEC};s.status='done';songs.push(s);renderSongs();$('convStatus').textContent=''`);await z(900);
  await cap('song','찬양 자막에 넣기를 눌러요','#convertBtn');
  await ev(`$('convertBtn').click()`);await z(3000);
  await cap('song','한 화면 줄 수를 맞춰요','#outLines',560,'#resPanel .rbar');
  await cap('song','맞춤법을 검사해요','#checkBtn',560,'#resPanel .rbar');
  // 말씀
  await ev(`setPage('word');setWordTab('body')`);await z(900);await ev(`const set=(i,v)=>{const e=$(i);e.value=v;e.onchange&&e.onchange()};set('bBook','요한복음');set('bChap','3');set('bV1','16');set('bV2','17')`);await z(400);
  await cap('word','책과 장, 절을 골라요','#bBook');
  await ev(`wTidyRaw('16 하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니\\n17 하나님이 그 아들을 세상에 보내신 것은')`);await z(1500);
  await cap('word','본문을 붙여 넣으면 자막이 돼요','#wEd');
  await cap('word','한 줄 글자 수를 맞춰요','#wMan');
  await cap('word','참고 구절도 넣어요','[data-wadd=q]');
  // 순서·광고
  await ev(`setPage('info')`);await z(900);
  await cap('info','넣을 화면을 골라요','[data-ia=cover]',640,'#infoAdd');
  await ev(`document.querySelector('[data-ia=cover]').click()`);await z(900);
  await cap('info','글을 써요','#infoEd',640);
  await cap('info','바로 미리 봐요','#pvInfo canvas',640);
  // 꾸미기
  await ev(`document.activeElement.blur();setPage('slides')`);await z(1800);
  await cap('look','슬라이드를 눌러요','.shotw .shot',760);
  await ev(`document.querySelector('.shotw .shot').click()`);await z(900);
  await cap('look','위에서 글꼴과 크기를 바꿔요','#lookCtl .lkfont',640);
  await cap('look','이 슬라이드만 바꿀 수도 있어요','#lookCtl .lkscope',640);
  await cap('look','배경 색을 골라요','.shead .sw',1060);
  // 내려받기
  await ev(`lookSlideKey=null;buildLookUI()`);await z(500);
  await cap('down','고쳐 쓰려면 PowerPoint','#dlPptx',640);
  await cap('down','그림은 PNG나 JPG','#dlShots',640);
  await cap('down','인쇄는 PDF','#dlPdf',640);
  await cap('down','글만 쓸 땐 TXT','#dlTxt',640);
  // 보관함·양식
  await ev(`const SEC=[{label:'1절',slides:[['만복의 근원 하나님','온 백성 찬송 드리고'],['저 천사여 찬송하세','찬송 성부 성자 성령']]}];LIB={'만복의 근원 하나님':{title:'만복의 근원 하나님',result:{title:'만복의 근원 하나님',linesUsed:2,charsUsed:17,sections:SEC},saved:Date.now(),by:'김목자'}};renderLib();openLib()`);await z(800);
  await cap('lib','제목이나 초성으로 찾아요','#libQ',1060,'#libbox .lcard');
  await cap('lib','새 곡도 넣어요','#libNew',1060,'#libbox .lcard');
  await ev(`$('libClose').click();setPage('song')`);await z(800);
  await cap('lib','자막 양식은 양식 설정에서','#openFmt',560,'#resPanel .rbar');
  await ev(`$('setName').textContent='김목자';$('meName').textContent='김목자';$('setChurch').textContent='호감교회';openSet()`);await z(600);
  // 팀원·교회
  await cap('team','팀원을 초대해요','#invite',560,'#setbox .lcard');
  await cap('team','누가 고쳤는지 봐요','#openLog',560,'#setbox .lcard');
  await ev(`closeSet();setPage('song')`);await z(400);
  // 송출
  await ev(`const w=$('wordText');w.value='요한복음 3:16\\n16 하나님이 세상을 이처럼 사랑하사\\n독생자를 주셨으니';w.dispatchEvent(new Event('input',{bubbles:true}));setPage('slides')`);await z(1800);
  await cap('live','빨간 송출을 눌러요','#dlLive');
  await ev(`$('dlLive').click()`);await until(`!$('lvStart').disabled`);await ev(`document.activeElement.blur()`);await z(400);
  await cap('live','두 번째 화면을 찾아요','#lvFind',560,'#lvDlg');
  await cap('live','송출 시작을 눌러요','#lvStart',560,'#lvDlg');
  await send('Emulation.setDeviceMetricsOverride',{width:1180,height:737,deviceScaleFactor:1.5,mobile:false},S);
  await ev(`$('lvStart').click()`);await z(1800);await ev(`document.activeElement.blur();$('lvClk').textContent='00:05'`);
  await cap('live','다음을 눌러 넘겨요','#lvGo',1178,'#livebox');
  fs.writeFileSync(path.join(DIR,'list.json'),JSON.stringify(M,null,1));
}catch(e){console.log('멈춤',e.message);process.exitCode=1;}
ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(process.exitCode||0);
