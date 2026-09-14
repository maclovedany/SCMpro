# 운영·유지보수 방안

최종 갱신: 2026-09-14 · 출처: 커리큘럼 [10], D-043 · 상태: 운영 이관 전 초안

## 1. 구성 요소와 실행 위치
| 구성 요소 | 지금 | 운영 권장 |
|---|---|---|
| Web (Next.js) | 개발 Mac `npm run dev` | Vercel 또는 사내 Node 서버. 환경변수 `web/.env.local` 항목 그대로 |
| Engine (Python) | 개발 Mac launchd `com.scmpro.tick` 10분 | 사내 Linux 서버 systemd timer 10분 (`engine tick`), 월 1회 자동 런은 tick 안에서(D-041) |
| DB (Supabase) | 클라우드 프로젝트(Micro) | Small 이상 권장 — 백테스트(6 프로세스 쓰기)·물리화 뷰 refresh·e2e 를 동시에 돌리면 인스턴스가 재시작될 수 있음(2026-09-14 장애: 동시 부하 후 1시간 이상 복구 대기) |
| SMTP / OpenAI | 네이버 SMTP, OpenAI 키 (engine/.env, web/.env.local) | 회사 메일 서버·OpenAI 조직 키, 비밀은 서버 환경변수/시크릿 매니저 |

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

## 4. 변경 절차
1. 규칙 변경 → `docs/02-domain-rules` 갱신 → 참조 코드 grep → 테스트(pytest·vitest·e2e) → `03-decisions.md` D-번호 → 배포.
2. 마이그레이션은 파일 추가만(기존 파일 수정은 재실행 안전할 때만), `migrate.sh` 로 적용, `engine gen-types` 로 타입 재생성.
3. 설정 변경(리드타임·DoS·Flex·자동 런·AI 감시)은 관리자 화면에서 — 코드 배포 없음. 모든 변경은 `app.audit_log`.

## 5. 백업·복구
- Supabase 자동 백업(요금제에 따라 일 1회) + 월 1회 `pg_dump` 를 사내 보관. `raw` 는 원본 파일이 있으므로 `load-raw.sh` 로 재적재 가능.
- 복구 순서: 프로젝트 복구 → `migrate.sh` → `load-raw.sh` → 업로드 이력 재적용 → 물리화 뷰 refresh → 백테스트·프로덕션 런.

## 6. 인수인계 체크리스트
- 계정 6개 역할·비밀번호 정책, SMTP/OpenAI 키 교체, 운영 서버 timer 등록, Supabase 요금제·백업 확인, ERP 연동 담당(09-integration-plan) 지정, 사용자 가이드(08) 교육.
