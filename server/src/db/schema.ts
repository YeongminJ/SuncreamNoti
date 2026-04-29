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
 * - `toss_user_key`: 토스 `loginMe`로 받은 numeric userKey. sendMessage의 `x-toss-user-key`.
 *   토스 로그인 전엔 NULL. NULL인 동안엔 cron이 발송 대상에서 제외.
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
