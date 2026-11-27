import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import pg from "pg";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma-transition/index.js";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { restoreConfig, verifyRestore } from "../scripts/lib/restore-target.js";
import { createSessionTokens, SESSION_TTL_SECONDS, REMEMBER_TTL_SECONDS } from "../src/modules/auth/token.js";
import { hashPassword, verifyPassword } from "../src/modules/auth/password.js";

const secret = randomBytes(48).toString("base64url"); // Synthetic Local secret only.
process.env.AUTH_SECRET = secret;
const nextTokens = await import("../../src/server/auth/token.js");
// Exercise the actual unchanged Next password module, replacing only its framework
// marker and package resolution so this test needs no running Next server.
const nextPasswordSource = (await readFile(new URL("../../src/server/auth/password.js", import.meta.url), "utf8"))
  .replace('import "server-only";', "")
  .replace('"bcryptjs"', JSON.stringify(import.meta.resolve("bcryptjs")));
const nextPasswords = await import(`data:text/javascript;base64,${Buffer.from(nextPasswordSource).toString("base64")}`);
const tokens = createSessionTokens({ secret });
const origin = "http://localhost:3000";
const config = loadConfig({ NODE_ENV: "test", AUTH_SECRET: secret, CORS_ORIGINS: origin });
const logger = { error() {} };

