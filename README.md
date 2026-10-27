# 현장 일정 날씨판

오늘 현장 일정과 지역별 날씨를 한 화면에서 보고, 날씨 때문에 주의 · 중지를 검토할 일정을 표시합니다. (교육용 가상 데이터)

## 여는 법
- 내 PC : `config.js`에 Supabase 주소·공개용 키를 입력한 뒤 `index.html` 더블클릭
- 인터넷 : (배포 후 Vercel 주소를 여기에 적기)

## 파일
| 파일 | 역할 |
|---|---|
| index.html | 화면 구조 |
| style.css | 디자인 |
| logic.js | 판단 규칙 |
| app.js | 화면 동작 |
| PRD.md | 무엇을 · 왜 만드는지 |
| CLAUDE.md | AI가 지킬 작업 규칙 |
| config.js | Supabase 주소·공개용 키 두 줄 |
| setup.sql | `wx_tasks` 표·제약·RLS·초기 데이터 |

## Supabase 설정

1. Supabase 프로젝트의 SQL Editor에서 `setup.sql`을 실행합니다.
2. 프로젝트 URL과 공개용 키(publishable key 또는 anon key)를 `config.js` 두 줄에 입력합니다.
3. `index.html`을 열면 `wx_tasks`에서 일정을 읽고, 추가 일정도 같은 표에 저장합니다.

비밀 키(service role key)는 사용하지 않으며 `config.js`나 GitHub에 넣지 않습니다.
| .gitignore | GitHub에 올리지 않을 파일 목록 |
