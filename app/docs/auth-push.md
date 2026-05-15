# 로그인 / 푸시 알림 — 아키텍처와 함정

선크림 알림 앱의 토스 로그인, 사용자 식별, 푸시 알림 발송 흐름 전반을 정리한 문서. 5/15 사고 이후 작성. 같은 영역 작업 시 먼저 읽고 시작할 것.

## 전체 흐름 한 눈에

```
[클라]                                    [서버 Cloudflare Workers]      [토스 SDK]
 진입
  │
  ├─ getAnonymousKey() ─────────────────────────────────────────────────► 토스 SDK
  │   해시 문자열 반환 (디바이스·앱별 고유)
  │   ↓ userKey
  │
  ├─ POST /api/auth/status ──────────────► users 테이블 SELECT
  │   { tossUserKey } 응답                 매핑 안 됐으면 null
  │
  ├─ 매핑 있음 → setSkipped + setTossUserKey → 끝 (홈으로)
  │
  ├─ 매핑 없음 → appLogin() ───────────────────────────────────────────► 토스 SDK
  │   { authorizationCode, referrer }      토스 동의 화면 표시
  │
  ├─ POST /api/auth/login ───────────────► users 행 존재 확인
  │   { authorizationCode } 전달            ├─ 없으면 404 user_not_registered
  │                                         ├─ generateOauth2Token (mTLS)
  │                                         ├─ getLoginMe (mTLS)
  │                                         └─ users.toss_user_key UPDATE
  │   ↓ tossUserKey
  │
  ├─ 404 user_not_registered → 로컬 profile로 registerUser 호출 → 재시도
  │
  ├─ POST /api/users (온보딩 또는 슬롯 동기화 시) ► users + user_slots batch upsert
  │
  └─ 슬롯 동기화 검증
      GET /api/users/:userKey → 서버 slots와 로컬 slotMinutes 비교
      불일치 시 registerUser 재호출

[Cron 매분 발송]
  Cloudflare Workers Cron Trigger (* * * * * UTC)
   │
   ├─ 현재 KST 분 계산
   ├─ user_slots ⨝ users WHERE slot_minute = ? AND toss_user_key IS NOT NULL
   ├─ notifications 멱등 체크 ((userKey, date, slotMinute) UNIQUE)
   └─ Toss /api-partner/v1/.../send-message (mTLS, x-toss-user-key 헤더)
       templateSetCode + context 전달
```

## 핵심 데이터 모델

`server/src/db/schema.ts`:

- **`users`**: PK=`user_key` (토스 anonymousKey 해시). `toss_user_key`(numeric)는 nullable — 토스 로그인 완료 후 채워짐. `skin_type` / `environment` / `start_minute` / `end_minute` / `timezone` 은 NOT NULL → **온보딩 완료 전엔 행 자체가 안 만들어짐**.

- **`user_slots`**: `(user_key, slot_minute)` 복합 PK. 한 사용자가 여러 슬롯 가짐. 슬롯이 비어있으면 cron이 매칭 못 함.

- **`notifications`**: 발송 이력. `(user_key, date, slot_minute)` UNIQUE → 같은 슬롯에 중복 발송 차단.

## 클라이언트 진입 시 useEffect 4단계 (App.tsx)

1. **사전 매핑 조회** — `fetchAuthStatus` 한 방으로 매핑 있는 재방문자는 토스 로그인창 스킵
2. **화면 결정 라우팅** — profile 있으면 home, 없으면 onboarding / welcome
3. **로그인 후 매핑 갱신 + 자동 복구** — `loginWithToss` 호출. 서버가 `user_not_registered` 반환하면 로컬 profile로 `registerUser` 재호출 후 retry. anonymousKey 갱신된 재방문자 자동 복구용.
4. **슬롯 동기화 검증** — 로컬 `profile.slotMinutes` ↔ 서버 `user_slots` 불일치 시 `registerUser`로 강제 동기화. 과거 `users.ts` 비트랜잭션 부분 실패 잔재 회복용.

## ⚠️ 빠지기 쉬운 함정

### 1. `VITE_API_URL` 미설정 = 모든 사용자 번들에 `localhost:8787` 박힘

`app/src/lib/api.ts`의 fallback이 `http://localhost:8787`. `.env.local`이 없으면 vite가 환경변수 못 찾고 fallback 적용 → **번들에 localhost가 박혀 토스 인앱에서 모든 서버 호출 실패**. 5/15에 26명 사용자가 `toss_user_key` NULL, 6명이 `user_slots` 빈 상태로 누적된 원인.

**예방**: `app/vite.config.ts`에 빌드 가드 있음 (`VITE_API_URL` 누락 또는 localhost면 build 실패). 새 환경에서 빌드 전 `app/.env.local` 채워야 함:

```sh
# app/.env.local
VITE_API_URL=https://suncream-noti-api.hohostd.workers.dev
```

### 2. `POST /api/users`는 batch atomic이어야 함

