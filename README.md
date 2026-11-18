# 호감슬라이드 공유판 — 처음 설정 안내

찬양 악보와 말씀을 예배 자막과 슬라이드로 바꾸는 호감슬라이드를, 팀이 함께 쓰도록 무료로 올리는 방법이에요.

- **화면**은 GitHub Pages에 올려요.
- **로그인, 함께 쓰는 곡 보관함과 예배 기록, 편집 기록**은 Supabase 무료 플랜에 저장해요.
- **악보 읽기와 맞춤법 검사**는 Google Gemini 무료 API로 해요.

처음 한 번, 30분 정도 걸려요. 순서대로 따라 하시면 돼요.

---

## 준비물

| 서비스 | 쓰는 곳 | 주소 |
|---|---|---|
| GitHub 계정 | 화면 올리기 | https://github.com |
| Supabase 계정 | 로그인과 저장소 | https://supabase.com (GitHub 계정으로 가입할 수 있어요) |
| Google 계정 | 악보 읽기 AI 키 | https://aistudio.google.com |

정해 둘 것: **팀 암호** 하나. 팀원이 처음 들어올 때 한 번만 넣는 암호예요.

---

## 1단계 · Supabase 프로젝트 만들기

1. https://supabase.com 에 로그인하고 **New project**를 누르세요.
2. 다음처럼 적고 **Create new project**를 누르세요.
   - 이름: `hogam-slide`
   - Database Password: 아무 긴 암호. 따로 적어 두세요.
   - Region: **Northeast Asia (Seoul)**
3. 1~2분 기다리면 프로젝트가 준비돼요.

## 2단계 · 데이터베이스 설정 넣기

1. 왼쪽 메뉴 **SQL Editor**를 누르고, **New query**를 누르세요.
2. 이 폴더의 `supabase/schema.sql` 파일을 메모장으로 열어 **전체를 복사해 붙여 넣고**, **Run**을 누르세요.
3. 아래에 `Success`가 나오면 끝이에요.

## 3단계 · Gemini 키 받기

1. https://aistudio.google.com 에 Google 계정으로 들어가세요.
2. **Get API key**를 누르고 **Create API key**를 누르세요.
3. 나온 키(`AIza…`로 시작)를 복사해 두세요.

## 4단계 · 서버 기능 두 개 올리기 (Edge Functions)

Supabase 왼쪽 메뉴 **Edge Functions**에서 하는 일이에요.

**① signup 기능 (처음 오는 팀원 등록)**
1. **Deploy a new function**을 누르고 **Via Editor**를 고르세요.
2. 함수 이름을 `signup`으로 적으세요.
3. 편집기 안의 예시 코드를 모두 지우고, `supabase/functions/signup/index.ts` 내용을 붙여 넣으세요.
4. **Deploy function**을 누르세요.
5. 만들어진 signup 함수의 **Details**(설정)에서 **Verify JWT**(JWT 확인)를 **끄고** 저장하세요.

**② ai 기능 (악보 읽기, 맞춤법 검사)**
1. 같은 방법으로 이름 `ai`인 함수를 만들고, `supabase/functions/ai/index.ts` 내용을 붙여 넣어 Deploy 하세요.
2. 이 함수도 **Verify JWT를 끄세요.** 팀원인지는 코드가 직접 확인해요.

**③ 비밀값 넣기**
1. Edge Functions 안의 **Secrets**(비밀값)를 여세요.
2. 아래 두 개를 추가하고 저장하세요.

| Name | Value |
|---|---|
| `TEAM_CODE` | 정해 둔 팀 암호 |
| `GEMINI_API_KEY` | 3단계에서 복사한 키 |

