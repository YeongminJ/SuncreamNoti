# 선크림 알림 — 기획 문서

> Apps-in-Toss 기반 데일리 선크림 도포 알림 + 미세 리워드 미니앱.
> 결정 사항이 바뀌면 이 문서를 업데이트한다.

## 1. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 플랫폼 | Apps-in-Toss (Toss 앱 내 미니앱, Web 트랙) |
| 디스플레이명 | **선크림 알림** |
| appName | `dailysuncream` |
| 카테고리 | 비게임 유틸 (헬스케어/뷰티) — TDS 필수 |
| 기준일 | 2026-04-28 |

### 한 줄 컨셉

> 매일 권장 시간에 선크림 바르고 토스 포인트(or 광고 리워드) 챙기기.

### MVP 제약

- **백엔드 없음** — 클라이언트 only. 토스 프로모션·스마트 발송(푸시)은 v0.2에서 도입.
- 리워드는 광고 보상형(`showAdMobRewardedAd`) + 누적 카운트로만 동작.
- 알림은 OS 푸시 대신 "앱 재진입 시 누락 표시 + 슬롯 도달 시 unlock"으로 시뮬레이션.

## 2. 기술 스택 (참고 앱과 동일)

| 영역 | 결정 | 비고 |
|---|---|---|
| 플랫폼 | Web (`@apps-in-toss/web-framework`) | RN 대비 빠른 반복 |
| UI | `@toss/tds-mobile` + `@toss/tds-mobile-ait` | 비게임 심사 요건 |
| 언어 | TypeScript | — |
| 번들러 | Vite | — |
| 상태 | zustand | 단일 store 분할 |
| 애니메이션 | framer-motion | 카운트다운·전환 |
| 저장소 | localStorage (MVP) → Native Storage(v0.2) | — |
| 광고 | 보상형(rewarded) + 배너(BannerAd WebView) | 테스트 ID로 시작 |

## 3. 도메인 가이드라인 — 선크림 재도포

### 표준 권장 (피부과 일반론, MVP 디폴트)

| Fitzpatrick | 한국인 분포 | 재도포 간격 | 권장 횟수 |
|---|---|---|---|
| I (매우 흰, 항상 탐) | 드묾 | 1.5~2시간 | 4회 |
| II (흰, 잘 탐) | 일부 | 2시간 | 3~4회 |
| **III (보통, 가끔 탐)** | **평균** | **2.5~3시간** | **3회** |
| IV (올리브) | 일부 | 3시간 | 2~3회 |
| V/VI (갈색~검은) | 드묾 | 3.5~4시간 | 2회 |

### 활동·환경 보정

- **실내(사무직 등)**: 권장 횟수 -1, 단 창가 좌석은 유지
- **실외(통근/운동)**: 기본 권장 유지
- **수영·격한 운동**: 80분 룰 (별도 안내, MVP 미반영)
- **UV 지수 8 이상**: 간격 -1시간 (v0.2에서 위치 기반 적용)

### 출처

- 표준 가이드는 AAD(미국피부과학회), 대한피부과학회, KCDC의 일반 권고를 합성한 것.
- **TODO (v0.1.1)**: 한국 보건당국·대한피부과학회 최신 가이드 URL을 검색해 본 문서에 병기.

## 4. MVP v0.1 범위

### 포함

- **온보딩(1회)** — 피부타입 4지선다, 환경(실내/실외), 시작/종료 시간 → 권장 스케줄 계산
- **홈** — 진행 카드 + 다음 발림까지 카운트다운 + 슬롯 리스트 + "지금 발랐어요" CTA + 배너 광고
- **발림 확인** — 슬롯 시간 도달 후 unlock → 누름 → 기본 리워드 적립 → "광고 보고 +N원" 옵션
- **시간 잠금** — 다음 슬롯 시간 전엔 CTA disabled, 카운트다운 표시
- **하루 누적/총 누적 리워드** 표시
- **로컬 저장** — 온보딩 결과·일자별 슬롯 상태·누적 리워드

### v0.2 이후

- **백엔드 + 토스 프로모션 API** → 진짜 토스 포인트 지급
- **스마트 발송(푸시)** → 슬롯 시간에 알림 발송 (서버 cron + `sendMessage`) — [server/](../server/) 스캐폴딩 완료
- **위치 권한 + UV 지수** 표시 및 간격 자동 보정
- **연속 출석/배지** 시스템
- **공유 리워드** (`contactsViral`)
- **수영/운동 모드** (80분 룰)

## 서버 아키텍처 (v0.2 진행 중)

`server/` 디렉토리에 Cloudflare Workers 기반 백엔드 스캐폴딩 완료. 자세한 운영 가이드는
[server/README.md](../server/README.md) 참조.

| 영역 | 선택 | 비용 |
|---|---|---|
| 런타임 | Cloudflare Workers (Free) | ₩0 (10만 req/일 한도) |
| DB | D1 (SQLite) | ₩0 (5M reads/일 + 25GB) |
| Cron | Workers Cron Triggers | ₩0 (무제한) |
| 객체 스토리지 | R2 (선택) | ₩0 |
| 토스 mTLS | `mtls_certificates` 바인딩 | 무료 플랜 검증 필요 — 막히면 Deno Deploy/GH Actions 릴레이로 폴백 |

핵심 흐름:
1. 클라가 온보딩 완료 시 `getAnonymousKey()` → `POST /api/users`로 스케줄 등록
2. CF Cron `* * * * *` (매 분, UTC) → `scheduled()` 핸들러 → KST 분 변환 후 D1 query
3. 도래한 슬롯 사용자에게 `sendMessage` (현재는 mock 콘솔 로그)
4. `notifications` 테이블에 (userKey, date, slotMinute) unique로 중복 방지

