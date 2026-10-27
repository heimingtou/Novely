import { FORUM_CATEGORIES, FORUM_COMMENTS, FORUM_POSTS } from "../data/forum.mjs";
import { getNovel } from "../data/novels.mjs";

export const FORUM_STORAGE_KEY = "novely:v1:forum";
export const LOCAL_AUTHOR = "local-reader";
export const EMPTY_FORUM = Object.freeze({ version: 1, profile: { name: "Bạn" }, posts: [], comments: {}, likes: [], saved: [], viewed: [] });
export const POST_LIMIT = 100;
export const COMMENT_LIMIT = 100;
const validId = (id) => typeof id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(id);
const clean = (text, max) => typeof text === "string" ? text.trim().slice(0, max) : "";
const validDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const record = (value) => value && typeof value === "object" && !Array.isArray(value);
export const categoryById = (id) => FORUM_CATEGORIES.find((category) => category.id === id);

export function normalizeForumState(value) {
  const data = record(value) ? value : {};
  const posts = [];
  const ids = new Set(FORUM_POSTS.map((post) => post.id));
  for (const item of (Array.isArray(data.posts) ? data.posts : []).slice(0, POST_LIMIT)) {
    if (!item || !validId(item.id) || ids.has(item.id) || item.authorId !== LOCAL_AUTHOR || !categoryById(item.category)
      || !clean(item.title, 150) || !clean(item.body, 5000) || !clean(item.authorName, 40) || !validDate(item.createdAt)) continue;
    ids.add(item.id);
    posts.push({ id: item.id, authorId: LOCAL_AUTHOR, authorName: clean(item.authorName, 40), category: item.category,
      title: clean(item.title, 150), body: clean(item.body, 5000), novelId: getNovel(item.novelId)?.id || null,
      spoiler: item.spoiler === true, createdAt: item.createdAt, updatedAt: validDate(item.updatedAt) ? item.updatedAt : null, likes: 0, views: 0 });
  }
  const comments = {};
  for (const [postId, entries] of Object.entries(record(data.comments) ? data.comments : {})) {
    if (!ids.has(postId) || !Array.isArray(entries)) continue;
    const seen = new Set();
    comments[postId] = entries.slice(0, COMMENT_LIMIT).filter((comment) => {
      if (!comment || !validId(comment.id) || seen.has(comment.id) || comment.authorId !== LOCAL_AUTHOR
        || !clean(comment.authorName, 40) || !clean(comment.body, 2000) || !validDate(comment.createdAt)) return false;
      seen.add(comment.id); return true;
    }).map((comment) => ({ id: comment.id, authorId: LOCAL_AUTHOR, authorName: clean(comment.authorName, 40),
      body: clean(comment.body, 2000), spoiler: comment.spoiler === true, createdAt: comment.createdAt }));
  }
  const idList = (list) => [...new Set((Array.isArray(list) ? list : []).filter((id) => ids.has(id)))];
  return { version: 1, profile: { name: clean(data.profile?.name, 40) || "Bạn" }, posts, comments,
    likes: idList(data.likes), saved: idList(data.saved), viewed: idList(data.viewed) };
}

export function getForumPosts(state) { return [...state.posts, ...FORUM_POSTS]; }
export function getForumComments(state, postId) { return [...(FORUM_COMMENTS[postId] || []), ...(state.comments[postId] || [])]; }
export function getPostStats(state, post) {
  return { likes: post.likes + Number(state.likes.includes(post.id)), comments: getForumComments(state, post.id).length,
    views: post.views + Number(state.viewed.includes(post.id)) };
}

export function normalizeFilters(params = {}) {
  return { sort: params.sort === "latest" ? "latest" : "trending", category: categoryById(params.category)?.id || "all",
    query: clean(params.q, 100), saved: params.saved === "1" };
}

export function forumHref(filters = {}) {
  const params = new URLSearchParams();
  if (filters.sort === "latest") params.set("sort", "latest");
  if (categoryById(filters.category)) params.set("category", filters.category);
  if (filters.query?.trim()) params.set("q", filters.query.trim().slice(0, 100));
  if (filters.saved) params.set("saved", "1");
  return `/forum${params.size ? `?${params}` : ""}`;
}

