/**
 * 토스 인앱(Apps-in-Toss) Partner API 추상화.
 * - generateOauth2Token: 클라가 받은 인가코드 → access_token
 *   (2026-07-16 hash 인증 도입 이후 신규 사용자엔 호출하지 않아도 됨)
 * - getLoginMe: access_token → numeric userKey (하위호환용)
 * - sendMessage: 등록된 템플릿으로 푸시 발송. anonKey(권장) 또는
 *   tossUserKey 중 하나로 대상 지정.
 *
 * mock / real 두 구현이 같은 인터페이스를 따름.
 */

export interface GenerateTokenInput {
  authorizationCode: string;
  referrer: "DEFAULT" | "SANDBOX";
}

export interface GenerateTokenResult {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  error?: string;
}

export interface LoginMeResult {
  ok: boolean;
  /** sendMessage의 `x-toss-user-key`로 사용되는 numeric ID */
  tossUserKey?: number;
  scope?: string;
  error?: string;
}

/**
 * sendMessage 대상 지정.
 * - `anonKey`: 클라 SDK `User.getAnonymousKey().hash`. 신규 권장 경로.
 * - `tossUserKey`: `loginMe`로 획득한 numeric key. 과거 발송 경로(하위호환).
 * 둘 다 주면 anonKey 우선.
 */
export interface SendMessageInput {
  anonKey?: string;
  tossUserKey?: number;
  /** 콘솔에 등록한 템플릿 코드 */
  templateSetCode: string;
  /** 템플릿 변수 (없으면 빈 객체) */
  context?: Record<string, string | number | boolean>;
}

export interface SendMessageResult {
  ok: boolean;
  resultType?: string;
  msgCount?: number;
  error?: string;
}

export interface TossClient {
  generateOauth2Token(input: GenerateTokenInput): Promise<GenerateTokenResult>;
  getLoginMe(accessToken: string): Promise<LoginMeResult>;
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