async function serve(context, getClient, overrides = {}) {
  const server = createApp({ config: { ...config, ...overrides }, getClient, logger }).listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
  return async (path, { body, method = body === undefined ? "GET" : "POST", headers = {} } = {}) => {
    const response = await fetch(base + path, { method,
      headers: { Origin: origin, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
}
const cookieOf = (result) => result.headers.get("set-cookie").split(";", 1)[0];
const valueOf = (cookie) => decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
function assertSession(result) {
  const user = result.body.data.user;
  assert.deepEqual(Object.keys(user).sort(), ["avatar", "expiresAt", "id", "role", "username"]);
  assert.equal(typeof user.id, "number");
  assert.equal(typeof user.expiresAt, "number");
  assert.equal(result.headers.get("cache-control"), "no-store");
  const cookie = result.headers.get("set-cookie");
  assert.match(cookie, /^novely_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\//i);
  assert.doesNotMatch(cookie, /Domain=/i);
  return user;
}

test("BE03.2 JWT/password compatibility and hostile tokens", async (t) => {
  await t.test("Next signs / Express verifies, and Express signs / Next verifies", async () => {
    const legacy = await nextTokens.signSessionToken({ userId: 7, role: "reader" }, SESSION_TTL_SECONDS);
    const decoded = await tokens.verify(legacy);
    assert.equal(decoded.userId, 7);
    const signed = await tokens.sign({ userId: 9, role: "author" }, REMEMBER_TTL_SECONDS);
    const next = await nextTokens.verifySessionToken(signed.token);
    assert.deepEqual(next, { userId: 9, role: "author", expiresAt: signed.expiresAt });
  });
  await t.test("reject expiry, tampering, wrong key/algorithm, missing claims and invalid IDs", async () => {
    const key = new TextEncoder().encode(secret);
    const sign = (claims, alg = "HS256", signingKey = key) =>
      new SignJWT(claims).setProtectedHeader({ alg }).sign(signingKey);
    const now = Math.floor(Date.now() / 1000);
    const valid = { sub: "1", iat: now, exp: now + 60, role: "admin" };
    for (const token of ["bad", "", await sign({ ...valid, exp: now - 1 }),
      await sign(valid, "HS384"), await sign(valid, "HS256", new TextEncoder().encode(secret + "wrong")),
      await sign({ sub: "1", iat: now }), await sign({ ...valid, sub: "1.0" }),
      await sign({ ...valid, sub: "0" }), await sign({ ...valid, sub: "2147483648" }),
      await sign({ ...valid, iat: "bad" }), (await sign(valid)) + "tampered"]) {
      assert.equal(await tokens.verify(token), null);
    }
  });
  await t.test("bcrypt cost10, old $2a$ hashes and Next password module interoperate", async () => {
    const old = (await nextPasswords.hashPassword("synthetic-password")).replace(/^\$2b\$/, "$2a$");
    assert.equal(bcrypt.getRounds(old), 10);
    assert.equal(await verifyPassword("synthetic-password", old), true);
    assert.equal(await nextPasswords.verifyPassword("synthetic-password", await hashPassword("synthetic-password")), true);
    assert.equal(await verifyPassword("wrong", old), false);
    assert.equal(await verifyPassword("synthetic-password", undefined), false);
  });
  await t.test("document existing UTF-8 72-byte truncation without breaking old logins", async () => {
    const prefix = "á".repeat(36); // 72 bytes, 36 characters.
    assert.equal(bcrypt.truncates(prefix + "A"), true);
    assert.equal(await verifyPassword(prefix + "B", await nextPasswords.hashPassword(prefix + "A")), true);
  });
});

test("BE03.2 HTTP Authentication against approved Local transition database", { timeout: 60000 }, async (t) => {
  // Reuse approved Local credentials only. restoreConfig rejects the Supabase profile
  // and pins 127.0.0.1:5432/novely_restore_test before any connection or write.
  const db = restoreConfig();
  const pool = new pg.Pool({ ...db.pool, application_name: "novely-be03.2-auth-test" });
  pool.on("error", () => {});
  let prisma;
  const prefix = "be032_" + randomBytes(6).toString("hex");
  let request, registered, cookie;
  const registration = (suffix = "main", extras = {}) => ({ username: prefix + suffix,
    email: `${prefix}${suffix}@example.invalid`, password: "synthetic-password",
    confirmPassword: "synthetic-password", agreeTerms: true, ...extras });
  try {
    const control = await pool.connect();
    try { await verifyRestore(control); } finally { control.release(); }
    prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public", disposeExternalPool: false }), log: [], errorFormat: "minimal" });
    request = await serve(t, async () => prisma);
    await t.test("register atomically, normalize inputs and discard privileged body fields", async () => {
      const result = await request("/register", { body: registration("main", {
        username: ` ${prefix}main `, email: ` ${prefix.toUpperCase()}MAIN@EXAMPLE.INVALID `,
        role: "admin", userId: 1, passwordHash: "client-controlled", avatar: "private",
      }) });
      assert.equal(result.status, 201);
      registered = assertSession(result);
      cookie = cookieOf(result);
      assert.equal(registered.role, "reader");
      assert.equal(registered.avatar, null);
      assert.match(result.headers.get("set-cookie"), /Max-Age=86400/);
      assert.doesNotMatch(result.headers.get("set-cookie"), /; Secure/i);
      const stored = await prisma.user.findUnique({ where: { userId: registered.id }, select: {
        email: true, passwordHash: true, profile: { select: { userId: true } },
      } });
      assert.equal(stored.email, registration().email);
      assert.equal(stored.profile.userId, registered.id);
      assert.equal(bcrypt.getRounds(stored.passwordHash), 10);
      assert.equal(await verifyPassword("synthetic-password", stored.passwordHash), true);
    });
    await t.test("duplicate email and username retain messages; concurrent registration has one winner", async () => {
      for (const [body, code, message] of [
        [registration("other", { email: registration().email }), "EMAIL_EXISTS", "Email này đã được đăng ký."],
        [registration("other", { username: registration().username }), "USERNAME_EXISTS", "Tên đăng nhập đã có người dùng."],
      ]) {
        const result = await request("/register", { body });
        assert.equal(result.status, 409);
        assert.deepEqual(result.body, { error: { code, message } });
        assert.equal(result.headers.get("set-cookie"), null);
      }
      const results = await Promise.all([1, 2].map(() => request("/register", { body: registration("race") })));
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      assert.equal(await prisma.user.count({ where: { username: prefix + "race" } }), 1);
    });
    await t.test("profile constraint failure rolls back actual Prisma registration transaction", async (context) => {
      const broken = { $transaction: (work, options) => prisma.$transaction((tx) => work({
        user: tx.user, profile: { create: async (input) => {
          // Real PostgreSQL primary-key violation after BOTH inserts have succeeded.
          // No schema change or permanent fault injector is needed.
          await tx.profile.create(input);
          return tx.profile.create(input);
        } },
      }), options) };
      const call = await serve(context, async () => broken);
      const result = await call("/register", { body: registration("rollback") });
      assert.equal(result.status, 500);
      assert.equal(result.body.error.message, "Không thể tạo tài khoản lúc này, vui lòng thử lại.");
      assert.equal(result.headers.get("set-cookie"), null);
      assert.equal(await prisma.user.count({ where: { username: prefix + "rollback" } }), 0);
    });
    await t.test("validation firstIssue, types, lengths, confirmation and terms", async () => {
      for (const [extras, message] of [
        [{ username: "a" }, "Tên đăng nhập cần ít nhất 3 ký tự."],
        [{ username: "invalid name" }, "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm và gạch dưới."],
        [{ email: "invalid" }, "Địa chỉ email không hợp lệ."],
        [{ password: "short" }, "Mật khẩu cần ít nhất 6 ký tự."],
        [{ password: "x".repeat(201) }, "Mật khẩu quá dài."],
        [{ confirmPassword: "different" }, "Mật khẩu xác nhận không khớp!"],
        [{ agreeTerms: "on" }, "Vui lòng đồng ý với điều khoản sử dụng của Novely!"],
      ]) {
        const result = await request("/register", { body: registration("invalid", extras) });
        assert.equal(result.status, 400);
        assert.deepEqual(result.body, { error: { code: "VALIDATION_ERROR", message } });
      }
      for (const body of [null, [], {}, { identifier: "", password: "x" },
        { identifier: "x", password: "x", rememberMe: "on" }]) {
        assert.equal((await request("/login", { body })).status, 400);
      }
    });
    await t.test("username/email login, legacy hash and 1/30-day TTL", async () => {
      await prisma.user.update({ where: { userId: registered.id }, data: {
        passwordHash: (await nextPasswords.hashPassword("synthetic-password")).replace(/^\$2b\$/, "$2a$"),
      } });
      for (const rememberMe of [false, true]) {
        const result = await request("/login", { body: { identifier: rememberMe
          ? registration().email.toUpperCase() : ` ${registration().username} `, password: "synthetic-password", rememberMe } });
        assert.equal(result.status, 200);
        assertSession(result);
        const session = await nextTokens.verifySessionToken(valueOf(cookieOf(result)));
        const ttl = rememberMe ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS;
        assert.ok(Math.abs(session.expiresAt - Date.now() - ttl * 1000) < 2500);
        assert.match(result.headers.get("set-cookie"), new RegExp(`Max-Age=${ttl}`));
      }
    });
    await t.test("missing user and wrong password give identical safe errors", async () => {
      const results = [];
      for (const identifier of [registration().username, prefix + "missing"]) {
        const result = await request("/login", { body: { identifier, password: "wrong" } });
        assert.equal(result.status, 401);
        assert.equal(result.headers.get("set-cookie"), null);
        results.push(result.body);
      }
      assert.deepEqual(results[0], results[1]);
      assert.equal(results[0].error.message, "Email/tên đăng nhập hoặc mật khẩu không đúng.");
      const caseSensitive = await request("/login", { body: { identifier: registration().username.toUpperCase(), password: "synthetic-password" } });
      assert.equal(caseSensitive.status, 401);
    });
    await t.test("me reloads role/avatar; signed admin claim never overrides reader DB role", async () => {
      const forgedRole = await nextTokens.signSessionToken({ userId: registered.id, role: "admin" }, SESSION_TTL_SECONDS);
      const result = await request("/me", { headers: { Cookie: `novely_session=${forgedRole}` } });
      assert.equal(result.status, 200);
      assert.equal(result.body.data.role, "reader");
      await prisma.user.update({ where: { userId: registered.id }, data: { role: "author" } });
      await prisma.profile.update({ where: { userId: registered.id }, data: { avatar: "synthetic-avatar" } });
      const changed = await request("/me", { headers: { Cookie: cookie } });
      assert.equal(changed.body.data.role, "author");
      assert.equal(changed.body.data.avatar, "synthetic-avatar");
      assert.equal(changed.headers.get("cache-control"), "no-store");
      assert.deepEqual(Object.keys(changed.body.data).sort(), ["avatar", "expiresAt", "id", "role", "username"]);
    });
    await t.test("anonymous/invalid/expired/ambiguous cookies give null without DB access", async (context) => {
      let accesses = 0;
      const call = await serve(context, async () => { accesses++; throw new Error("must not access DB"); });
      const expired = await nextTokens.signSessionToken({ userId: registered.id, role: "reader" }, -60);
      for (const Cookie of ["", "novely_session=bad", "novely_session=%ZZ", `novely_session=${expired}`,
        `${cookie}; ${cookie}`]) {
        const result = await call("/me", { headers: { Cookie } });
        assert.equal(result.status, 200);
        assert.deepEqual(result.body, { data: null });
      }
      assert.equal(accesses, 0);
    });
    await t.test("DB outage returns 503 rather than null, preserves login message, leaks nothing", async (context) => {
      const call = await serve(context, async () => { const error = new Error("synthetic-private-data"); error.code = "P1001"; throw error; });
      const me = await call("/me", { headers: { Cookie: cookie } });
      assert.equal(me.status, 503);
      assert.equal(me.body.error.code, "DATABASE_UNAVAILABLE");
      const login = await call("/login", { body: { identifier: "someone", password: "synthetic" } });
      assert.equal(login.status, 503);
      assert.equal(login.body.error.message, "Không thể đăng nhập lúc này, vui lòng thử lại.");
      assert.doesNotMatch(JSON.stringify([me.body, login.body]), /synthetic-private-data|P1001/);
    });
    await t.test("Origin required on all POST routes, untrusted Origin rejected, preflight supported", async () => {
      for (const route of ["/register", "/login", "/logout"]) {
        for (const Origin of ["", "null", "https://attacker.invalid", origin + ".attacker.invalid"]) {
          const result = await request(route, { method: "POST", body: {}, headers: { Origin, Cookie: cookie } });
          assert.equal(result.status, 403);
          assert.equal(result.headers.get("set-cookie"), null);
        }
      }
      // OPTIONS is answered by the existing CORS middleware; it carries no credentials.
      const server = createApp({ config, logger }).listen(0, "127.0.0.1");
      await once(server, "listening");
      try {
        const result = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth/login`, {
          method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
        });
        assert.equal(result.status, 204);
        assert.equal(result.headers.get("access-control-allow-origin"), origin);
        assert.equal(result.headers.get("access-control-allow-credentials"), "true");
      } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
    });
    await t.test("production cookie Secure; logout clears identical scope even without valid session", async (context) => {
      const call = await serve(context, async () => prisma, { nodeEnv: "production" });
      const loggedIn = await call("/login", { body: { identifier: registration().username, password: "synthetic-password" } });
      assert.equal(loggedIn.status, 200);
      assert.match(loggedIn.headers.get("set-cookie"), /; Secure/i);
      for (const Cookie of ["", cookie, "novely_session=bad"]) {
        const result = await call("/logout", { method: "POST", headers: { Cookie } });
        assert.equal(result.status, 200);
        assert.deepEqual(result.body, { data: { ok: true } });
        const cleared = result.headers.get("set-cookie");
        assert.match(cleared, /^novely_session=;/);
        assert.match(cleared, /Expires=Thu, 01 Jan 1970/);
        assert.match(cleared, /HttpOnly; Secure; SameSite=Lax/);
      }
    });
    await t.test("missing AUTH_SECRET cannot create orphaned accounts", async (context) => {
      const call = await serve(context, async () => prisma, { authSecret: undefined });
      const result = await call("/register", { body: registration("nosecret") });
      assert.equal(result.status, 500);
      assert.equal(await prisma.user.count({ where: { username: prefix + "nosecret" } }), 0);
    });
    await t.test("long passwords remain accepted and compatible with existing bcrypt behavior", async () => {
      const password = "á".repeat(36) + "A";
      const result = await request("/register", { body: registration("long", { password, confirmPassword: password }) });
      assert.equal(result.status, 201);
      const login = await request("/login", { body: { identifier: prefix + "long", password: "á".repeat(36) + "B" } });
      assert.equal(login.status, 200);
    });
    await t.test("deleted DB account invalidates existing JWT session", async () => {
      await prisma.user.delete({ where: { userId: registered.id } });
      const result = await request("/me", { headers: { Cookie: cookie } });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { data: null });
    });
  } finally {
    if (prisma) {
      try {
        await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
        assert.equal(await prisma.user.count({ where: { username: { startsWith: prefix } } }), 0);
      } finally { await prisma.$disconnect(); await pool.end(); }
    } else { await pool.end(); }
  }
});
