import type { Env } from "../env";
import type {
  GenerateTokenInput,
  GenerateTokenResult,
  LoginMeResult,
  SendMessageInput,
  SendMessageResult,
  TossClient,
} from "./client";

/**
 * 실제 토스 인앱 Partner API 호출 클라이언트.
 *
 * mTLS 처리: `env.TOSS_CERT.fetch(...)`를 사용. CF Workers의
 * mtls_certificates 바인딩이 자동으로 클라 인증서를 첨부해서 호출.
 *
 * 일반 `fetch()`를 쓰면 mTLS 검증 실패하므로 반드시 binding fetcher 사용.
 */

const PATH_GENERATE_TOKEN =
  "/api-partner/v1/apps-in-toss/user/oauth2/generate-token";
const PATH_LOGIN_ME = "/api-partner/v1/apps-in-toss/user/oauth2/login-me";
const PATH_SEND_MESSAGE =
  "/api-partner/v1/apps-in-toss/messenger/send-message";

function describeError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const error = obj.error;
    if (error && typeof error === "object") {
      const e = error as Record<string, unknown>;
      const code = e.code ?? e.errorCode;
      const msg = e.message ?? e.errorMessage;
      if (msg) return `${code ?? "ERR"}: ${msg}`;
    }
    if (typeof obj.errorMessage === "string") return obj.errorMessage;
    if (typeof obj.message === "string") return obj.message;
  }
  return `HTTP ${status}`;
}

function getMtlsFetcher(env: Env): Fetcher {
  if (!env.TOSS_CERT) {
    throw new Error(
      "TOSS_CERT 바인딩이 없습니다. wrangler.toml의 mtls_certificates 블록 확인.",
    );
  }
  return env.TOSS_CERT;
}

export function createRealTossClient(env: Env): TossClient {
  const baseUrl = env.TOSS_BASE_URL;

  return {
    async generateOauth2Token(
      input: GenerateTokenInput,
    ): Promise<GenerateTokenResult> {
      try {
        const fetcher = getMtlsFetcher(env);
        const res = await fetcher.fetch(`${baseUrl}${PATH_GENERATE_TOKEN}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorizationCode: input.authorizationCode,
            referrer: input.referrer,
          }),
        });

        const json = (await res.json().catch(() => null)) as
          | {
              resultType?: string;
              success?: {
                accessToken?: string;
                refreshToken?: string;
                tokenType?: string;
                expiresIn?: number;
                scope?: string;
              };
              error?: unknown;
            }
          | null;

        if (!res.ok || !json || json.resultType !== "SUCCESS" || !json.success) {
          return {
            ok: false,
            error: describeError(json, res.status),
          };
        }
        return {
          ok: true,
          accessToken: json.success.accessToken,
          refreshToken: json.success.refreshToken,
          expiresIn: json.success.expiresIn,
          scope: json.success.scope,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[real toss] generateOauth2Token threw", msg);
        return { ok: false, error: msg };
      }
    },

    async getLoginMe(accessToken: string): Promise<LoginMeResult> {
      try {
        const fetcher = getMtlsFetcher(env);
        const res = await fetcher.fetch(`${baseUrl}${PATH_LOGIN_ME}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const json = (await res.json().catch(() => null)) as
          | {
              resultType?: string;
              success?: { userKey?: number; scope?: string };
              error?: unknown;
            }
          | null;

        if (
          !res.ok ||
          !json ||
          json.resultType !== "SUCCESS" ||
          !json.success ||
          typeof json.success.userKey !== "number"
        ) {
          return { ok: false, error: describeError(json, res.status) };
        }
        return {
          ok: true,
          tossUserKey: json.success.userKey,
          scope: json.success.scope,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[real toss] getLoginMe threw", msg);
        return { ok: false, error: msg };
      }
    },

    async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
      try {
        const fetcher = getMtlsFetcher(env);
        const res = await fetcher.fetch(`${baseUrl}${PATH_SEND_MESSAGE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-toss-user-key": String(input.tossUserKey),
          },
          body: JSON.stringify({
            templateSetCode: input.templateSetCode,
            context: input.context ?? {},
          }),
        });

        const json = (await res.json().catch(() => null)) as
          | {
              resultType?: string;
              result?: { msgCount?: number };
              error?: unknown;
            }
          | null;

        if (!res.ok || !json || json.resultType !== "SUCCESS") {
          return { ok: false, error: describeError(json, res.status) };
        }
        return {
          ok: true,
          resultType: json.resultType,
          msgCount: json.result?.msgCount,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[real toss] sendMessage threw", msg);
        return { ok: false, error: msg };
      }
    },
  };
}
