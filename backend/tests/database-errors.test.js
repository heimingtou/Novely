import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { createErrorHandler } from "../src/middlewares/error-handler.js";
import { mapDatabaseError } from "../src/shared/errors/database-error.js";
import { close, listen } from "./helpers/http.js";

const privateMessage = "postgresql://unit:private_password@example.invalid/unit; SELECT password_hash; stack-private";
const prisma = (code, cause) => Object.assign(new Error(privateMessage), {
  name: "PrismaClientKnownRequestError", code,
  meta: cause ? { driverAdapterError: { name: "DriverAdapterError", cause } } : {},
});
const cases = [
  ["unique", prisma("P2002", { kind: "UniqueConstraintViolation", originalCode: "23505" }), 409, "UNIQUE_CONSTRAINT"],
  ["foreign-key", prisma("P2003", { originalCode: "23503" }), 409, "FOREIGN_KEY_CONSTRAINT"],
  ["restrict", prisma("P2003", { kind: "RestrictViolation", originalCode: "23001" }), 409, "FOREIGN_KEY_CONSTRAINT"],
  ["not-found", prisma("P2025"), 404, "RECORD_NOT_FOUND"],
  ["check-prisma7", prisma("P2039", { code: "23514", originalCode: "23514", kind: "postgres" }), 422, "CHECK_CONSTRAINT"],
  ["check-raw-legacy", Object.assign(prisma("P2010"), { meta: { code: "23514" } }), 422, "CHECK_CONSTRAINT"],
  ["check-native-pg", Object.assign(new Error(privateMessage), { code: "23514" }), 422, "CHECK_CONSTRAINT"],
  ["not-null", prisma("P2011"), 422, "INVALID_DATA"],
  ["value-range", prisma("P2010", { originalCode: "22003" }), 422, "INVALID_DATA"],
  ["authentication-prisma7", prisma("P2010", { originalCode: "28P01", kind: "AuthenticationFailed" }), 503, "DATABASE_UNAVAILABLE"],
  ["initialization-errorCode", Object.assign(new Error(privateMessage), { name: "PrismaClientInitializationError", errorCode: "P1001" }), 503, "DATABASE_UNAVAILABLE"],
  ["closed-connection", prisma("P1017"), 503, "DATABASE_UNAVAILABLE"],
  ["native-network", Object.assign(new Error(privateMessage), { code: "ECONNREFUSED" }), 503, "DATABASE_UNAVAILABLE"],
  ["pool-timeout", prisma("P2024"), 503, "DATABASE_UNAVAILABLE"],
  ["statement-timeout", prisma("P2010", { originalCode: "57014" }), 503, "DATABASE_UNAVAILABLE"],
  ["unexpected-sql", prisma("P2010", { originalCode: "22012", kind: "postgres" }), 500, "INTERNAL_ERROR"],
  ["unknown-prisma7", prisma("P2039", { originalCode: "42601" }), 500, "INTERNAL_ERROR"],
  ["validation-programming-error", Object.assign(new Error(privateMessage), { name: "PrismaClientValidationError" }), 500, "INTERNAL_ERROR"],
  ["ordinary-error", new Error(privateMessage), 500, "INTERNAL_ERROR"],
];
let fixture;
const logged = [];
before(async () => {
  const app = express();
  app.get("/:name", async (request) => { throw cases.find(([name]) => name === request.params.name)[1]; });
  app.use(createErrorHandler({ error: (...args) => logged.push(args) }));
  fixture = await listen(app);
});
after(async () => close(fixture.server));

for (const [name, , status, code] of cases) {
  test(`database error ${name} maps to safe HTTP ${status}`, async () => {
    const response = await fetch(`${fixture.baseUrl}/${name}`);
    assert.equal(response.status, status);
    const text = await response.text();
    assert.equal(JSON.parse(text).error.code, code);
    for (const secret of ["private_password", "postgresql://", "SELECT", "password_hash", "stack-private", "driverAdapterError"]) {
      assert.ok(!text.includes(secret));
      assert.ok(!JSON.stringify(logged).includes(secret));
    }
  });
}

test("database error inspection handles cyclic causes and never guesses from a message", () => {
  const error = prisma("P2039");
  error.cause = error;
  assert.equal(mapDatabaseError(error).status, 500);
  assert.equal(mapDatabaseError(new Error("23514 P2002 SELECT unit-private")), null);
});
