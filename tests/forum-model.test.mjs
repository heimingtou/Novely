import test from "node:test";
import assert from "node:assert/strict";
import { FORUM_CATEGORIES, FORUM_POSTS } from "../src/data/forum.mjs";
import { addForumComment, addForumPost, editForumPost, filterForumPosts, forumHref, getForumComments, getForumPosts,
  getPostStats, LOCAL_AUTHOR, markForumViewed, normalizeFilters, normalizeForumState, removeForumComment, removeForumPost,
  toggleForumFlag, validatePostInput } from "../src/lib/forum-model.mjs";

const empty = () => normalizeForumState(null);
const input = { authorName: "An", title: "Một bài viết mới", body: "Nội dung tiếng Việt 🌙", category: "general", novelId: "demo", spoiler: false };
const now = "2026-10-22T00:00:00Z";
const firstId = FORUM_POSTS[0].id;

test("dữ liệu demo có đủ 8 chủ đề, id bài không trùng", () => {
  assert.equal(FORUM_CATEGORIES.length, 8);
  assert.equal(new Set(FORUM_POSTS.map((post) => post.id)).size, FORUM_POSTS.length);
  assert.ok(FORUM_CATEGORIES.every((category) => FORUM_POSTS.some((post) => post.category === category.id)));
});

test("dữ liệu lưu hỏng, trùng hoặc mạo danh bài mẫu được bỏ qua", () => {
  const valid = { ...input, id: "post-valid", authorId: LOCAL_AUTHOR, createdAt: now };
  const state = normalizeForumState({ posts: [null, valid, valid, { ...valid, id: firstId }, { ...valid, id: "post-forged", authorId: "another-user" }, { ...valid, id: "post-bad-date", createdAt: "invalid" }], likes: [firstId, firstId, "missing"], saved: "bad", comments: { missing: [null] } });
  assert.equal(state.posts.length, 1);
  assert.deepEqual(state.likes, [firstId]);
  assert.deepEqual(state.saved, []);
  assert.deepEqual(state.comments, {});
  const polluted = normalizeForumState(JSON.parse('{"comments":{"__proto__":[{"polluted":true}]}}'));
  assert.deepEqual(polluted.comments, {});
  assert.equal({}.polluted, undefined);
});

test("không cho đăng nội dung trống, quá dài, sai chủ đề hay sai truyện", () => {
  assert.deepEqual(validatePostInput(input), {});
  for (const changes of [{ title: "   " }, { body: "\n " }, { title: "x".repeat(151) }, { body: "x".repeat(5001) }, { category: "unknown" }, { novelId: "missing" }]) {
    assert.ok(Object.keys(validatePostInput({ ...input, ...changes })).length);
    const state = empty();
    assert.equal(addForumPost(state, { ...input, ...changes }, "post-test", now), state);
  }
});

test("tạo bài lưu đúng tác giả cục bộ, Unicode và không thực thi HTML", () => {
  const state = addForumPost(empty(), { ...input, authorName: " An ", body: "<script>alert(1)</script>" }, "post-test", now);
  assert.equal(state.posts[0].authorId, LOCAL_AUTHOR);
  assert.equal(state.posts[0].authorName, "An");
  assert.equal(state.posts[0].body, "<script>alert(1)</script>");
  assert.equal(state.profile.name, "An");
  assert.equal(state.posts[0].createdAt, now);
});

test("chỉ sửa bài tự tạo và giữ thời gian tạo ban đầu", () => {
  const state = addForumPost(empty(), input, "post-test", now);
  const edited = editForumPost(state, "post-test", { ...input, title: "Đã sửa", authorId: "forged", id: "forged" }, "2026-10-23T00:00:00Z");
  assert.equal(edited.posts[0].id, "post-test");
  assert.equal(edited.posts[0].authorId, LOCAL_AUTHOR);
  assert.equal(edited.posts[0].createdAt, now);
  assert.equal(edited.posts[0].title, "Đã sửa");
  assert.equal(editForumPost(state, firstId, input, now).posts.length, 1);
  assert.equal(getForumPosts(editForumPost(state, firstId, input, now)).find((post) => post.id === firstId).title, FORUM_POSTS[0].title);
});

test("xóa bài tự tạo dọn bình luận và các cờ liên quan, giữ dữ liệu bài khác", () => {
  let state = addForumPost(empty(), input, "post-test", now);
  state = addForumComment(state, "post-test", { authorName: "An", body: "Một ý kiến" }, "comment-test", now);
  state = toggleForumFlag(toggleForumFlag(state, "likes", "post-test"), "saved", "post-test");
  state = markForumViewed(state, "post-test");
  state = toggleForumFlag(state, "likes", firstId);
  const removed = removeForumPost(state, "post-test");
  assert.deepEqual(removed.posts, []);
  assert.deepEqual(removed.comments, {});
  assert.deepEqual(removed.likes, [firstId]);
  assert.deepEqual(removed.saved, []);
  assert.deepEqual(removed.viewed, []);
  assert.equal(removeForumPost(state, firstId), state);
});

