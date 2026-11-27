import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { configureJsonSerialization, jsonReplacer } from "../src/shared/http/json.js";
import { close, listen } from "./helpers/http.js";

test("JSON preserves nested nulls/dates and decimal BigInt values beyond safe integers", () => {
  const date = new Date("2026-11-25T08:30:00.123Z");
  const source = { id: 9007199254740993n, missing: null, nested: [{ id: -9007199254740995n, date, null: null }], zero: 0n };
  const previous = BigInt.prototype.toJSON;
  assert.deepEqual(JSON.parse(JSON.stringify(source, jsonReplacer)), {
    id: "9007199254740993", missing: null,
    nested: [{ id: "-9007199254740995", date: "2026-11-25T08:30:00.123Z", null: null }], zero: "0",
  });
  assert.equal(source.id, 9007199254740993n);
  assert.equal(source.nested[0].date, date);
  assert.equal(BigInt.prototype.toJSON, previous);
});

test("JSON removes both database and Prisma password hash keys at any depth", () => {
  const source = { password_hash: "unit_private_a", profile: { passwordHash: "unit_private_b", name: "Public" }, children: [{ password_hash: "unit_private_c", value: null }] };
  assert.deepEqual(JSON.parse(JSON.stringify(source, jsonReplacer)), { profile: { name: "Public" }, children: [{ value: null }] });
  assert.equal(source.password_hash, "unit_private_a");
});

test("Express uses the shared JSON convention for HTTP responses", async (context) => {
  const app = configureJsonSerialization(express());
  app.get("/", (_request, response) => response.json({ data: {
    id: 9223372036854775806n, at: new Date("2026-11-25T00:00:00.000Z"), nullable: null,
    author: { username: "Public", passwordHash: "unit_private" },
  } }));
  const fixture = await listen(app);
  context.after(() => close(fixture.server));
  const response = await fetch(fixture.baseUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { id: "9223372036854775806", at: "2026-11-25T00:00:00.000Z", nullable: null, author: { username: "Public" } } });
});
