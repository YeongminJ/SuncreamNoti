import { BottomSheet } from "@toss/tds-mobile";
import type { CityOption } from "../hooks/useUvIndex";

interface Props {
  open: boolean;
  onClose: () => void;
  cities: CityOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/**
 * 자외선 지수 기준 도시 선택 BottomSheet.
 * 토스 SDK 위치 권한이 샌드박스에서 제대로 안 돌아서 도시 선택 방식으로 대체.
 */
export function CityPickerSheet({
  open,
  onClose,
  cities,
  selectedId,
  onSelect,
}: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={<BottomSheet.Header>지역 선택</BottomSheet.Header>}
      maxHeight={520}
    >
      <div style={{ padding: "8px 0 24px" }}>
        {cities.map((c) => {
          const selected = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c.id);
                onClose();
              }}
              style={{
                width: "100%",
                padding: "14px 24px",
                background: selected ? "#EFF6FF" : "transparent",
                border: "none",
                textAlign: "left",
                fontSize: 16,
                fontWeight: selected ? 700 : 500,
                color: selected ? "#2563EB" : "#0F172A",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span>{c.name}</span>
              {selected && <span style={{ fontSize: 14 }}>✓</span>}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
