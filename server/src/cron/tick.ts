import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { notifications, userSlots } from "../db/schema";
import type { Env } from "../env";
import { nowKstDate, nowKstMinute } from "../lib/time";
import { getTossClient } from "../toss/factory";

/**
 * 매 분 실행되는 cron 본체.
 *
 * 1. 현재 KST 분(0~1439)을 기준으로 슬롯 일치 사용자 찾기
 * 2. 오늘 같은 슬롯에 이미 'sent' 처리된 사용자는 제외
 * 3. 각 사용자에게 토스 sendMessage 호출 (mock 또는 real)
 * 4. notifications 테이블에 결과 기록 (sent / failed)
 */
export async function runTick(
  env: Env,
  event: { scheduledTime: number },
): Promise<void> {
  const fired = new Date(event.scheduledTime);
  const kstMinute = nowKstMinute(fired);
  const kstDate = nowKstDate(fired);
  const db = getDb(env.DB);

  // 1) 분 일치 사용자 후보
  const candidates = await db
    .select({ userKey: userSlots.userKey })
    .from(userSlots)
    .where(eq(userSlots.slotMinute, kstMinute))
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
  const toNotify = userKeys.filter((k) => !alreadySentSet.has(k));

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
    }),
  );

  // 3) 각 사용자에게 발송
  const toss = getTossClient(env);
  const sentTime = Date.now();

  // 동시성: 너무 많이 띄우면 D1 throttling 우려. 직렬 처리로 충분(매분 ~수십명).
  for (const userKey of toNotify) {
    let result: { ok: boolean; error?: string };
    try {
      result = await toss.sendMessage({
        userKey,
        title: "선크림 바를 시간이에요 ☀️",
        body: "광고 보고 피부도 챙기고 포인트도 챙겨요",
        scheme: "intoss://dailysuncream",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[tick] sendMessage threw", userKey, msg);
      result = { ok: false, error: msg };
    }

    try {
      await db
        .insert(notifications)
        .values({
          userKey,
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
        userKey,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