`server/src/routes/users.ts`에서 `users` upsert + `user_slots` delete + insert를 `db.batch([...])` 한 묶음으로 처리. 비트랜잭션 순차 await로 짜면 delete만 되고 insert 실패하는 부분 사고 발생 — 사용자 행은 있는데 슬롯이 비어 cron이 영구 누락. 절대 개별 await로 되돌리지 말 것.

### 3. `loginWithToss`는 `users` 행이 있어야 동작

`/api/auth/login` 라우트는 행 없으면 즉시 `user_not_registered`로 거부. 그래서 진입 흐름은 반드시 **온보딩에서 `registerUser` 먼저 → `loginWithToss` 나중** 순서. 단, App.tsx step 3에 자동 복구 fallback이 있어서 anonymousKey 갱신 재방문자도 로컬 profile로 자동 회복됨.

### 4. anonymousKey는 디바이스마다 다름

토스 `getAnonymousKey()`는 디바이스+앱 조합 해시. 사용자가 앱 재설치하거나 다른 디바이스로 접속하면 새 key. 이때 로컬 storage가 새 디바이스엔 없어서 온보딩부터 시작 → 같은 토스 사용자라도 서버 행은 별개. 토스 키(`tossUserKey`)는 사용자 식별의 안정적 기준이지만, 우리 PK는 anonymousKey라 그 둘이 1:1이 아닐 수 있음.

### 5. CF Workers Cron은 가끔 분 트리거를 놓침

`schedule: * * * * *`로 매분 발화 의도지만, SLA 없음. 5/15 08:00 KST 분 발송이 0건이었던 적 있음 (06:00=3, 07:00=12, 08:00=0, 09:00=16). catch-up 로직(직전 분 외 최근 N분 미발송 슬롯 재조회)을 넣으면 누락 완화 가능. 미구현 상태.

### 6. 인가코드는 단발성, 10분 유효

`appLogin` 결과의 `authorizationCode`는 한 번 소비되면 끝. 서버 `/api/auth/login`이 토큰 교환에 사용 → 한 진입당 1회만 호출 가능. step 3 retry 로직은 404로 차단되기 전(토큰 교환 안 들어감)이라 안전하게 동일 코드로 재호출 가능.

## 디버그 도구

### `?whoami=1` 칩 (운영자 전용)

진입 URL 끝에 `?whoami=1` 또는 `&whoami=1` 붙이면 우상단에 디버그 칩 표시:
- `uk`: 본인 anonymousKey
- `tuk`: 본인 토스 numeric key (`—`이면 매핑 안 됨)
- `auth`: `idle / pending / loggedIn / skipped / failed` 중 하나

토스 deeplink (`intoss-private://...`)에 쿼리를 그대로 못 붙이는 환경에선 슬랙에 URL 올려서 탭하면 WebView까지 쿼리 전달 확인됨.

### D1 콘솔 진단 쿼리

본인 식별:
```sql
SELECT u.*, datetime(u.updated_at/1000, 'unixepoch', '+9 hours') updated_kst
FROM users u WHERE u.toss_user_key = <칩의 tuk 숫자>;
```

영향 받은 사용자 가늠:
```sql
-- toss_user_key NULL인 사용자 (loginWithToss 실패자)
SELECT COUNT(*) FROM users WHERE toss_user_key IS NULL;

-- 행은 있는데 user_slots 비어있는 사용자 (부분 실패 잔재)
SELECT u.user_key FROM users u
LEFT JOIN user_slots us ON us.user_key = u.user_key
WHERE us.user_key IS NULL;
```

분 단위 발송 통계:
```sql
SELECT slot_minute, status, COUNT(*) cnt FROM notifications
WHERE date = '2026-05-15'
GROUP BY slot_minute, status ORDER BY slot_minute;
```

## 배포 절차

**서버 (Cloudflare Workers)**:
```sh
cd server
unset CLOUDFLARE_API_TOKEN   # OAuth 모드로 진입
npx wrangler whoami          # prjym87@gmail.com 확인
npm run deploy
```

**클라 (토스 미니앱)**:
```sh
cd app
# .env.local에 VITE_API_URL 채워져있는지 확인
npm run build  # 빌드 가드가 환경변수 검증
npm run deploy # ait deploy
```

배포 결과로 `_deploymentId`가 박힌 deeplink URL 출력. 슬랙 등에 올려서 폰에서 탭하면 새 번들 진입.

**중요**: `_deploymentId` 쿼리는 특정 빌드를 가리키는 핀이라 옛 deeplink는 옛 번들로 진입. 새 코드 확인하려면 새 배포 후 새 deeplink 사용.

## 관련 파일

- 클라 진입 흐름: `app/src/App.tsx`
- API 호출 함수: `app/src/lib/api.ts`
- 디버그 칩: `app/src/components/WhoAmIBadge.tsx`
- 빌드 가드: `app/vite.config.ts`
- 인증 라우트: `server/src/routes/auth.ts`
- 사용자 라우트(batch): `server/src/routes/users.ts`
- Cron 발송: `server/src/cron/tick.ts`
- DB 스키마: `server/src/db/schema.ts`
- 토스 API 클라이언트: `server/src/toss/real.ts`
