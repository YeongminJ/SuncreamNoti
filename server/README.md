# suncream-noti-api

선크림 알림 미니앱의 백엔드. **Cloudflare Workers + D1 + Cron Triggers** 기반.

## 무엇을 하나

- 미니앱 클라이언트가 보낸 사용자별 권장 도포 시간을 저장
- 매 분(KST) cron으로 도래한 슬롯 사용자 찾아 토스 스마트 발송 호출
- 같은 슬롯 중복 발송 방지

> 토스 mTLS 인증서 도착 전까지는 mock 클라이언트로 동작 (콘솔 로그). `wrangler tail`로 모니터링 가능.

## 셋업 (최초 1회)

```bash
cd server
npm install

# Wrangler 로그인 (Cloudflare 계정)
npx wrangler login

# D1 데이터베이스 생성 → 출력된 database_id를 wrangler.toml에 채워주세요
npx wrangler d1 create suncream-noti-db

# 마이그레이션 적용 (로컬 + 원격)
npm run db:migrate:local
npm run db:migrate:remote
```

## 개발

```bash
# 로컬 dev (miniflare 기반, D1 자동 격리)
npm run dev

# 로컬에서 사용자 등록 테스트
curl -X POST http://localhost:8787/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "userKey":"test-user-1",
    "skinType":"III",
    "environment":"outdoor",
    "startMinute":540,
    "endMinute":1080,
    "slotMinutes":[540, 720, 900]
  }'

# 조회
curl http://localhost:8787/api/users/test-user-1

# 헬스체크
curl http://localhost:8787/api/health
```

## 배포

```bash
npm run db:migrate:remote   # 원격 D1에 마이그레이션
npm run deploy              # Workers 배포
npm run tail                # 실시간 로그 확인 (cron 발화 모니터링)
```

배포 후 엔드포인트: `https://suncream-noti-api.<your-cf-account>.workers.dev`

## 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/api/users` | 사용자 등록/업데이트 (스케줄 통째 교체) |
| `DELETE` | `/api/users` | 사용자 + 슬롯 + 발송이력 삭제 (opt-out) |
| `GET` | `/api/users/:userKey` | 디버그용 조회 |
| `GET` | `/api/health` | 헬스체크 |

`POST /api/users` 페이로드 스키마:

```ts
{
  userKey: string,           // Toss getAnonymousKey() 결과
  skinType: 'I'|'II'|'III'|'IV'|'V_VI',
  environment: 'indoor'|'outdoor'|'mixed',
  startMinute: 0..1439,      // KST 분
  endMinute: 0..1439,
  slotMinutes: number[],     // KST 분 배열, 1~8개
  timezone?: string          // default 'Asia/Seoul'
}
```

## Cron

- 스케줄: `* * * * *` (매 분, UTC)
- 핸들러: `src/cron/tick.ts`의 `runTick`
- 동작: 현재 KST 분 일치하는 슬롯 사용자 찾고, 오늘 같은 슬롯에 미발송이면 토스 sendMessage 호출

## 토스 mTLS 활성화 (인증서 도착 후)

1. 콘솔에서 클라 인증서·개인키 발급
2. `wrangler mtls-certificate upload --cert toss.crt --key toss.key --name toss-prod`
3. 출력된 `certificate_id`를 [wrangler.toml](./wrangler.toml)의 `[[mtls_certificates]]` 블록에 넣고 주석 해제
4. `src/toss/real.ts` 작성 (fetch 시 `cf: { mtlsCertificateId }` 옵션 사용)
5. `src/toss/factory.ts`에서 real 클라이언트 import
6. `wrangler.toml`의 `TOSS_MODE = "real"`로 변경
7. `npm run deploy`

## 관측

```bash
# 실시간 로그 (cron 발화 + sendMessage 로그)
npm run tail

# D1 콘솔 (CF 대시보드 또는 CLI)
npx wrangler d1 execute suncream-noti-db --command "SELECT * FROM users LIMIT 10" --remote
npx wrangler d1 execute suncream-noti-db --command "SELECT * FROM notifications ORDER BY sent_at DESC LIMIT 20" --remote
```
