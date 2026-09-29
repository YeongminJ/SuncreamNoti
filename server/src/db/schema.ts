import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * 사용자 한 명당 1행.
 * - `user_key`: 우리 시스템 PK. 토스 `getAnonymousKey()` hash. 클라가 보냄.
 *   2026-07-16 hash 인증 도입 이후엔 sendMessage의 `x-anon-key`로도 그대로 사용.
 * - `toss_user_key`: 토스 `loginMe`로 받은 numeric userKey. hash 방식 전환 이전
 *   `x-toss-user-key` 헤더용으로 채워져 있던 값. 신규 발송 경로는 `user_key`를
 *   그대로 x-anon-key로 사용하므로 NULL이어도 무방. 하위호환/디버깅 용도로 보존.
 * - `notification_agreed_at`: 토스 `Notification.requestAgreement` 승인 시각(ms).
 *   NULL이면 미동의 상태. cron은 이 값이 채워진 사용자에게만 발송.
 *
 * 슬롯 시각은 정규화된 `user_slots` 테이블에 저장.
 */
export const users = sqliteTable("users", {
  userKey: text("user_key").primaryKey(),
  tossUserKey: integer("toss_user_key"),
  skinType: text("skin_type").notNull(),
  environment: text("environment").notNull(),
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  /**
   * 사용자가 알림을 끈 경우 1, 기본 0.
   * cron 발송 시 0인 사용자만 대상으로 함.
   *
   * SQLite는 boolean이 따로 없어 integer로 저장. integer.mode 옵션은
   * 기존 drizzle 호환을 위해 미사용 — application에서 0/1로만 다룬다.
   */
  notificationsDisabled: integer("notifications_disabled").notNull().default(0),
  /**
   * `Notification.requestAgreement` 응답이 newAgreement/alreadyAgreed인 시각(ms).
   * 토스 정책상 재입고·이벤트·리마인더 유형 메시지는 사전 동의 없이는 발송 불가.
   * NULL이면 cron이 해당 사용자를 건너뜀 — 5/15 이전에 등록됐던 사용자도
   * 다음 진입 시 동의 확보되면 자동으로 발송 대상에 편입.
   */
  notificationAgreedAt: integer("notification_agreed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * 사용자별 슬롯 시각(분 단위, KST 기준).
 * Cron이 분단위로 매칭하기 좋게 정규화해서 저장.
 */
export const userSlots = sqliteTable(
  "user_slots",
  {
    userKey: text("user_key").notNull(),
    slotMinute: integer("slot_minute").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userKey, t.slotMinute] }),
  }),
);

/**
 * 발송 이력. 같은 (userKey, date, slotMinute)에 대해 한 번만 sent.
 * 실패 시 status='failed', error 메시지 보관.
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userKey: text("user_key").notNull(),
    date: text("date").notNull(), // KST 'YYYY-MM-DD'
    slotMinute: integer("slot_minute").notNull(),
    status: text("status").notNull(), // 'sent' | 'failed' | 'skipped'
    sentAt: integer("sent_at").notNull(),
    error: text("error"),
  },
  (t) => ({
    uniq: uniqueIndex("notifications_user_date_slot").on(
      t.userKey,
      t.date,
      t.slotMinute,
    ),
  }),
);
