import { BottomSheet, Button } from "@toss/tds-mobile";
import { useEffect, useMemo, useState } from "react";
import { useBackHandler } from "../lib/backHandler";
import { CTA_GRADIENT_STYLE } from "../lib/buttonStyle";
import { formatHm } from "../lib/recommendation";

const HOUR_GRID: number[] = Array.from(
  { length: 11 },
  (_, i) => (6 + i) * 60,
);
const MAX_SLOTS = 4;

interface Props {
  open: boolean;
  currentSlots: number[];
  lockedSlots?: number[];
  onClose: () => void;
  onApply: (slotMinutes: number[]) => void;
}

export function ScheduleEditSheet({
  open,
  currentSlots,
  lockedSlots = [],
  onClose,
  onApply,
}: Props) {
  const lockedSet = useMemo(() => new Set(lockedSlots), [lockedSlots]);
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(
    () => new Set(currentSlots),
  );

  useEffect(() => {
    if (!open) return;
    setSelectedSlots(new Set(currentSlots));
  }, [open, currentSlots]);

  useBackHandler(open, onClose);

  const sortedSlots = useMemo(
    () => [...selectedSlots].sort((a, b) => a - b),
    [selectedSlots],
  );
  const visibleSlotGrid = useMemo(
    () => [...new Set([...HOUR_GRID, ...currentSlots])].sort((a, b) => a - b),
    [currentSlots],
  );

  const changed = useMemo(() => {
    const base = [...currentSlots].sort((a, b) => a - b);
    return (
      base.length !== sortedSlots.length ||
      base.some((m, i) => m !== sortedSlots[i])
    );
  }, [currentSlots, sortedSlots]);

  const toggleSlot = (minute: number) => {
    if (lockedSet.has(minute)) return;
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(minute)) {
        next.delete(minute);
      } else if (next.size < MAX_SLOTS) {
        next.add(minute);
      } else {
        const replaceTarget = [...next]
          .filter((m) => !lockedSet.has(m))
          .sort((a, b) => Math.abs(a - minute) - Math.abs(b - minute))[0];
        if (replaceTarget != null) {
          next.delete(replaceTarget);
          next.add(minute);
        }
      }
      return next;
    });
  };

  const apply = () => {
    if (sortedSlots.length === 0 || !changed) return;
    onApply(sortedSlots);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={<BottomSheet.Header>시간 수정</BottomSheet.Header>}
      maxHeight={620}
    >
      <div style={{ padding: "0 20px 24px" }}>
        <div
          style={{
            background: "#FFF3EC",
            border: "1px solid #FFD9C2",
            borderRadius: 14,
            padding: "13px 14px",
            color: "#7A3A12",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          자외선이 강한 낮 시간대만 골라요. 최대 4개가 찬 상태에서 새 시간을 누르면
          가까운 미완료 시간이 바뀌어요.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {visibleSlotGrid.map((minute) => {
            const selected = selectedSlots.has(minute);
            const locked = lockedSet.has(minute);
            return (
              <button
                key={minute}
                type="button"
                onClick={() => toggleSlot(minute)}
                disabled={locked}
                style={{
                  minHeight: 46,
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 800,
                  background: selected ? "#FF9B3C" : "#F8FAFC",
                  color: selected ? "#FFFFFF" : "#0F172A",
                  border: `1px solid ${selected ? "#FF9B3C" : "#E2E8F0"}`,
                  cursor: locked ? "default" : "pointer",
                  opacity: locked ? 0.72 : 1,
                  WebkitTapHighlightColor: "transparent",
                  WebkitAppearance: "none",
                  appearance: "none",
                }}
              >
                {formatHm(minute)}
              </button>
            );
          })}
        </div>

        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#64748B",
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            일일 {sortedSlots.length}번 바르기
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {sortedSlots.map((minute) => (
              <span
                key={minute}
                style={{
                  padding: "6px 11px",
                  borderRadius: 999,
                  background: lockedSet.has(minute) ? "#DCFCE7" : "#FFE7D6",
                  color: lockedSet.has(minute) ? "#047857" : "#C2410C",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {formatHm(minute)}
              </span>
            ))}
          </div>
          {sortedSlots.length >= MAX_SLOTS && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#94A3B8" }}>
              하루 최대 {MAX_SLOTS}회까지 설정할 수 있어요.
            </div>
          )}
        </div>

        <Button
          size="large"
          display="block"
          onClick={apply}
          disabled={sortedSlots.length === 0 || !changed}
          style={CTA_GRADIENT_STYLE}
        >
          적용하기
        </Button>
      </div>
    </BottomSheet>
  );
}
