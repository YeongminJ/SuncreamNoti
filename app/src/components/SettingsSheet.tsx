import { BottomSheet, Switch } from "@toss/tds-mobile";
import { useBackHandler } from "../lib/backHandler";

interface Props {
  open: boolean;
  onClose: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  busy?: boolean;
  errorMessage?: string | null;
}

/**
 * 홈 우상단 ⚙️ 진입로의 BottomSheet.
 *
 * - 알림 켜기/끄기 토글: 토스 가이드의 "수신 해제 기능 제공" 요건 충족용.
 *   토글 상태는 서버 `users.notifications_disabled` 와 동기화돼요.
 * - 별도 동의 모달을 띄우지 않기로 한 결정과 짝을 이루는 진입로.
 */
export function SettingsSheet({
  open,
  onClose,
  notificationsEnabled,
  onToggleNotifications,
  busy,
  errorMessage,
}: Props) {
  useBackHandler(open, onClose);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={<BottomSheet.Header>설정</BottomSheet.Header>}
      maxHeight={420}
    >
      <div
        style={{
          padding: "0 20px 24px",
          color: "#334155",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 0",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#0F172A",
                marginBottom: 4,
              }}
            >
              도포 시간 알림
            </div>
            <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>
              설정한 시간마다 토스에서 푸시·알림을 보내요. 끄면 받지 않아요.
            </div>
          </div>
          <Switch
            checked={notificationsEnabled}
            onChange={(_, checked) => {
              if (busy) return;
              onToggleNotifications(checked);
            }}
            disabled={busy}
            aria-label="도포 시간 알림 받기"
          />
        </div>

        {errorMessage && (
          <div
            style={{
              marginTop: 4,
              padding: "8px 12px",
              borderRadius: 10,
              background: "#FEF2F2",
              color: "#B91C1C",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            background: "#F8FAFC",
            borderRadius: 10,
            fontSize: 12,
            color: "#64748B",
            lineHeight: 1.5,
          }}
        >
          알림을 꺼도 앱은 그대로 사용할 수 있어요. 적립과 토스 포인트 환전도
          영향받지 않아요.
        </div>
      </div>
    </BottomSheet>
  );
}
