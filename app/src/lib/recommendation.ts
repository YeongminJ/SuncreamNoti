/**
 * 피부타입(Fitzpatrick) + 환경 → 권장 도포 간격(분) / 횟수 / 슬롯 시간 계산.
 *
 * 표준 가이드(AAD, 대한피부과학회 일반 권고)를 합성한 MVP 디폴트.
 * - III(한국인 평균) = 2.5h 간격, 3회/일
 * - 실내 환경은 횟수 -1 (단 최소 2회 보장)
 * - 시작/종료 시간 사이를 분할
 */

export type SkinType = "I" | "II" | "III" | "IV" | "V_VI";
export type Environment = "indoor" | "outdoor" | "mixed";

const BASE_INTERVAL_MIN: Record<SkinType, number> = {
  I: 105, // 1시간 45분
  II: 120,
  III: 150, // 한국인 평균
  IV: 180,
  V_VI: 210,
};

export function recommendedSlotMinutes(input: {
  skinType: SkinType;
  environment: Environment;
  startMinute: number;
  endMinute: number;
}): number[] {
  const { skinType, environment, startMinute, endMinute } = input;
  const interval = BASE_INTERVAL_MIN[skinType];
  const totalSpan = Math.max(60, endMinute - startMinute);

  // 등간격 슬롯 후보 (시작 포함)
  let count = Math.max(2, Math.floor(totalSpan / interval) + 1);

  // 실내 보정: 횟수 -1 (단 2 이상 유지)
  if (environment === "indoor") count = Math.max(2, count - 1);

  // 4회를 넘기지 않도록 cap
  count = Math.min(4, count);

  const slots: number[] = [];
  if (count === 1) {
    slots.push(startMinute);
  } else {
    const step = (endMinute - startMinute) / (count - 1);
    // 마지막 슬롯이 너무 endMinute에 붙지 않도록, count-1을 권장 횟수로 사용
    // → count 횟수는 시작/끝 양쪽을 포함한 균등 분포
    for (let i = 0; i < count; i++) {
      const m = Math.round(startMinute + step * i);
      slots.push(m);
    }
  }

  // 마지막 슬롯이 endMinute과 같으면 너무 늦으니 한 칸 줄임
  if (slots.length >= 3 && slots[slots.length - 1] >= endMinute - 15) {
    slots.pop();
  }

  return slots;
}

/** 피부타입 + 환경 → 권장 도포 간격 (분). 실내·혼합 환경은 살짝 길게 풀어줌. */
export function recommendedIntervalMinutes(
  skinType: SkinType,
  environment: Environment,
): number {
  const base = BASE_INTERVAL_MIN[skinType];
  if (environment === "indoor") return base + 30;
  if (environment === "mixed") return base + 15;
  return base;
}

/** 가이드 카드용 한 줄 안내 텍스트. */
export function guidanceText(
  skinType: SkinType,
  environment: Environment,
): string {
  const interval = recommendedIntervalMinutes(skinType, environment);
  const hours = interval / 60;
  const hStr = Number.isInteger(hours)
    ? `약 ${hours}시간`
    : `약 ${hours.toFixed(1)}시간`;
  const envSuffix = {
    indoor: "실내라 횟수가 적어도 충분해요",
    outdoor: "실외 활동이 많으니 꾸준히 챙겨주세요",
    mixed: "외출 전후로 챙기면 좋아요",
  }[environment];
  return `${hStr}마다 발라주는 게 좋아요. ${envSuffix}`;
}

/**
 * 시작 시각 + 간격 기준 자동 슬롯 생성.
 * 자외선 활성 시간대(~18:00)까지만 채우고, 회당 최대 6개로 제한.
 */
export function recommendedSlotsFromStart(
  skinType: SkinType,
  environment: Environment,
  startMinute: number,
  dayEndMinute = 18 * 60,
): number[] {
  const interval = recommendedIntervalMinutes(skinType, environment);
  const slots: number[] = [];
  let cursor = startMinute;
  while (cursor <= dayEndMinute && slots.length < 6) {
    slots.push(cursor);
    cursor += interval;
  }
  return slots;
}

/** 회차별 기본 적립 (1→2원, 2→3원, 3→4원, 4→5원). */
export function baseRewardForIndex(index: number): number {
  return 2 + index;
}

/** 광고 보너스 단가 + 회차당 최대 횟수. */
export const AD_BONUS_PER_VIEW = 1;
export const AD_BONUS_MAX_PER_SLOT = 2;

export function formatHm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const mo = (d.getMonth() + 1).toString().padStart(2, "0");
  const da = d.getDate().toString().padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function nowMinuteOfDay(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function skinTypeLabel(t: SkinType): string {
  switch (t) {
    case "I":
      return "매우 흰 피부 · 항상 빨개져요";
    case "II":
      return "흰 피부 · 잘 빨개져요";
    case "III":
      return "보통 피부 · 가끔 빨개져요";
    case "IV":
      return "올리브 피부 · 잘 안 빨개져요";
    case "V_VI":
      return "갈색 / 짙은 피부";
  }
}