스키마: `users` / `user_slots` / `notifications` (자세한 건 [server/src/db/schema.ts](../server/src/db/schema.ts)).

## 5. 리워드 구조 (확정)

> **모든 적립은 보상형 광고 시청을 트리거로 발생.** "지금 발랐어요"를 눌러도
> 광고를 보지 않으면 적립되지 않아요. 회차마다 **첫 광고**가 기본 적립을, 이후
> **추가 광고**(최대 2회)가 보너스를 줘요.

| 회차 | 첫 광고 (기본) | 추가 광고 보너스 | 회차 최대 광고 | 회차 최대 적립 |
|---|---|---|---|---|
| 1회차 | 2원 | +1원 × 최대 2회 | 3회 | 4원 |
| 2회차 | 3원 | +1원 × 최대 2회 | 3회 | 5원 |
| 3회차 | 4원 | +1원 × 최대 2회 | 3회 | 6원 |
| **3회차 합계** | **9원** | **+6원** | **9회** | **최대 15원/일** |

- **배너 광고**: 슬롯 리스트 아래 항상 표시 (`BannerAd` WebView)
- **MVP에서는 가상 적립** — `localStorage`에 누적, 실 지급 X. v0.2에서 토스 프로모션 연동.

## 6. 권한 / 외부 의존

| 항목 | MVP | v0.2 |
|---|---|---|
| 위치 (`getCurrentLocation`) | ❌ | ✅ (UV 보정용) |
| 알림 / 푸시 | ❌ (서버 필요) | ✅ 스마트 발송 |
| 카메라/사진 | ❌ | ❌ |
| 광고 SDK | ✅ 보상형 + 배너(테스트 ID) | ✅ 운영 ID |
| 토스 로그인 | ❌ | ⚠ 검토 (디바이스 변경 시 누적 유지용) |
| 토스 프로모션 | ❌ | ✅ |

## 7. 화면 구성 (MVP)

```
[Onboarding (최초 1회)]
  Step1: 피부타입 (Fitzpatrick 4지선다)
  Step2: 환경 (실내 / 실외 / 혼합)
  Step3: 시작·종료 시간 (기본 09:00 ~ 18:00)
  → 추천 스케줄 미리보기 → 시작
        ↓
[Home]
  Top: "선크림 알림", subtitle: "오늘 X / N 회 발랐어요 · 누적 N원"
  Card: 다음 발림까지 카운트다운 (또는 "지금 발라요!")
  List: 슬롯 N개 (시간 / 상태배지 / 회차별 리워드)
        - 완료 / 진행중(unlock) / 잠김 / 놓침
  CTA: "지금 발랐어요" (잠금 시 disabled + 카운트다운)
  Banner Ad
        ↓ (CTA 누름)
[ApplyResult]
  애니메이션 + "잘 발랐어요!"
  적립: +N원
  옵션: "광고 보고 +1원" × 최대 2회
  "확인" → Home
```

## 8. 로컬 데이터 스키마 (localStorage)

```ts
// onboarding 결과
key: "sunalarm.profile.v1"
{
  skinType: "I" | "II" | "III" | "IV" | "V_VI";
  environment: "indoor" | "outdoor" | "mixed";
  startMinute: number;   // 0~1439, e.g., 540 = 09:00
  endMinute: number;     // e.g., 1080 = 18:00
  completedAt: number;   // epoch ms
}

// 일자별 상태
key: "sunalarm.day.v1.YYYY-MM-DD"
{
  date: "YYYY-MM-DD";
  slots: Array<{
    targetMinute: number;       // 권장 시각
    appliedAt: number | null;   // 적립 시간
    baseReward: number;         // 2/3/4
    adBonusCount: 0 | 1 | 2;    // 광고로 받은 횟수
    adBonusReward: number;      // adBonusCount * 1원
  }>;
}

// 누적
key: "sunalarm.totals.v1"
{
  lifetimeReward: number;
  lastActiveDate: "YYYY-MM-DD";
  streak: number;
}
```

## 9. 토스 인앱 SDK 사용 (MVP)

| API | 용도 |
|---|---|
| `loadAdMobRewardedAd` / `showAdMobRewardedAd` | 회차별 +1원 보너스 (`useRewardedAd`) |
| `BannerAd` (WebView) | 홈 하단 배너 |
| `Analytics.screen/click/impression` | 화면·CTA 로깅 (`lib/track.ts`) |
| `getOperationalEnvironment` | sandbox/dev 자동 테스트 ID 전환 |
| `generateHapticFeedback` | "발랐어요" 누름 피드백 |

## 10. 결정 로그

| 일자 | 결정 | 비고 |
|---|---|---|
| 2026-04-28 | 컨셉 확정: 선크림 도포 알림 + 미세 리워드 | — |
| 2026-04-28 | 디스플레이명 = **선크림 알림**, appName = `dailysuncream` | — |
| 2026-04-28 | 카테고리 = 비게임 유틸 | TDS 필수 |
| 2026-04-28 | MVP는 백엔드 없이 클라이언트 only | 푸시·진짜 포인트는 v0.2 |
| 2026-04-28 | 리워드 = 2/3/4원 누적 + 광고 회당 +1원(최대 2회) | 일 최대 15원 |
| 2026-04-28 | 슬롯 리스트 아래 배너 광고 1개 | BannerAd (WebView) |
| 2026-04-28 | 알림은 v0.2 스마트 발송으로 분리 | 서버 cron 필요 |
| 2026-04-28 | **모든 적립을 광고 시청 트리거로 변경** | 첫 광고=기본, 추가 광고=보너스 (회차당 +2회까지) |
