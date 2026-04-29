# 선크림 알림 — 앱인토스 제출용 에셋

모든 이미지는 HTML/CSS로 제작한 뒤 headless Chrome으로 PNG 변환합니다. 소스 HTML을 수정하고 아래 명령을 다시 실행하면 재생성됩니다.

## 최종 파일

| 용도 | 규격 | 파일 | 소스 |
|---|---|---|---|
| 앱 로고 아이콘 | 600×600 | [out/logo.png](./out/logo.png) | [logo.html](./logo.html) |
| 가로형 썸네일 | 1932×828 | [out/thumbnail.png](./out/thumbnail.png) | [thumbnail.html](./thumbnail.html) |
| 스크린샷 1 — 인트로 | 636×1048 | [out/screenshot-1.png](./out/screenshot-1.png) | [screenshot-1.html](./screenshot-1.html) |
| 스크린샷 2 — 홈 | 636×1048 | [out/screenshot-2.png](./out/screenshot-2.png) | [screenshot-2.html](./screenshot-2.html) |
| 스크린샷 3 — 적립 결과 | 636×1048 | [out/screenshot-3.png](./out/screenshot-3.png) | [screenshot-3.html](./screenshot-3.html) |

## 디자인 컨셉

- **메인 컬러**: 따뜻한 오렌지 그라디언트 `#FF9B3C → #FF7E2E → #E04E15`
- **액센트**: 노랑 `#FFD66B`, 크림 `#FFF6D6`
- **핵심 비주얼**: 동그란 선크림 튜브(SVG) + 우측 상단 작은 해 + 사방으로 퍼지는 광선
- **라벨**: 튜브 정면에 `SPF 50+` 텍스트로 즉시 식별성 확보
- **다크모드 호환**: 따뜻한 오렌지 베이스라 라이트/다크 양쪽 OS에서 자연스러움
- **저작권 안전**: 이모지 미사용, 모든 일러스트는 인라인 SVG로 직접 그림

## 토스 가이드 준수

- ✅ 600×600 정사각, solid background (투명 배경 없음)
- ✅ 안전영역 440×440 내 핵심 콘텐츠(튜브 + "선크림 알림" + "SUNCREAM NOTI") 배치
- ✅ 원형 크롭되어도 핵심 요소 보존되도록 외곽 60px 여백 + 골드 링
- ✅ 일반 sun 아이콘만 쓰지 않고 선크림 튜브 + 햇살 조합으로 차별화
- ✅ 배경이 너무 화이트/블랙이 아닌 따뜻한 오렌지 → 다크모드에서도 자연스러움
- ✅ 토스 제공 아이콘·이미지·로고 미사용

## 재생성 명령

### A. 로컬 Chrome으로 (권장)

```bash
cd /Users/m/claude_workspace/daily_sunguard/design
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="$PWD/out"

"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=600,600 --screenshot="$OUT/logo.png" \
  "file://$PWD/logo.html"

"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1932,828 --screenshot="$OUT/thumbnail.png" \
  "file://$PWD/thumbnail.html"

for n in 1 2 3; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --window-size=636,1048 --screenshot="$OUT/screenshot-$n.png" \
    "file://$PWD/screenshot-$n.html"
done

file "$OUT/logo.png" "$OUT/thumbnail.png" "$OUT"/screenshot-*.png
```

### B. Puppeteer 번들 Chromium으로 (대체)

로컬에 Chrome이 없거나 샌드박스에서 `/Applications` 접근이 막힌 경우:

```bash
cd /Users/m/claude_workspace/daily_sunguard/design
npm install                # puppeteer 설치
npm run install-chrome     # ./.chromium 에 Chrome for Testing 다운로드
npm run render             # logo.png, thumbnail.png, screenshot-{1,2,3}.png 생성

file out/logo.png out/thumbnail.png out/screenshot-*.png
```
