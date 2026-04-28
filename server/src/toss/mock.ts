import type { TossClient } from "./client";

/**
 * 콘솔에만 로그를 남기는 가짜 클라이언트.
 * `wrangler tail`로 발송 이벤트 모니터링 가능.
 * 토스 mTLS 인증서 발급 전까지 default 모드.
 */
export const mockTossClient: TossClient = {
  async sendMessage(input) {
    console.log(
      "[MockToss] sendMessage",
      JSON.stringify({
        ts: new Date().toISOString(),
        ...input,
      }),
    );
    return {
      ok: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  },
};
