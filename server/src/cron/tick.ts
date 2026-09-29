import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { notifications, users, userSlots } from "../db/schema";
import type { Env } from "../env";
import { nowKstDate, nowKstMinute } from "../lib/time";
import { getTossClient } from "../toss/factory";

/**
 * 매 분 실행되는 cron 본체.
 *
 * 1. 현재 KST 분(0~1439)을 기준으로 슬롯 일치 사용자 찾기
 * 2. 알림 미동의(notification_agreed_at IS NULL) 사용자는 발송 대상에서 제외
 *    - 토스 정책(2026-05, SDK 2.5+): 이벤트/리마인더 유형은 사전 동의 필수.
 *    - 과거 필터였던 `tossUserKey IS NOT NULL`은 hash 인증 도입 후 불필요해져 제거.
 * 3. 오늘 같은 슬롯에 이미 'sent' 처리된 사용자는 제외
 * 4. 각 사용자에게 토스 sendMessage 호출 — anon-key(userKey) 우선, 없으면 tossUserKey.
 * 5. notifications 테이블에 결과 기록 (sent / failed)
 */
export async function runTick(
  env: Env,
  event: { scheduledTime: number },
): Promise<void> {
  const fired = new Date(event.scheduledTime);
  const kstMinute = nowKstMinute(fired);
  const kstDate = nowKstDate(fired);
  const db = getDb(env.DB);

  // 1) 분 일치 + 알림 동의 완료 + 알림 미해제 사용자 후보 (slot ⨝ users)
  // notifications_disabled = 1 은 사용자가 홈 설정에서 명시적으로 끔.
  // 토스 정책상 "수신 해제 기능 제공" 요건 충족용.
  const candidates = await db
    .select({
      userKey: users.userKey,
      tossUserKey: users.tossUserKey,
    })
    .from(userSlots)
    .innerJoin(users, eq(users.userKey, userSlots.userKey))
    .where(
      and(
        eq(userSlots.slotMinute, kstMinute),
        isNotNull(users.notificationAgreedAt),
        eq(users.notificationsDisabled, 0),
      ),
    )
    .all();

  if (candidates.length === 0) {
    return;
  }

  // 2) 오늘 같은 슬롯 이미 sent된 사용자 제외
  const userKeys = candidates.map((r) => r.userKey);
  const alreadySent = await db
    .select({ userKey: notifications.userKey })
    .from(notifications)
    .where(
      and(
        inArray(notifications.userKey, userKeys),
        eq(notifications.date, kstDate),
        eq(notifications.slotMinute, kstMinute),
        eq(notifications.status, "sent"),
      ),
    )
    .all();
  const alreadySentSet = new Set(alreadySent.map((r) => r.userKey));
  const toNotify = candidates.filter((c) => !alreadySentSet.has(c.userKey));

  if (toNotify.length === 0) {
    return;
  }

  console.log(
    "[tick]",
    JSON.stringify({
      kstDate,
      kstMinute,
      candidateCount: candidates.length,
      toNotifyCount: toNotify.length,
      mode: env.TOSS_MODE,
    }),
  );

  const toss = getTossClient(env);
  const sentTime = Date.now();
  const templateSetCode = env.TOSS_TEMPLATE_SET_CODE;

  // 동시성: 너무 많이 띄우면 D1·Toss 양쪽 throttle 우려. 직렬 처리로 충분(매 분 ~수십명).
  for (const cand of toNotify) {
    // 발송 식별: 우리 `user_key`가 이미 anonymousKey hash라 그대로 x-anon-key로 사용.
    // 과거에 loginMe로 저장된 tossUserKey가 있으면 fallback(하위호환)으로 넘기지만,
    // real 클라는 anonKey를 우선 사용.
    let result: { ok: boolean; error?: string };
    try {
      result = await toss.sendMessage({
        anonKey: cand.userKey,
        tossUserKey: cand.tossUserKey ?? undefined,
        templateSetCode,
        context: {
          slotMinute: cand.userKey, // 템플릿에서 변수로 사용 가능 (미사용 OK)
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[tick] sendMessage threw", cand.userKey, msg);
      result = { ok: false, error: msg };
    }

    try {
      await db
        .insert(notifications)
        .values({
          userKey: cand.userKey,
          date: kstDate,
          slotMinute: kstMinute,
          status: result.ok ? "sent" : "failed",
          sentAt: sentTime,
          error: result.ok ? null : (result.error ?? "unknown"),
        })
        .onConflictDoNothing();
    } catch (err) {
      // 동시 처리로 unique 충돌 정도면 무시 가능.
      console.error(
        "[tick] notifications insert failed",
        cand.userKey,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
