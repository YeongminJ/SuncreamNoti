/**
 * 토스 인앱(Apps-in-Toss) Partner API 추상화.
 * - generateOauth2Token: 클라가 받은 인가코드 → access_token
 * - getLoginMe: access_token → numeric userKey (sendMessage 대상)
 * - sendMessage: 등록된 템플릿으로 푸시 발송
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

export interface SendMessageInput {
  /** 토스 사용자 식별값 (loginMe의 numeric userKey) */
  tossUserKey: number;
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
