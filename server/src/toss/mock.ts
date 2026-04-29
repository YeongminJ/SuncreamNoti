import type { TossClient } from "./client";

/**
 * 콘솔에만 로그를 남기는 가짜 클라이언트. dev/sandbox/검증용.
 * `wrangler tail`로 발송 이벤트 모니터링 가능.
 */
export const mockTossClient: TossClient = {
  async generateOauth2Token(input) {
    console.log("[MockToss] generateOauth2Token", JSON.stringify(input));
    return {
      ok: true,
      accessToken: `mock-access-${Date.now()}`,
      refreshToken: `mock-refresh-${Date.now()}`,
      expiresIn: 3599,
      scope: "user_key",
    };
  },

  async getLoginMe(accessToken) {
    console.log("[MockToss] getLoginMe", accessToken.slice(0, 16) + "…");
    // 토스 numeric userKey 모사 (실제로는 콘솔 사용자별 고유 숫자)
    return {
      ok: true,
      tossUserKey: 100000000 + Math.floor(Math.random() * 900000000),
      scope: "user_key",
    };
  },

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
      resultType: "SUCCESS",
      msgCount: 1,
    };
  },
};
