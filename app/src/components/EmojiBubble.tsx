import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  size?: number;
  background?: string;
}

/**
 * 선크림 앱 톤에 맞는 동그란 이모지 버블.
 * 카드/리스트/온보딩 등에서 일관된 "귀여운" 비주얼 포인트로 사용해요.
 */
export function EmojiBubble({
  children,
  size = 56,
  background = "#FFF3EC",
}: Props) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.52),
        flexShrink: 0,
        lineHeight: 1,
      }}
      aria-hidden
    >
      {children}
    </div>
  );
}
