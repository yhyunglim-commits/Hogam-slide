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

## 4단계 · 서버 기능 올리기 (Edge Functions)

Supabase 왼쪽 메뉴 **Edge Functions**에서 하는 일이에요.

**① ai 기능 (악보 읽기, 맞춤법 검사)**
1. **Deploy a new function**을 누르고 **Via Editor**를 고르세요.
2. 함수 이름을 `ai`로 적고, 예시 코드를 모두 지운 뒤 `supabase/functions/ai/index.ts` 내용을 붙여 넣어 **Deploy function**을 누르세요.
3. 만들어진 ai 함수의 **Details**(설정)에서 **Verify JWT**(JWT 확인)를 **끄고** 저장하세요. 팀원인지는 코드가 직접 확인해요.

**② 비밀값 넣기**
1. Edge Functions 안의 **Secrets**(비밀값)를 여세요.
2. 아래 값을 추가하고 저장하세요.

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | 3단계에서 복사한 키 |

> **선택 · Claude로 읽기(유료):** `ANTHROPIC_API_KEY`에 Claude API 키(https://platform.claude.com)를 넣으면 Claude가 먼저 읽고, 안 될 때만 Gemini가 대신해요. 기본 모델은 악보를 꼼꼼히 읽는 `claude-sonnet-5-5`예요. 비용을 줄이려면 `CLAUDE_MODEL`에 `claude-haiku-5-5`를 넣으세요.

> 선택: 다른 Gemini 모델을 쓰고 싶으면 `GEMINI_MODEL`을 추가해요. 비워 두면 `gemini-3.8-flash`를 써요.

> 선택: 한 사람이 하루(24시간)에 AI를 쓸 수 있는 횟수는 기본 200번이에요. 바꾸려면 `AI_DAILY_LIMIT`에 숫자를 넣으세요. 악보 한 곡 읽기는 1~2번, 맞춤법 검사는 2번으로 세요.

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

1. 내 프로필의 **팀원 초대**를 눌러 초대 링크를 복사하고 팀원에게 보내 주세요. 링크는 7일 동안 쓸 수 있고, 지나면 다시 누르면 새로 생겨요.
2. 팀원은 링크를 열어 카카오로 시작하고, 교회에서 쓸 이름을 적으면 들어와요. (카카오 로그인은 Supabase **Authentication**에서 켜 두어야 해요.)
3. 다음부터는 카카오로 바로 들어와요.

---

## 쓰면서 알아 둘 점

- **곡 보관함과 예배 기록**은 팀 전체가 함께 봐요. 누가 고치면 다른 사람 화면에도 바로 반영돼요.
- **같은 예배를 두 사람이 동시에 고치면**, 다른 사람이 고친 순간 "○○님이 고쳤어요 · 최신으로 불러오기" 알림이 떠요. 그래도 옛 글에서 계속 고치면 저장이 막히고, 위에 빨간 안내가 떠요. **내 글 복사 · 최신 글 불러오기 · 내 글로 저장** 중에서 고르면 돼요. 남의 글을 모르고 덮어쓰는 일은 없어요.
- **편집 기록**은 왼쪽 아래 내 이름 옆 **편집 기록**에서 볼 수 있어요. 누가 언제 무엇을 만들고 고치고 지웠는지 남아요. 같은 사람이 10분 안에 계속 고친 것은 한 줄로 묶여요. 이름은 서버가 직접 적어서, 다른 사람 이름으로 꾸며 쓸 수 없어요.
- 편집 기록의 **되돌리기**를 누르면 그 줄의 고치기 전 모습으로 돌아가요. 지운 곡이나 예배 기록은 **되살리기**로 살릴 수 있어요. 되돌린 일도 기록에 남아서, 잘못 눌렀으면 다시 되돌리면 돼요. (2026년 11월 2단계 업데이트 뒤에 고치거나 지운 것부터 돼요.)
- **슬라이드 설정, 배경 사진, 로고, 자막 양식, 말씀 설정**은 팀이 함께 써요. 누가 바꾸면 모두의 화면에 바로 반영돼요. 집에서 바꾼 설정이 방송실 PC에도 그대로 나와요.
  - 업데이트 뒤 어떤 컴퓨터에서 처음 들어갈 때, 그 컴퓨터 설정이 팀 설정과 다르면 아래에 **'이 컴퓨터 설정을 팀 설정으로'** 버튼이 15초 동안 떠요. 방송실 PC처럼 '진짜' 설정이 있는 컴퓨터에서 눌러 주세요.
- **자막 양식 창**: 찬양 자막의 양식 칸 옆 **양식 설정**을 누르면, 양식을 자세히 다듬거나 추천받을 수 있어요.
- **어두운 화면**: 왼쪽 아래 내 이름 옆 **화면: 자동/어둡게/밝게**로 바꿔요. 자동이면 컴퓨터 설정을 따라요. 이건 컴퓨터마다 따로예요.
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

**팀원을 내보낼 때**: 교회 관리자가 왼쪽 아래 내 이름 › 설정 › **팀원 관리**에서 이름 옆 **⋯ › 내보내기**를 누르세요. 그 교회에서만 빠지고, 만든 예배와 곡은 남아요. 초대 링크는 바로 막혀요. (Authentication에서 사용자를 지우면 다른 교회에서도 빠지니 쓰지 마세요.)

**관리자를 세우거나 내릴 때**: 같은 **팀원 관리**에서 해요. 교회를 만든 사람이 처음 관리자이고, 마지막 관리자는 내릴 수 없어요. **휴지통의 완전히 지우기**도 관리자만 할 수 있어요.

**전체 관리자를 넣을 때**: 서비스 운영자 한 사람만 넣어요. Authentication › Users에서 계정 번호(User UID)를 복사해 SQL Editor에서 실행하면, 설정 창에 **전체 관리**가 생겨요. 교회 카드에서 팀원 수·AI 횟수·용량(어림)·마지막 사용을 보고, 메모·팀원 관리·교회 멈추기를 해요. 예배·곡 내용은 볼 수 없어요.

```sql
insert into public.super_admins (user_id) values ('계정 번호') on conflict do nothing;
```

**팀원 이름을 바꿀 때**: 로그인할 때 쓰는 이름이라 두 곳을 함께 바꿔야 해요. SQL Editor에서 `옛이름`, `새이름`만 고쳐 실행하세요.

```sql
update auth.users
   set email = 'u' || encode(convert_to('새이름','UTF8'),'hex') || '@hogamslide.app',
       raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('name','새이름')
 where id = (select user_id from public.members where name = '옛이름');
update public.members set name = '새이름' where name = '옛이름';
```

**팀원 목록 보기**: Table Editor › `members` 표에 이름과 들어온 날짜가 있어요.

**화면을 새로 올렸는데 설정 업데이트가 필요할 때**: `supabase/schema.sql`이 바뀌었다면 SQL Editor에 파일 전체를 다시 붙여 넣고 Run 하세요. 여러 번 실행해도 기존 데이터는 그대로예요. `supabase/functions/` 안의 파일이 바뀌었다면 Edge Functions에서 그 기능을 열고 코드를 바꿔 붙인 뒤 Deploy 하세요.

**화면을 고쳐서 다시 올릴 때**: GitHub 저장소에서 `index.html`을 새 파일로 다시 올리면, 1~2분 뒤 주소에 반영돼요.

---

## 폴더 안내

```
index.html                         호감슬라이드 화면
config.js                          Supabase 주소와 공개 키 (5단계)
supabase/schema.sql                데이터베이스 설정 (2단계)
supabase/functions/ai/index.ts     악보 읽기·맞춤법 검사 기능 (4단계)
.github/workflows/keepalive.yml    잠들지 않게 깨우기 (자동)
```
