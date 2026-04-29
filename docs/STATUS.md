# 작업 현황 — 2026-04-29 갱신

> 다음 세션에서 이 문서만 보고 어디부터 이어갈지 알 수 있도록 정리.

## 1. 한눈에

| 영역 | 상태 |
|---|---|
| 미니앱 v0.1 — 구현 | ✅ 완료 |
| 미니앱 v0.1 — 실기기 검증 | ⏳ 진행중 (포트 5273, 192.168.68.113) |
| 미니앱 v0.1 — 토스 콘솔 등록 | ❌ 미시작 |
| 미니앱 v0.1 — `ait deploy` | ❌ 미시작 |
| 서버 v0.2 — 스캐폴딩 | ✅ 완료 |
| 서버 v0.2 — 로컬 D1 마이그레이션 | ✅ 완료 |
| 서버 v0.2 — 로컬 API 검증 | ✅ POST/GET 통과 |
| 서버 v0.2 — **원격 D1 마이그레이션** | ✅ **완료 (2026-04-29)** |
| 서버 v0.2 — **Workers 배포** | ✅ **완료 (2026-04-29)** |
| 서버 v0.2 — **원격 종단 검증** | ✅ **cron 매 분 발화 + sendMessage + DB sent 기록 확인** |
| 서버 v0.2 — 클라 prod URL 연결 | ✅ `app/.env.local` 작성됨 |
| 토스 mTLS 인증서 | ❌ 미시작 (콘솔 등록 후) |
| 토스 광고 그룹 ID | ❌ 미시작 (테스트 ID 자동 폴백 중) |

### 배포 정보
- **워커 URL**: https://suncream-noti-api.hohostd.workers.dev
- **CF 서브도메인**: hohostd.workers.dev (계정 전체 1회성 등록)
- **CF 리전**: ICN (인천) 우선
- **Cron**: `* * * * *` (UTC) — 정확하게 +45초 정도에 발화 확인

## 2. 미니앱 (app/) 구현

- 인트로(Welcome) → 온보딩(피부타입·환경·시간) → 홈 → 적립 결과 4화면
- **모든 적립은 보상형 광고 시청 트리거** (홈 CTA: "광고 보고 피부 보호하기")
- 회차당: 광고 1회=기본 2/3/4원, 추가 광고 +1원 ×2회 (일 최대 9회 광고 = 15원)
- 슬롯별 시간 잠금 카운트다운, 광고 보러 가기 전 미적립 상태 분리
- 배너 광고 슬롯(`TossAds.attachBanner`), 보상형(`loadFullScreenAd` + `userEarnedReward`)
- dev에선 광고 SDK 미지원 시 600ms 후 시뮬레이션 폴백
- 선크림 톤의 EmojiBubble (🧴 ☀️ 🎉 ✨ ⏰)
- DEV `🛠 reset` 플로팅 버튼 + `?reset=1` URL 핸들러로 데이터 일괄 초기화
- 서버 등록 fire-and-forget: 온보딩 완료 시 `getAnonymousKey()` → `POST /api/users`

`granite.config.ts`:
- `appName=dailysuncream`, `displayName=선크림 알림`, `primaryColor=#FF8A4C`
- `host=192.168.68.113`, `port=5273` (5173은 bible-miniapp이 점유)

## 3. 서버 (server/) 구조

```
server/src/
├── index.ts              # Hono fetch + scheduled
├── env.ts                # CF 바인딩 타입 (DB, TOSS_*)
├── routes/
│   ├── users.ts          # POST/DELETE/GET /api/users (zod)
│   └── health.ts
├── cron/tick.ts          # KST 분 매칭 → 발송 + 중복 방지
├── db/{schema,client}.ts # users / user_slots / notifications
├── toss/{client,mock,factory}.ts
└── lib/time.ts           # KST/UTC 변환
```

| 항목 | 값 |
|---|---|
| 워커 이름 | `suncream-noti-api` |
| D1 이름 | `suncream-noti-db` |
| D1 ID | `bbcff655-ecae-4770-9281-77a56a843537` |
| Cron | `* * * * *` (UTC) |
| TOSS_MODE | `mock` (콘솔 로그) |
| 마이그레이션 | `drizzle/migrations/0001_init.sql` |

### 로컬 검증 통과 항목
- `GET /api/health` → `{ok:true, mode:"mock"}`
- `POST /api/users` (test-1, slots [540,720,900]) → `{ok:true, slotCount:3}`
- `GET /api/users/test-1` → 등록 데이터 정확 반환

### 미검증 (원격 배포 후 자연스럽게 확인)
- 실제 CF Cron 매 분 발화
- D1 원격 마이그레이션
- `wrangler tail`로 mock sendMessage 로그
- 클라(prod) → 서버 등록 흐름 end-to-end

## 4. 다음 단계 (이대로 이어가면 됨)

### A. 서버 원격 배포 ✅ 완료 (2026-04-29)
- `npm run db:migrate:remote` ✓
- `npm run deploy` → https://suncream-noti-api.hohostd.workers.dev ✓
- `app/.env.local`에 `VITE_API_URL` 박힘 ✓
- 종단 검증: cron 매 분 발화, KST 매칭, mock sendMessage, D1 sent 기록 모두 통과 (slot 1223·1224 두 건 검증 후 삭제)
- 모니터링: `cd server && npm run tail`

