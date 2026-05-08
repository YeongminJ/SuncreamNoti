import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import type { Env } from "../env";
import { getTossClient } from "../toss/factory";

const loginSchema = z.object({
  /** 우리 시스템 사용자 ID = 토스 getAnonymousKey() hash */
  userKey: z.string().min(1).max(200),
  /** appLogin() 결과의 authorizationCode (10분 유효, 단발성) */
  authorizationCode: z.string().min(1).max(2048),
  /** appLogin() 결과의 referrer */
  referrer: z.enum(["DEFAULT", "SANDBOX"]),
});

const statusSchema = z.object({
  userKey: z.string().min(1).max(200),
});

const route = new Hono<{ Bindings: Env }>();

/**
 * 클라가 진입 시점에 매핑 여부를 사전 조회.
 * `tossUserKey`가 이미 있으면 클라는 `appLogin` 호출 없이 바로 라우팅 진행.
 *
 * 응답:
 * - 매핑 안됨 또는 사용자 row 없음 → `{ tossUserKey: null }`
 * - 매핑됨 → `{ tossUserKey: number }`
 */
route.post("/status", zValidator("json", statusSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  const u = await db
    .select({ tossUserKey: users.tossUserKey })
    .from(users)
    .where(eq(users.userKey, body.userKey))
    .get();
  return c.json({
    tossUserKey: u?.tossUserKey ?? null,
  });
});

/**
 * 토스 로그인 인가코드를 받아서:
 * 1. generateOauth2Token으로 access_token 획득 (mTLS)
 * 2. login-me로 numeric userKey(tossUserKey) 획득 (mTLS)
 * 3. users 테이블의 해당 userKey row에 tossUserKey 업데이트
 *
 * 클라는 미리 POST /api/users로 사용자가 등록돼 있어야 해요.
 */
route.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  const toss = getTossClient(c.env);

  // users row 존재 확인 (없으면 401 — 온보딩 먼저)
  const existing = await db
    .select({ userKey: users.userKey })
    .from(users)
    .where(eq(users.userKey, body.userKey))
    .get();
  if (!existing) {
    return c.json(
      {
        ok: false,
        error: "user_not_registered",
        hint: "POST /api/users로 먼저 사용자 등록 후 호출하세요.",
      },
      404,
    );
  }

  // 1) 토큰 교환
  const tokenRes = await toss.generateOauth2Token({
    authorizationCode: body.authorizationCode,
    referrer: body.referrer,
  });
  if (!tokenRes.ok || !tokenRes.accessToken) {
    return c.json(
      {
        ok: false,
        step: "generateOauth2Token",
        error: tokenRes.error ?? "unknown",
      },
      502,
    );
  }

  // 2) login-me
  const meRes = await toss.getLoginMe(tokenRes.accessToken);
  if (!meRes.ok || meRes.tossUserKey == null) {
    return c.json(
      { ok: false, step: "getLoginMe", error: meRes.error ?? "unknown" },
      502,
    );
  }

  // 3) tossUserKey 저장
  const now = Date.now();
  await db
    .update(users)
    .set({ tossUserKey: meRes.tossUserKey, updatedAt: now })
    .where(eq(users.userKey, body.userKey));

  return c.json({
    ok: true,
    userKey: body.userKey,
    tossUserKey: meRes.tossUserKey,
  });
});

export default route;
