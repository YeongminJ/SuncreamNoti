/**
 * Cloudflare Workers 바인딩 / 환경변수 타입.
 * `wrangler.toml`의 binding 이름과 1:1 매칭.
 */
export interface Env {
  /** D1 SQLite 데이터베이스 */
  DB: D1Database;

  /** mock | real — Toss API 모드 */
  TOSS_MODE: "mock" | "real";

  /** Toss API 베이스 URL (real 모드) */
  TOSS_BASE_URL: string;

  /** 콘솔에서 등록한 메시지 템플릿 코드 (real 모드 sendMessage 필수) */
  TOSS_TEMPLATE_SET_CODE: string;

  /** mTLS 인증서 바인딩 — env.TOSS_CERT.fetch(...) 형태로 사용 */
  TOSS_CERT?: Fetcher;
}