> **선택 · Claude로 읽기(유료):** `ANTHROPIC_API_KEY`에 Claude API 키(https://platform.claude.com)를 넣으면 Claude가 먼저 읽고, 안 될 때만 Gemini가 대신해요. 기본 모델은 `claude-sonnet-5-5`이고, `CLAUDE_MODEL`에 `claude-haiku-5-5`를 넣으면 더 싸고 빨라요.

> 선택: 다른 Gemini 모델을 쓰고 싶으면 `GEMINI_MODEL`을 추가해요. 비워 두면 `gemini-3.8-flash`를 써요.

## 5단계 · config.js 채우기

1. Supabase **Project Settings › API Keys**(또는 **API**)를 여세요.
2. 두 값을 복사하세요.
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon public** 키, 또는 **publishable** 키(`sb_publishable_…`)
3. 이 폴더의 `config.js`를 메모장으로 열고, 따옴표 안의 `여기에…` 부분을 복사한 값으로 바꾸세요.
4. `TEAM_NAME`은 로그인 화면에 보이는 팀 이름이에요. 마음대로 바꿔도 돼요.

> 이 두 값은 화면 코드에 들어가는 공개용 값이라 공개돼도 괜찮아요. 데이터는 팀원만 열 수 있게 서버가 막고 있어요.
> **service_role** 키나 **secret** 키는 절대 config.js에 넣지 마세요.

## 6단계 · GitHub에 올리고 주소 만들기

1. https://github.com 에서 오른쪽 위 **+ › New repository**를 누르세요.
2. 이름은 `hogam-slide`, **Public**을 고르고 **Create repository**를 누르세요.
3. **uploading an existing file**을 누르고, 이 폴더 안의 파일과 폴더를 **모두** 끌어다 놓으세요.
   - `.github` 폴더도 꼭 함께 올려야 해요. 맥에서 숨김 폴더가 안 보이면 Finder에서 `Cmd + Shift + .`을 누르세요.
4. 아래 **Commit changes**를 누르세요.
5. 저장소의 **Settings › Pages**에서 Branch를 **main**, 폴더를 **/(root)**로 고르고 **Save**를 누르세요.
6. 1~2분 뒤 위쪽에 주소가 나와요. 예: `https://아이디.github.io/hogam-slide/`

## 7단계 · 팀원 초대하기

1. 주소와 팀 암호를 팀원에게 알려 주세요.
2. 각자 주소를 열고 **처음이에요**를 눌러 이름, 개인 암호, 팀 암호를 넣어요.
3. 다음부터는 **들어가기**에서 이름과 개인 암호만 넣으면 돼요.

맨 먼저 관리자 본인이 같은 방법으로 들어가 보세요.

---

## 쓰면서 알아 둘 점

- **곡 보관함과 예배 기록**은 팀 전체가 함께 봐요. 누가 고치면 다른 사람 화면에도 바로 반영돼요.
- **같은 예배를 두 사람이 동시에 고치면**, 다른 사람이 고친 순간 "○○님이 고쳤어요 · 최신으로 불러오기" 알림이 떠요. 마지막에 저장한 내용이 남으니, 한 예배는 한 사람이 맡아 주세요.
- **편집 기록**은 왼쪽 아래 내 이름 옆 **편집 기록**에서 볼 수 있어요. 누가 언제 무엇을 만들고 고치고 지웠는지 남아요. 같은 사람이 10분 안에 계속 고친 것은 한 줄로 묶여요. 이름은 서버가 직접 적어서, 다른 사람 이름으로 꾸며 쓸 수 없어요.
- **슬라이드 설정, 배경 사진, 로고**는 지금은 각자 브라우저에 저장돼요.
- Claude 안에서 쓰던 호감슬라이드의 보관함과 기록은 이쪽으로 자동으로 옮겨지지 않아요.

## 무료로 쓰면서 생기는 제한

- **Supabase 무료 플랜**은 7일 동안 아무도 안 쓰면 잠들어요.
  - 이 저장소의 `.github/workflows/keepalive.yml`이 사흘마다 자동으로 깨워요.
  - 저장소에 60일 동안 아무 변화가 없으면 GitHub가 이 자동 실행을 멈출 수 있어요. 그럴 땐 저장소 **Actions** 탭에서 다시 켜 주세요.
  - 혹시 잠들었다면 Supabase 대시보드에서 **Restore**를 누르면 데이터 그대로 깨어나요.
- **Gemini 무료 API**는 하루에 쓸 수 있는 횟수가 정해져 있어요. 넘으면 "오늘 무료 사용량을 거의 다 썼어요"라고 나오니, 잠시 뒤나 다음 날 다시 하면 돼요. 무료로 보낸 악보와 가사는 Google이 서비스 개선에 쓸 수 있어요.
- 저장 공간은 500MB예요. 가사와 작은 썸네일만 저장해서 몇 년은 넉넉해요.

## 관리자가 하는 일

**팀원이 개인 암호를 잊었을 때**: Supabase **SQL Editor**에서 아래처럼 실행하고, 새 암호를 알려 주세요.

```sql
select public.reset_password('김목자', '새암호1234');
```

**팀원을 내보낼 때**: **Authentication › Users**에서 그 사람(`u…@hogamslide.app`)을 찾아 **Delete user** 하세요. 팀원 목록에서도 함께 빠져요.

**팀 암호를 바꿀 때**: Edge Functions › Secrets에서 `TEAM_CODE`를 바꾸세요. 이미 들어온 팀원은 그대로 쓸 수 있어요.

**화면을 고쳐서 다시 올릴 때**: GitHub 저장소에서 `index.html`을 새 파일로 다시 올리면, 1~2분 뒤 주소에 반영돼요.

---

## 폴더 안내

```
index.html                         호감슬라이드 화면
config.js                          Supabase 주소와 공개 키 (5단계)
supabase/schema.sql                데이터베이스 설정 (2단계)
supabase/functions/signup/index.ts 팀원 등록 기능 (4단계)
supabase/functions/ai/index.ts     악보 읽기·맞춤법 검사 기능 (4단계)
.github/workflows/keepalive.yml    잠들지 않게 깨우기 (자동)
```