test("lượt xem chỉ cộng một lần mỗi bài trên thiết bị, kể cả khi có tương tác khác", () => {
  const state = markForumViewed(empty(), firstId);
  assert.equal(getPostStats(state, FORUM_POSTS[0]).views, FORUM_POSTS[0].views + 1);
  assert.equal(markForumViewed(state, firstId), state);
  const liked = toggleForumFlag(state, "likes", firstId);
  assert.equal(markForumViewed(liked, firstId), liked);
  assert.equal(markForumViewed(state, "missing"), state);
});

test("thích/lưu bật tắt độc lập và từ chối khóa không được phép", () => {
  let state = toggleForumFlag(empty(), "likes", firstId);
  state = toggleForumFlag(state, "saved", firstId);
  assert.equal(getPostStats(state, FORUM_POSTS[0]).likes, FORUM_POSTS[0].likes + 1);
  state = toggleForumFlag(state, "likes", firstId);
  assert.deepEqual(state.likes, []);
  assert.deepEqual(state.saved, [firstId]);
  assert.equal(toggleForumFlag(state, "viewed", firstId), state);
  assert.equal(toggleForumFlag(state, "likes", "missing"), state);
});

test("bình luận tách theo bài, giữ spoiler và không xóa được bình luận mẫu", () => {
  let state = addForumComment(empty(), firstId, { authorName: "An", body: "Một nhận xét", spoiler: true }, "comment-test", now);
  assert.equal(getForumComments(state, firstId).at(-1).spoiler, true);
  assert.equal(getForumComments(state, FORUM_POSTS[3].id).length, 0);
  assert.equal(addForumComment(state, "missing", { authorName: "An", body: "hello" }, "comment-test2", now), state);
  assert.equal(addForumComment(state, firstId, { authorName: "An", body: " " }, "comment-test2", now), state);
  assert.equal(addForumComment(state, firstId, { authorName: "An", body: "hello" }, "comment-test", now), state);
  const originalCount = getForumComments(empty(), firstId).length;
  state = removeForumComment(state, firstId, "seed-c1");
  assert.equal(getForumComments(state, firstId).length, originalCount + 1);
  state = removeForumComment(state, firstId, "comment-test");
  assert.equal(getForumComments(state, firstId).length, originalCount);
});

test("lọc, tìm tiếng Việt không dấu và sắp xếp không thay đổi dữ liệu gốc", () => {
  const state = addForumPost(empty(), input, "post-newest", now);
  const latest = filterForumPosts(state, normalizeFilters({ sort: "latest" }));
  assert.equal(latest[0].id, "post-newest");
  const theory = filterForumPosts(state, normalizeFilters({ category: "theory" }));
  assert.ok(theory.length > 0 && theory.every((post) => post.category === "theory"));
  assert.ok(filterForumPosts(state, normalizeFilters({ q: "THU VIEN ANH TRANG" })).some((post) => post.id === firstId));
  assert.ok(filterForumPosts(state, normalizeFilters({ q: "ha linh" })).every((post) => post.authorName === "Hà Linh"));
  assert.equal(filterForumPosts(state, normalizeFilters({ q: "not-a-real-query" })).length, 0);
  assert.equal(FORUM_POSTS[0].id, firstId);
});

test("URL lọc được mã hóa và tham số sai không gây lỗi", () => {
  assert.equal(forumHref({ sort: "latest", category: "theory", query: "ánh trăng & bạn", saved: true }), "/forum?sort=latest&category=theory&q=%C3%A1nh+tr%C4%83ng+%26+b%E1%BA%A1n&saved=1");
  assert.deepEqual(normalizeFilters({ sort: "invalid", category: "invalid", q: ["x"], saved: "no" }), { sort: "trending", category: "all", query: "", saved: false });
  const state = toggleForumFlag(empty(), "saved", firstId);
  assert.equal(filterForumPosts(state, normalizeFilters({ saved: "1" }))[0].id, firstId);
});

test("giới hạn số bài và bình luận mà không làm mất dữ liệu cũ", () => {
  let state = empty();
  for (let i = 0; i < 100; i++) state = addForumPost(state, input, `post-${i}`, now);
  assert.equal(addForumPost(state, input, "post-overflow", now), state);
  for (let i = 0; i < 100; i++) state = addForumComment(state, firstId, { authorName: "An", body: "Bình luận" }, `comment-${i}`, now);
  assert.equal(addForumComment(state, firstId, { authorName: "An", body: "Bình luận" }, "comment-overflow", now), state);
  assert.equal(state.posts.length, 100);
  assert.equal(state.comments[firstId].length, 100);
});
