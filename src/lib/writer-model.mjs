export const WRITER_STORAGE_KEY = "novely:v1:writer-drafts";
export function normalizeDrafts(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter(item => {
    if (!item || typeof item.id !== "string" || !/^(draft-[a-z0-9-]+|[1-3])$/.test(item.id) || seen.has(item.id)
      || typeof item.title !== "string" || !item.title.trim() || typeof item.body !== "string" || !Number.isFinite(Date.parse(item.date))) return false;
    seen.add(item.id); return true;
  }).slice(0, 100).map(item => ({ id: item.id, title: item.title.trim().slice(0, 150), body: item.body.slice(0, 50000), date: item.date, series: item.series === true }));
}
