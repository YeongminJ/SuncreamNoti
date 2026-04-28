/**
 * Cloudflare Workers 바인딩 / 환경변수 타입.
 * `wrangler.toml`의 binding 이름과 1:1 매칭.
 */
export interface Env {
  /** D1 SQLite 데이터베이스 */
  DB: D1Database;

  /** mock | real — Toss API 모드 */
  TOSS_MODE: "mock" | "real";

  /** (real 모드 전용) 토스 sendMessage 베이스 URL */
  TOSS_BASE_URL?: string;

  /** (real 모드 전용) 토스 발급 API 키 (secret) */
  TOSS_API_KEY?: string;

  /** (real 모드 전용) mTLS 인증서 바인딩 */
  TOSS_CERT?: Fetcher;
}