function searchable(value) { return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }
export function filterForumPosts(state, filters) {
  const query = searchable(filters.query || "");
  return getForumPosts(state).filter((post) =>
    (filters.category === "all" || post.category === filters.category)
    && (!filters.saved || state.saved.includes(post.id))
    && (!query || searchable(`${post.title} ${post.body} ${post.authorName} ${getNovel(post.novelId)?.title || ""}`).includes(query))
  ).sort((a, b) => {
    if (filters.sort === "trending") {
      const score = (post) => { const stats = getPostStats(state, post); return stats.likes * 3 + stats.comments * 5 + stats.views * 0.03; };
      const difference = score(b) - score(a);
      if (difference) return difference;
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id);
  });
}

export function validatePostInput(input) {
  const errors = {};
  if (!clean(input.authorName, 40)) errors.authorName = "Nhập tên hiển thị của bạn.";
  if (!categoryById(input.category)) errors.category = "Chọn một chủ đề hợp lệ.";
  if (!clean(input.title, 150)) errors.title = "Nhập tiêu đề bài viết.";
  if (!clean(input.body, 5000)) errors.body = "Nhập nội dung bài viết.";
  if (typeof input.title !== "string" || input.title.length > 150) errors.title = "Tiêu đề tối đa 150 ký tự.";
  if (typeof input.body !== "string" || input.body.length > 5000) errors.body = "Nội dung tối đa 5.000 ký tự.";
  if (input.novelId && !getNovel(input.novelId)) errors.novelId = "Truyện được chọn không tồn tại.";
  return errors;
}

export function addForumPost(state, input, id, now) {
  if (Object.keys(validatePostInput(input)).length || state.posts.length >= POST_LIMIT || !validId(id)
    || !validDate(now) || getForumPosts(state).some((post) => post.id === id)) return state;
  return normalizeForumState({ ...state, profile: { name: input.authorName }, posts: [{ ...input, id, authorId: LOCAL_AUTHOR, createdAt: now }, ...state.posts] });
}

export function editForumPost(state, postId, input, now) {
  if (Object.keys(validatePostInput(input)).length || !validDate(now)) return state;
  return normalizeForumState({ ...state, posts: state.posts.map((post) => post.id === postId && post.authorId === LOCAL_AUTHOR
    ? { ...post, ...input, id: post.id, authorId: post.authorId, createdAt: post.createdAt, updatedAt: now } : post) });
}

export function removeForumPost(state, postId) {
  if (!state.posts.some((post) => post.id === postId && post.authorId === LOCAL_AUTHOR)) return state;
  return normalizeForumState({ ...state, posts: state.posts.filter((post) => post.id !== postId) });
}

export function toggleForumFlag(state, key, postId) {
  if (!["likes", "saved"].includes(key) || !getForumPosts(state).some((post) => post.id === postId)) return state;
  return { ...state, [key]: state[key].includes(postId) ? state[key].filter((id) => id !== postId) : [...state[key], postId] };
}

export function markForumViewed(state, postId) {
  if (state.viewed.includes(postId) || !getForumPosts(state).some((post) => post.id === postId)) return state;
  return { ...state, viewed: [...state.viewed, postId] };
}

export function addForumComment(state, postId, input, id, now) {
  if (!getForumPosts(state).some((post) => post.id === postId) || !validId(id) || !validDate(now)
    || !clean(input.authorName, 40) || !clean(input.body, 2000) || input.body.length > 2000
    || (state.comments[postId] || []).length >= COMMENT_LIMIT || getForumComments(state, postId).some((comment) => comment.id === id)) return state;
  return normalizeForumState({ ...state, profile: { name: input.authorName }, comments: { ...state.comments,
    [postId]: [...(state.comments[postId] || []), { ...input, id, authorId: LOCAL_AUTHOR, createdAt: now }] } });
}

export function removeForumComment(state, postId, commentId) {
  return { ...state, comments: { ...state.comments, [postId]: (state.comments[postId] || []).filter((comment) => comment.id !== commentId) } };
}
