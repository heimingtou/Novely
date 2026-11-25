import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseEnv } from "node:util";
import { loadConfig } from "../src/config/env.js";

test("default configuration uses port 4000 and local frontend origins", () => {
  const config = loadConfig({});
  assert.equal(config.port, 4000);
  assert.equal(config.nodeEnv, "development");
  assert.deepEqual(config.corsOrigins, [
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:3100", "http://127.0.0.1:3100",
  ]);
});

test("custom configuration normalizes and deduplicates CORS origins", () => {
  const config = loadConfig({
    NODE_ENV: "production", PORT: "4500",
    CORS_ORIGINS: " https://novely.example/,https://novely.example,http://localhost:3000 ",
  });
  assert.equal(config.port, 4500);
  assert.equal(config.nodeEnv, "production");
  assert.deepEqual(config.corsOrigins, ["https://novely.example", "http://localhost:3000"]);
  assert.ok(Object.isFrozen(config));
  assert.ok(Object.isFrozen(config.corsOrigins));
});

for (const port of ["0", "-1", "65536", "4000abc", "4e3", "4000.5", "", " ", "Infinity"]) {
  test(`invalid PORT is rejected (${JSON.stringify(port)})`, () => {
    assert.throws(() => loadConfig({ PORT: port }), /PORT phải là số nguyên/);
  });
}

test("boundary ports are accepted", () => {
  assert.equal(loadConfig({ PORT: "1" }).port, 1);
  assert.equal(loadConfig({ PORT: "65535" }).port, 65535);
});

test("invalid NODE_ENV fails before the server starts", () => {
  assert.throws(() => loadConfig({ NODE_ENV: "staging" }), /NODE_ENV phải là/);
});

for (const origin of ["*", "null", "", "http://localhost:3000,", "https://example.com/api",
  "https://example.com?query=1", "https://example.com#fragment", "ftp://example.com", "https://user:private@example.com"]) {
  test(`invalid CORS origin is rejected (${origin})`, () => {
    assert.throws(() => loadConfig({ CORS_ORIGINS: origin }), (error) => {
      assert.match(error.message, /CORS_ORIGINS phải chứa/);
      assert.ok(!error.message.includes("private"));
      return true;
    });
  });
}

test("the committed example environment can configure the backend", () => {
  const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const config = loadConfig(parseEnv(example));
  assert.equal(config.port, 4000);
  assert.ok(config.corsOrigins.includes("http://localhost:3000"));
});
