import type { Env } from "../env";
import type { TossClient } from "./client";
import { mockTossClient } from "./mock";
import { createRealTossClient } from "./real";

/**
 * 환경에 따라 mock/real 클라이언트 선택.
 *
 * - `TOSS_MODE=real` + `TOSS_CERT` 바인딩 존재 → real
 * - 그 외(mock 모드 또는 인증서 누락) → mock + 경고 로그
 */
export function getTossClient(env: Env): TossClient {
  if (env.TOSS_MODE === "real") {
    if (!env.TOSS_CERT) {
      console.warn(
        "[toss] TOSS_MODE=real이지만 TOSS_CERT 바인딩이 없어요. mock 폴백.",
      );
      return mockTossClient;
    }
    return createRealTossClient(env);
  }
  return mockTossClient;
}
