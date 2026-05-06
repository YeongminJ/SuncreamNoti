import { BottomSheet } from "@toss/tds-mobile";
import privacyMd from "../../../docs/legal/privacy.md?raw";
import termsMd from "../../../docs/legal/terms.md?raw";

export type LegalKind = "terms" | "privacy";

interface Props {
  open: boolean;
  kind: LegalKind | null;
  onClose: () => void;
}

const TITLE: Record<LegalKind, string> = {
  terms: "이용약관",
  privacy: "개인정보 처리방침",
};

/**
 * 약관/개인정보 처리방침 본문을 BottomSheet에 표시.
 * 마크다운은 raw로 가져와 간단한 줄 단위 렌더링으로 가독성만 확보. (별도 md 파서 미사용)
 */
export function LegalSheet({ open, kind, onClose }: Props) {
  const text = kind === "terms" ? termsMd : kind === "privacy" ? privacyMd : "";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={kind ? <BottomSheet.Header>{TITLE[kind]}</BottomSheet.Header> : null}
      expandBottomSheet
      maxHeight={600}
    >
      <div
        style={{
          padding: "0 20px 20px",
          maxHeight: "70vh",
          overflowY: "auto",
          fontSize: 13,
          lineHeight: 1.7,
          color: "#334155",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {text}
      </div>
    </BottomSheet>
  );
}
