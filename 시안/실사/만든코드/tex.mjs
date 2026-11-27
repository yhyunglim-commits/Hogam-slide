import fs from 'fs';
// 악보: 직접 지은 가락·가사
const L=['아침 햇살 비추듯','주님 사랑 내게 와','나의 작은 노래로','주를 높이 찬양해','오늘도 주와 함께','기쁨으로 걸어가'];
const N=[[4,3,2,3,4,5,4],[2,3,4,5,4,3,2],[1,2,3,4,5,4,3],[5,4,3,4,2,1,2],[4,5,6,5,4,3,4],[3,2,1,2,3,2,1]];
let s='';
L.forEach((t,i)=>{
  const y=360+i*205,sp=15;
  for(let k=0;k<5;k++)s+=`<path d="M90 ${y+k*sp}H1110" stroke="#222" stroke-width="1.7"/>`;
  s+=`<path d="M90 ${y}v60M600 ${y}v60M1110 ${y}v60" stroke="#222" stroke-width="2.4"/><text x="98" y="${y+60}" font-family="Apple Symbols,Noto Music" font-size="98" fill="#1b1b1b">𝄞</text>`;
  if(i==5)s+=`<path d="M1109 ${y}v60" stroke="#222" stroke-width="6"/>`;
  const ch=[...t.replace(/ /g,'')];
  ch.forEach((c,j)=>{
    const x=205+j*(870/ch.length)+(j>3?12:0),ny=y+60-N[i][j]*sp/2,up=N[i][j]<4,last=j==ch.length-1;
    s+=`<ellipse cx="${x}" cy="${ny}" rx="10" ry="7" transform="rotate(-22 ${x} ${ny})" fill="${last?'none':'#161616'}" stroke="#161616" stroke-width="2.6"/><path d="M${up?x+9:x-9} ${ny+(up?-3:3)}V${ny+(up?-52:52)}" stroke="#161616" stroke-width="2.4"/>`;
    s+=`<text x="${x}" y="${y+117}" text-anchor="middle" font-size="32" font-family="AppleMyungjo,serif" fill="#181818">${c}</text>`;
  });
  ['C','G','Am','F'].forEach((c,j)=>s+=`<text x="${200+j*225}" y="${y-28}" font-family="Times New Roman" font-weight="700" font-size="27" fill="#222">${c}</text>`);
});
fs.writeFileSync('score.html',`<meta charset=utf-8><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1697" viewBox="0 0 1200 1697"><rect width="1200" height="1697" fill="#f8f4e9"/><text x="600" y="165" text-anchor="middle" font-size="76" font-family="AppleMyungjo,serif" font-weight="700" fill="#151515">아침 햇살</text><text x="1110" y="245" text-anchor="end" font-size="25" font-family="AppleMyungjo" fill="#444">글 · 곡 호감</text><text x="92" y="270" font-size="27" font-family="Times New Roman" font-style="italic" fill="#333">Moderato</text>${s}</svg>`);
fs.writeFileSync('ui.html',`<meta charset=utf-8><body style="margin:0;width:1600px;height:1000px;background:#fbfbfd;font-family:'Apple SD Gothic Neo'"><div style="height:64px;background:#fff;border-bottom:2px solid #e3e3e9;display:flex;align-items:center;padding:0 28px"><b style="font-size:30px;color:#2b2b36">아침 햇살</b><b style="margin-left:auto;background:#2f7af0;color:#fff;font-size:24px;padding:8px 24px;border-radius:9px">슬라이드 만들기</b></div><div style="position:absolute;left:0;top:66px;width:250px;bottom:0;background:#f1f2f6;padding:26px;box-sizing:border-box;font-size:26px;line-height:2.3;color:#777">예배 순서<br><b style="color:#2465cf">찬양</b><br>말씀<br>광고<br>설정</div><div style="position:absolute;left:290px;top:106px;right:40px;bottom:40px;background:#fff;border:2px solid #dedee6;border-radius:16px"></div>`);
