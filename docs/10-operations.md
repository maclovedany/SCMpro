# 운영·유지보수 방안

최종 갱신: 2026-09-14 · 출처: 커리큘럼 [10], D-043/045/048/049 · 상태: **Web·Engine 배포 완료**, 사내 이관 항목만 남음

## 1. 구성 요소와 실행 위치
| 구성 요소 | 현재 (2026-09-14) | 비고 |
|---|---|---|
| Web (Next.js) | **Vercel Pro 배포됨** (https://sc-mpro.vercel.app) | 설정: **Framework Preset = Next.js**(Other 로 잡히면 전 경로 404) (Root Directory `web`, 리전 서울 `icn1` — `web/vercel.json`, 함수 제한 `maxDuration = 60` 은 발주 계획·업로드 페이지와 AI 채팅 라우트에 선언, D-048). 환경변수 4개: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`. Supabase Auth 의 Site/Redirect URL 에 Vercel 도메인 추가 |
| Engine (Python) | **Railway Cron 배포됨** (개발 Mac launchd 는 중복이라 중지) | **Railway Cron 서비스** (Root Directory `engine`, `engine/Dockerfile` + `railway.json` 의 `*/10 * * * *`, 명령 `engine tick`, 메모리 2GB 이상, 리전 싱가포르/도쿄, D-049) — 또는 사내 Linux systemd timer. 월 1회 자동 런은 tick 안에서(D-041) |
| DB (Supabase) | Pro 조직 · Micro · 디스크 8GB (2026-09-14 Free/nano 에서 이전) | 부하가 늘면 Small 이상 — 백테스트(6 프로세스 쓰기)·물리화 뷰 refresh·e2e 를 동시에 돌리면 인스턴스가 재시작될 수 있음(2026-09-14 장애: 동시 부하 후 1시간 이상 복구 대기) |
| SMTP / OpenAI | 네이버 SMTP, OpenAI 키 — 로컬은 `engine/.env`·`web/.env.local`, 운영은 Railway Variables · Vercel Environment Variables | 회사 메일 서버·OpenAI 조직 키로 교체 예정 |

### 1-1. Railway 에 엔진 올리기 (D-049)
1. Railway → New Project → **Deploy from GitHub repo** → `maclovedany/SCMpro` 선택.
2. 서비스 Settings → **Root Directory** = `engine` (Dockerfile·railway.json 자동 인식). Build 는 첫 회 3~5분(prophet·lightgbm).
3. **Variables** 에 `engine/.env` 의 값 그대로: `SUPABASE_DB_URL`, `OPENAI_API_KEY`, `SMTP_HOST/PORT/USER/PASS/FROM`. (`SQLITE_PATH` 불필요)
4. Settings → **Cron Schedule** 이 `*/10 * * * *` 인지 확인(railway.json 이 넣음). Deploy 후 첫 실행 로그에 `tick={...} auto_run=... agent=... email=...` 가 찍히면 정상.
5. 이 Mac 의 launchd 는 중복 실행이므로 끈다: `launchctl unload ~/Library/LaunchAgents/com.scmpro.tick.plist`.
6. 자동 런이 도는 달(설정 켠 경우)은 tick 이 3~5분 걸리므로 서비스 메모리 2GB 이상. 실패 시 Railway 로그 + `app.forecast_run.error`.

## 2. 정기 작업 달력
| 시점 | 작업 | 자동/수동 | 확인 |
|---|---|---|---|
| 매일 | 재고 스냅샷·입고예정 업로드(I-2/I-3) | 수동(파일) → 향후 API | 대시보드 "데이터 준비" |
| 매 10분 | tick: 배정 만료·알림·미제출 독촉·이메일·AI 감시 | 자동 | `/tmp/scmpro/tick.log`(운영: journald), 알림 화면 |
| 매월 실적 마감 후 | 출고 실적 업로드(I-1) → 자동 런(백테스트·프로덕션·AI 제안) | 업로드 수동, 런 자동(D-041) | 예측 › 런 "자동" 배지, 알림 "[자동 런] 완료/회귀" |
| 매월 발주 전 | 발주 계획 생성 → 검토 → 확정 → 승인 → 제출 OL | 수동(워크플로) | 발주 계획·승인함·보고서 |
| 분기 | 임계값 점검(AI 감시 유용함 비율·채택률), 기법 on/off, 목표 DoS 검토 | 수동 | AI 감시·AI 통계·품목 설정 |

## 3. 모니터링·알림
- 런 실패: `app.forecast_run.status='failed'` + 알림 `auto_run_failed`. 런이 `running` 인 채 30분 이상이면 프로세스 사망 → `failed` 로 표시 후 재실행(2026-09-14 DB 장애 사례).
- tick 이 멈추면: 알림·이메일이 끊긴다. 운영 서버에서 timer 상태 + 마지막 로그 시각을 대시보드 "데이터 준비"에 표시하도록 확장 예정.
- DB 부하 규칙: 엔진 런 중 `migrate.sh` 금지(CLAUDE.md 8), 런과 e2e·물리화 뷰 refresh 동시 실행 금지.
- **디스크(D-045)**: Supabase Infrastructure 의 Disk 사용률을 주 1회 확인. 70% 넘으면 `run_retention` 을 줄이거나 `select app.fn_prune_runs(2)` 실행 후 `vacuum full app.forecast_result`. 런 1개 ≈ 50~100MB, WAL 은 체크포인트 후 회수. 2026-09-14 장애: 2GB 디스크에 1.2GB DB + 576MB WAL → 크래시 루프 → Pro/Micro(8GB) 로 해결.

## 4. 변경 절차
1. 규칙 변경 → `docs/02-domain-rules` 갱신 → 참조 코드 grep → 테스트(pytest·vitest·e2e) → `03-decisions.md` D-번호 → 배포.
2. 마이그레이션은 파일 추가만(기존 파일 수정은 재실행 안전할 때만), `migrate.sh` 로 적용, `engine gen-types` 로 타입 재생성.
3. 설정 변경(리드타임·DoS·Flex·자동 런·AI 감시)은 관리자 화면에서 — 코드 배포 없음. 모든 변경은 `app.audit_log`.

## 5. 백업·복구
- Supabase 자동 백업(요금제에 따라 일 1회) + 월 1회 `pg_dump` 를 사내 보관. `raw` 는 원본 파일이 있으므로 `load-raw.sh` 로 재적재 가능.
- 복구 순서: 프로젝트 복구 → `migrate.sh` → `load-raw.sh` → 업로드 이력 재적용 → 물리화 뷰 refresh → 백테스트·프로덕션 런.

## 6. 인수인계 체크리스트
- 계정 6개 역할·비밀번호 정책, SMTP/OpenAI 키 교체, 운영 서버 timer 등록, Supabase 요금제·백업 확인, ERP 연동 담당(09-integration-plan) 지정, 사용자 가이드(08) 교육.
