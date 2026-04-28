import type { Env } from "../env";
import type { TossClient } from "./client";
import { mockTossClient } from "./mock";

/**
 * 환경에 따라 mock/real 클라이언트 선택.
 * 인증서 받기 전까지는 mock 고정.
 */
export function getTossClient(env: Env): TossClient {
  if (env.TOSS_MODE === "real") {
    // TODO: real client는 인증서 도착 시 ./real.ts 추가하면서 활성화.
    console.warn(
      "[toss] TOSS_MODE=real이지만 real client가 아직 구현되지 않아 mock으로 폴백",
    );
    return mockTossClient;
  }
  return mockTossClient;
}
