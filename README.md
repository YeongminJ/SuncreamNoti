# 선크림 알림 (Apps-in-Toss)

> 매일 권장 시간에 선크림 바르고 미세 리워드를 받는 토스 인앱 미니앱.

## 현재 상태

- ✅ 기획 완료 — [docs/PLANNING.md](./docs/PLANNING.md)
- ⏳ MVP v0.1 구현 진행

## 디렉토리 구조

```
daily_sunguard/
├── README.md
├── docs/
│   └── PLANNING.md       # 기획·결정 로그
└── app/                   # Apps-in-Toss 미니앱 (선크림 알림)
    ├── granite.config.ts
    ├── package.json
    └── src/
```

## 개발 서버 실행

```bash
cd app
npm run dev
# 샌드박스 앱에서 intoss://dailysuncream 으로 접속
```

자세한 기획·결정 사항은 [docs/PLANNING.md](./docs/PLANNING.md) 참조.
