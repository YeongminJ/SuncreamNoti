import { create } from "zustand";
import { readJSON, writeJSON } from "../lib/storage";
import {
  AD_BONUS_MAX_PER_SLOT,
  AD_BONUS_PER_VIEW,
  baseRewardForIndex,
  todayKey,
} from "../lib/recommendation";

const STORAGE_PREFIX = "sunalarm.day.v1.";
const TOTALS_KEY = "sunalarm.totals.v1";

export interface SlotRecord {
  /** 권장 시각 (분) */
  targetMinute: number;
  /** 적립한 epoch ms (null이면 미적립) */
  appliedAt: number | null;
  /** 회차 기본 적립금 (적립 시 확정) */
  baseReward: number;
  /** 광고 시청 횟수 (0~AD_BONUS_MAX_PER_SLOT) */
  adBonusCount: number;
  /** 광고로 받은 누적 보너스 */
  adBonusReward: number;
}

export interface DayRecord {
  date: string;
  slots: SlotRecord[];
}

export interface Totals {
  lifetimeReward: number;
  /** 토스 포인트로 이미 교환한 누적 금액 */
  redeemedReward: number;
  lastActiveDate: string | null;
  streak: number;
}

function dayStorageKey(date: string): string {
  return `${STORAGE_PREFIX}${date}`;
}

function freshDay(date: string, slotMinutes: number[]): DayRecord {
  return {
    date,
    slots: slotMinutes.map((m, i) => ({
      targetMinute: m,
      appliedAt: null,
      baseReward: baseRewardForIndex(i),
      adBonusCount: 0,
      adBonusReward: 0,
    })),
  };
}

interface DayState {
  /** 현재 보고 있는 날짜의 기록. 없으면 null. */
  day: DayRecord | null;
  totals: Totals;
  /** 오늘자 day 기록을 보장(없으면 생성)하고 반환 — slotMinutes는 프로필 변경 대응용. */
  ensureToday: (slotMinutes: number[]) => DayRecord;
  /** 슬롯에 발랐다고 표시 + 기본 리워드 누적. */
  applySlot: (slotIndex: number) => SlotRecord | null;
  /** 광고 시청 후 보너스 누적. */
  addAdBonus: (slotIndex: number) => SlotRecord | null;
  /** 토스 포인트로 교환 성공 시 누적 차감용. */
  markRedeemed: (amount: number) => void;
  reset: () => void;
}

export const useDayStore = create<DayState>((set, get) => ({
  day: readJSON<DayRecord | null>(dayStorageKey(todayKey()), null),
  totals: readJSON<Totals>(TOTALS_KEY, {
    lifetimeReward: 0,
    redeemedReward: 0,
    lastActiveDate: null,
    streak: 0,
  }),

  ensureToday: (slotMinutes) => {
    const date = todayKey();
    const key = dayStorageKey(date);
    const existing = readJSON<DayRecord | null>(key, null);

    // 슬롯 시각이 같으면 그대로 사용, 아니면 새로 생성 (기록 보존: 비교 후 maintain)
    if (
      existing &&
      existing.slots.length === slotMinutes.length &&
      existing.slots.every((s, i) => s.targetMinute === slotMinutes[i])
    ) {
      set({ day: existing });
      return existing;
    }

    const next = freshDay(date, slotMinutes);
    // 기존 적립 기록은 슬롯 정렬 시 보존 시도 (target 분 기준 매칭)
    if (existing) {
      next.slots = next.slots.map((slot) => {
        const prev = existing.slots.find(
          (s) => s.targetMinute === slot.targetMinute,
        );
        return prev ? { ...slot, ...prev, baseReward: slot.baseReward } : slot;
      });
    }
    writeJSON(key, next);
    set({ day: next });
    return next;
  },

  applySlot: (slotIndex) => {
    const day = get().day;
    if (!day) return null;
    const slot = day.slots[slotIndex];
    if (!slot || slot.appliedAt != null) return slot ?? null;

    const updatedSlot: SlotRecord = { ...slot, appliedAt: Date.now() };
    const updatedSlots = day.slots.map((s, i) =>
      i === slotIndex ? updatedSlot : s,
    );
    const updatedDay: DayRecord = { ...day, slots: updatedSlots };
    writeJSON(dayStorageKey(day.date), updatedDay);

    const totals = get().totals;
    const dateChanged = totals.lastActiveDate !== day.date;
    const isFirstApplyToday = day.slots.every((s) => s.appliedAt == null);
    const updatedTotals: Totals = {
      lifetimeReward: totals.lifetimeReward + updatedSlot.baseReward,
      lastActiveDate: day.date,
      // 첫 발림이면 streak 갱신
      streak: dateChanged && isFirstApplyToday ? totals.streak + 1 : totals.streak,
    };
    writeJSON(TOTALS_KEY, updatedTotals);

    set({ day: updatedDay, totals: updatedTotals });
    return updatedSlot;
  },

  addAdBonus: (slotIndex) => {
    const day = get().day;
    if (!day) return null;
    const slot = day.slots[slotIndex];
    if (!slot || slot.adBonusCount >= AD_BONUS_MAX_PER_SLOT) return slot ?? null;

    const updatedSlot: SlotRecord = {
      ...slot,
      adBonusCount: slot.adBonusCount + 1,
      adBonusReward: slot.adBonusReward + AD_BONUS_PER_VIEW,
    };
    const updatedSlots = day.slots.map((s, i) =>
      i === slotIndex ? updatedSlot : s,
    );
    const updatedDay: DayRecord = { ...day, slots: updatedSlots };
    writeJSON(dayStorageKey(day.date), updatedDay);

    const totals = get().totals;
    const updatedTotals: Totals = {
      ...totals,
      lifetimeReward: totals.lifetimeReward + AD_BONUS_PER_VIEW,
    };
    writeJSON(TOTALS_KEY, updatedTotals);

    set({ day: updatedDay, totals: updatedTotals });
    return updatedSlot;
  },

  markRedeemed: (amount) => {
    if (amount <= 0) return;
    const totals = get().totals;
    const updated: Totals = {
      ...totals,
      redeemedReward: totals.redeemedReward + amount,
    };
    writeJSON(TOTALS_KEY, updated);
    set({ totals: updated });
  },

  reset: () => {
    const t: Totals = {
      lifetimeReward: 0,
      redeemedReward: 0,
      lastActiveDate: null,
      streak: 0,
    };
    writeJSON(TOTALS_KEY, t);
    set({ totals: t, day: null });
  },
}));

/** 아직 토스 포인트로 교환하지 않은 잔여 적립금. */
export function redeemableAmount(totals: Totals): number {
  return Math.max(0, totals.lifetimeReward - totals.redeemedReward);
}

/** 가장 빨리 발려야 하는 미완료 슬롯 인덱스. 모두 끝났으면 -1. */
export function nextOpenSlotIndex(day: DayRecord | null): number {
  if (!day) return -1;
  for (let i = 0; i < day.slots.length; i++) {
    if (day.slots[i].appliedAt == null) return i;
  }
  return -1;
}

/** 오늘 적립한 합계 (기본 + 광고 보너스). */
export function totalEarnedToday(day: DayRecord | null): number {
  if (!day) return 0;
  return day.slots.reduce(
    (acc, s) =>
      acc + (s.appliedAt != null ? s.baseReward : 0) + s.adBonusReward,
    0,
  );
}

/** 오늘 완료한 슬롯 수. */
export function completedSlotCount(day: DayRecord | null): number {
  if (!day) return 0;
  return day.slots.filter((s) => s.appliedAt != null).length;
}
