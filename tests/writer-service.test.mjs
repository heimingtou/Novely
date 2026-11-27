import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { setWriterTestClient } from "./helpers/writer-server-mocks.mjs";

// Import the actual Next service. Substitute only its server boundary/IO; do not
// rewrite service source or load Supabase configuration. Hooks live in this test
// process and are removed immediately after linking the service.
const substitutions = new Map([
  ["server-only", "data:text/javascript,export%20%7B%7D"],
  ["@/lib/supabase/admin", new URL("./helpers/writer-server-mocks.mjs", import.meta.url).href],
  ["@/server/storage", new URL("./helpers/writer-server-mocks.mjs", import.meta.url).href],
  ["@/server/http", new URL("../src/server/http.js", import.meta.url).href],
  ["@/server/presenters", new URL("../src/server/presenters.js", import.meta.url).href],
  ["@/server/retry-deadlock.mjs", new URL("../src/server/retry-deadlock.mjs", import.meta.url).href],
]);
const hooks = registerHooks({ resolve(specifier, context, next) {
  return substitutions.has(specifier) ? { url: substitutions.get(specifier), shortCircuit: true } : next(specifier, context);
} });
let saveChapter, deleteChapter;
try { ({ saveChapter, deleteChapter } = await import("../src/server/services/writer.js")); }
finally { hooks.deregister(); }

const author = { id: 7, role: "author" };
const input = { title: "Synthetic title", content: "Synthetic test content", publish: false };

function database(context, failures = {}) {
  context.mock.method(console, "error", () => {});
  const requests = [];
  const queues = Object.fromEntries(Object.entries(failures).map(([key, values]) => [key, [...values]]));
  setWriterTestClient({ from(table) {
    const request = { table, operation: "select", filters: [], payload: null, columns: "" };
    let promise;
    const query = {
      select(columns) { request.columns = columns; return query; },
      insert(payload) { request.operation = "insert"; request.payload = payload; return query; },
      upsert(payload) { request.operation = "upsert"; request.payload = payload; return query; },
      update(payload) { request.operation = "update"; request.payload = payload; return query; },
      delete() { request.operation = "delete"; return query; },
      eq(column, value) { request.filters.push([column, value]); return query; },
      in(column, values) { request.filters.push([column, values]); return query; },
      order() { return query; }, limit() { return query; },
      single() { return query; }, maybeSingle() { return query; },
      then(resolve, reject) {
        promise ??= Promise.resolve().then(() => {
          requests.push(structuredClone(request));
          const code = queues[`${table}.${request.operation}`]?.shift();
          if (code) return { data: null, error: { code, message: "Synthetic statement failure" } };
          let data = null;
          if (table === "novels" && request.operation === "select") data = { novel_id: 91, author_id: author.id };
          if (table === "chapters" && request.operation === "select") {
            data = request.columns === "published_at" ? [] : request.columns === "chapter_number"
              ? { chapter_number: 2 }
              : { chapter_id: 901, chapter_number: 3, status: "draft", published_at: null };
          }
          if (table === "chapters" && request.operation === "insert") data = { chapter_id: 901 };
          return { data, error: null };
        });
        return promise.then(resolve, reject);
      },
    };
    return query;
  } });
  const writes = (table, operation) => requests.filter((request) => request.table === table && request.operation === operation);
  return { requests, writes };
}

test("creating a chapter retries only its content INSERT, never its metadata workflow", async (context) => {
  const { writes } = database(context, { "chapter_contents.insert": ["40P01", "40P01"] });
  assert.equal(await saveChapter(author, 91, null, input), 901);
  assert.equal(writes("chapters", "insert").length, 1);
  assert.equal(writes("chapter_contents", "insert").length, 3);
  assert.ok(writes("chapter_contents", "insert").every((request) => request.payload.chapter_id === 901));
  assert.equal(writes("chapters", "delete").length, 0);
  assert.equal(writes("novels", "update").length, 1);
});

