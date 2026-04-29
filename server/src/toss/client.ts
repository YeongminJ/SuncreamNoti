/** 토스 스마트 발송(sendMessage) 추상화. mock/real이 같은 인터페이스를 구현. */

export interface SendMessageInput {
  userKey: string;
  title: string;
  body: string;
  /** 탭 시 진입할 토스 인앱 스킴. 예: `intoss://dailysuncream` */
  scheme?: string;
}

export interface SendMessageResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export interface TossClient {
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
