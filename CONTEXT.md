# 호감슬라이드 — 인수인계 (2026-11-22 밤)

## 지금 상태
- 배포: https://yhyunglim-commits.github.io/Hogam-slide/ (main push = GitHub Pages 배포)
- 한 파일 앱: index.html (+ brand/, config.js, supabase/)
- 로컬 확인: `python3 -m http.server 8765 --bind 127.0.0.1` → http://127.0.0.1:8765/ (실제 팀 서버에 붙음)
- 큰 방향: 교회별 공간 나누기 시작. 계획·결정은 `계획-교회별공간.md` 한 곳에.
- 오늘 한 일
  - 실제 서버 백업 (팀원 6 · 곡 664 · 예배 8 · 설정 9 · 기록 165) → 호감 다운로드 폴더 JSON
  - 1단계 실제 서버 적용: churches 표, 모든 표에 church_id, 전부 옥수교회. 화면 코드는 그대로
  - 적용 중 가짜 '고침' 기록 672줄·고친 사람/때/판 번호 바뀜 → 되돌림 (기록 165로 복구 확인)
  - 시험 프로젝트 hogam-slide-test 만듦 (사용자 test1@hogamslide.app). 자동 시험 9개 통과
- 시험 방법: 시험 프로젝트 SQL Editor에 supabase/tests/ 의 church-step1-reset → seed → schema.sql,
  그다음 `TEST_URL=… TEST_KEY=… TEST_PW=… node supabase/tests/church-step1.mjs` (주소·키·암호는 호감에게 받기)

## 다음 세션 첫 순서
1. 2단계: 예배·곡·설정·편집 기록·팀원 목록을 교회별로 잠그기 (규칙을 is_member → 내 교회인지로)
2. 2단계 자동 시험: 시험 프로젝트에 두 번째 교회·사용자를 만들어 서로 못 보는지 확인
3. 3단계 준비: 가입을 '교회 코드 + 이름 + 암호'로 (members 임시 기본값 옥수교회 없애기)

## 남은 확인 사항
- Supabase 커넥터가 연결 안 돼 있어 SQL은 호감이 붙여 넣어야 함. 연결하면 시험 서버는 직접 가능
- 실시간(다른 사람이 고친 것 바로 보기)은 1단계 뒤 두 사람 동시로 안 봄
- AI 악보 읽기 한도: 교회가 늘면 Gemini 무료 키 하나로 부족 → 교회별 한도 또는 유료 결정 필요
- 이전 세션에서 넘어온 것: 첫 화면 '예배 준비하기' 실제 로그인 확인, 표지 칸 자동 채움, '지난주처럼 시작',
  아이폰 사파리 확인, 새로고침 뒤 곡 수 줄어드는 문제
- 저장소의 '찬송가 오탈자확인 장.pdf'는 커밋 안 함 (일부러 뺌)