test("an aborted metadata INSERT retries that statement with the same chapter number", async (context) => {
  const { writes } = database(context, { "chapters.insert": ["40P01", "40P01"] });
  assert.equal(await saveChapter(author, 91, null, input), 901);
  assert.equal(writes("chapters", "insert").length, 3);
  assert.ok(writes("chapters", "insert").every((request) => request.payload.chapter_number === 3));
  assert.equal(writes("chapter_contents", "insert").length, 1);
});

test("exhausted content deadlocks compensate once without creating another chapter", async (context) => {
  const { writes } = database(context, { "chapter_contents.insert": ["40P01", "40P01", "40P01"] });
  await assert.rejects(saveChapter(author, 91, null, input), (error) => error.code === "DATABASE_ERROR");
  assert.equal(writes("chapters", "insert").length, 1);
  assert.equal(writes("chapter_contents", "insert").length, 3);
  assert.equal(writes("chapters", "delete").length, 1);
  assert.deepEqual(writes("chapters", "delete")[0].filters, [["chapter_id", 901]]);
  assert.equal(writes("novels", "update").length, 0);
});

test("exhausted metadata deadlocks stop before content or compensation", async (context) => {
  const { writes } = database(context, { "chapters.insert": ["40P01", "40P01", "40P01"] });
  await assert.rejects(saveChapter(author, 91, null, input), (error) => error.code === "DATABASE_ERROR");
  assert.equal(writes("chapters", "insert").length, 3);
  assert.equal(writes("chapter_contents", "insert").length, 0);
  assert.equal(writes("chapters", "delete").length, 0);
});

test("a concurrent chapter-number unique violation is surfaced without blind replay", async (context) => {
  const { writes } = database(context, { "chapters.insert": ["23505"] });
  await assert.rejects(saveChapter(author, 91, null, input), (error) => error.code === "DATABASE_ERROR");
  assert.equal(writes("chapters", "insert").length, 1);
  assert.equal(writes("chapter_contents", "insert").length, 0);
});

test("editing a chapter retries content UPSERT without repeating metadata or counters", async (context) => {
  const { writes } = database(context, { "chapter_contents.upsert": ["40P01", "40P01"] });
  assert.equal(await saveChapter(author, 91, 901, input), 901);
  assert.equal(writes("chapters", "update").length, 1);
  assert.equal(writes("chapter_contents", "upsert").length, 3);
  assert.equal(writes("novels", "update").length, 1);
});

test("editing metadata also has bounded statement-level deadlock recovery", async (context) => {
  const { writes } = database(context, { "chapters.update": ["40P01"] });
  assert.equal(await saveChapter(author, 91, 901, input), 901);
  assert.equal(writes("chapters", "update").length, 2);
  assert.equal(writes("chapter_contents", "upsert").length, 1);
});

test("deleting content retries only that step and preserves child-first ordering", async (context) => {
  const { writes, requests } = database(context, { "chapter_contents.delete": ["40P01", "40P01"] });
  await deleteChapter(author, 91, 901);
  assert.equal(writes("comments", "delete").length, 1);
  assert.equal(writes("chapter_likes", "delete").length, 1);
  assert.equal(writes("reading_progress", "update").length, 1);
  assert.equal(writes("chapter_contents", "delete").length, 3);
  assert.equal(writes("chapters", "delete").length, 1);
  const order = requests.filter((request) => request.operation !== "select").map((request) => request.table);
  assert.deepEqual(order, ["comments", "chapter_likes", "reading_progress", "chapter_contents", "chapter_contents", "chapter_contents", "chapters", "novels"]);
});

test("content FK failure is not retried and does not replay a create workflow", async (context) => {
  const { writes } = database(context, { "chapter_contents.insert": ["23503"] });
  await assert.rejects(saveChapter(author, 91, null, input), (error) => error.code === "DATABASE_ERROR");
  assert.equal(writes("chapters", "insert").length, 1);
  assert.equal(writes("chapter_contents", "insert").length, 1);
  assert.equal(writes("chapters", "delete").length, 1);
});

test("Writer ownership checks still reject other authors before any write", async (context) => {
  const { requests } = database(context);
  await assert.rejects(saveChapter({ id: 8, role: "author" }, 91, null, input), (error) => error.status === 403);
  assert.equal(requests.filter((request) => request.operation !== "select").length, 0);
});
