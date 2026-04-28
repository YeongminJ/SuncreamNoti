import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client";
import { notifications, userSlots, users } from "../db/schema";
import type { Env } from "../env";

const upsertSchema = z.object({
  userKey: z.string().min(1).max(200),
  skinType: z.enum(["I", "II", "III", "IV", "V_VI"]),
  environment: z.enum(["indoor", "outdoor", "mixed"]),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(0).max(1439),
  slotMinutes: z
    .array(z.number().int().min(0).max(1439))
    .min(1)
    .max(8),
  timezone: z.string().default("Asia/Seoul"),
});

const deleteSchema = z.object({
  userKey: z.string().min(1).max(200),
});

const route = new Hono<{ Bindings: Env }>();

/**
 * 사용자 등록/업데이트 (upsert).
 * 클라이언트가 온보딩 완료 시 또는 스케줄 변경 시 호출.
 */
route.post("/", zValidator("json", upsertSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  const now = Date.now();

  await db
    .insert(users)
    .values({
      userKey: body.userKey,
      skinType: body.skinType,
      environment: body.environment,
      startMinute: body.startMinute,
      endMinute: body.endMinute,
      timezone: body.timezone,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.userKey,
      set: {
        skinType: body.skinType,
        environment: body.environment,
        startMinute: body.startMinute,
        endMinute: body.endMinute,
        timezone: body.timezone,
        updatedAt: now,
      },
    });

  // 슬롯 통째 교체 (이전 스케줄 → 새 스케줄)
  await db.delete(userSlots).where(eq(userSlots.userKey, body.userKey));
  if (body.slotMinutes.length > 0) {
    await db.insert(userSlots).values(
      body.slotMinutes.map((m) => ({
        userKey: body.userKey,
        slotMinute: m,
      })),
    );
  }

  return c.json({
    ok: true,
    userKey: body.userKey,
    slotCount: body.slotMinutes.length,
  });
});

/**
 * 사용자 + 슬롯 + 발송 이력 모두 삭제 (opt-out).
 */
route.delete("/", zValidator("json", deleteSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  await db.delete(userSlots).where(eq(userSlots.userKey, body.userKey));
  await db
    .delete(notifications)
    .where(eq(notifications.userKey, body.userKey));
  await db.delete(users).where(eq(users.userKey, body.userKey));
  return c.json({ ok: true });
});

/**
 * 사용자 정보 + 슬롯 조회. 디버깅용.
 */
route.get("/:userKey", async (c) => {
  const userKey = c.req.param("userKey");
  const db = getDb(c.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(eq(users.userKey, userKey))
    .get();
  if (!user) return c.json({ error: "not_found" }, 404);
  const slots = await db
    .select()
    .from(userSlots)
    .where(eq(userSlots.userKey, userKey))
    .all();
  return c.json({
    user,
    slots: slots.map((s) => s.slotMinute),
  });
});

export default route;