### B. 토스 콘솔 등록 + 출시 트랙 (사용자 트랙)
1. https://apps-in-toss.toss.im 진입 → 워크스페이스 + 미니앱 등록 (`appName=dailysuncream`)
2. 카테고리: 비게임 유틸 — 라이프/헬스케어
3. **API 키(시크릿 토큰) 발급** → `cd app && npx ait token add`
4. **광고 그룹 발급** (보상형 + 배너) → `app/src/hooks/useRewardedAd.ts`와 `app/src/components/BannerAdSlot.tsx`의 `PROD_AD_GROUP_ID` 채우기
5. **mTLS 인증서 신청** (스마트 발송 활성화 후) → 도착하면 5번 트랙 가동

### C. 토스 mTLS 인증서 도착 후
1. `npx wrangler mtls-certificate upload --cert toss.crt --key toss.key --name toss-prod`
2. 출력된 `certificate_id`를 [server/wrangler.toml](../server/wrangler.toml)의 `[[mtls_certificates]]` 블록에 박고 주석 해제
3. `server/src/toss/real.ts` 작성 (`fetch(url, { cf: { mtlsCertificateId } })` 패턴)
4. `server/src/toss/factory.ts`에서 real 클라 import, `TOSS_MODE=real`로 변경
5. `npm run deploy`
6. **CF Workers Free 플랜에서 mTLS 바인딩이 막히는 경우** Deno Deploy 또는 GH Actions 릴레이로 폴백 (계속 ₩0 유지)

### D. 미니앱 출시
1. `app/.env.local`에 prod `VITE_API_URL` 박기
2. `cd app && npm run build` → `.ait` 아티팩트 생성
3. `cd app && npx ait deploy -m "v0.1.0 초기 출시"`
4. 콘솔에서 검수 요청 → 비게임 체크리스트 통과 → 공개

## 5. 결정 로그 (~ 2026-04-28)

| 결정 | 근거 |
|---|---|
| 적립을 광고 시청 트리거로 변경 | 사용자 요청. 무료 + 광고 수익 모델 정합 |
| 인트로 화면 추가 (스크린샷 패턴) | 사용자 요청, 피부건강 정보 + 리워드 어필 |
| EmojiBubble로 톤 통일 | 선크림 느낌 cute 비주얼 요청 |
| TDS Button `display="block"`으로 일괄 변경 | `full`은 BottomCTA용이라 라운드 잘림 |
| 보더 14px 통일 (큰 카드 20px 유지) | 시각 위계 + 일관성 |
| 호스팅: CF Workers Free | 사용자가 R2 보유, 무료 한도 충분, mTLS는 후속 검증 |
| DB: D1 SQLite | Workers와 한 곳, 무료 한도 넉넉 |
| Drizzle 마이그레이션 `0001_` 접두 | wrangler가 양의 정수부터만 인식 |
| dev 포트 5273 | 5173은 bible-miniapp 점유 충돌 회피 |

### 결정 로그 (2026-04-29)

| 결정 | 근거 |
|---|---|
| Wrangler 재로그인으로 D1 7403 해결 | 옛 OAuth 토큰엔 D1 query 스코프 부재 |
| CF workers.dev 서브도메인 = `hohostd` | 사용자 선택 (계정 1회성) |
| 종단 검증: 1분 슬롯 2건 cron으로 자동 발송 | mock 단계 백엔드 흐름 100% 검증 완료 |

## 6. 알려진 제약 / TODO

- [x] ~~`VITE_API_URL` prod 값~~ — 2026-04-29 완료 (`https://suncream-noti-api.hohostd.workers.dev`)
- [ ] 토스 보상형 광고 그룹 ID — 콘솔에서 발급 후 [useRewardedAd.ts](../app/src/hooks/useRewardedAd.ts#L25)
- [ ] 토스 배너 광고 그룹 ID — [BannerAdSlot.tsx](../app/src/components/BannerAdSlot.tsx#L15)
- [ ] 앱 아이콘(`brand.icon`) — 600×600 PNG, 콘솔 업로드 (디자인 진행 중, `design/` 폴더)
- [ ] 대표 썸네일 1932×828 — 콘솔 업로드용 (디자인 진행 중)
- [ ] mTLS 인증서 — 콘솔에서 발급
- [ ] 출시 전 `?reset=1` URL 핸들러 제거 검토 (보안 영향 미미하지만 클린업)
- [ ] CF 무료 플랜에서 mTLS 바인딩 가능 여부 실측 (안 되면 Deno Deploy 릴레이)
- [ ] UV 지수 / 위치 권한 (v0.3 이후)
- [ ] 토스 프로모션 API 연결 (실제 포인트 지급, v0.3)

## 7. 환경 메모

- **GitHub**: https://github.com/YeongminJ/SuncreamNoti
- **로컬 LAN IP**: 192.168.68.113 (Wi-Fi 바뀌면 `ipconfig getifaddr en0`로 갱신 후 [granite.config.ts](../app/granite.config.ts) 업데이트)
- **샌드박스 진입**: `intoss://dailysuncream`
- **Wrangler 로그인 상태**: ✅ (`npx wrangler login` 완료)
- **CF 계정 보유 리소스**: R2 (기존), D1 (오늘 생성)
