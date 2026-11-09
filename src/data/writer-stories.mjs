import { novelStatistics } from "./novelStatistics.js";

// Cùng nguồn thông tin cho danh sách, trang chia sẻ và dashboard.
export const writerStories = Object.entries(novelStatistics).map(([id, stats]) => ({
  id, title: stats.title, img: stats.img, date: "2026-03-15T10:30:00Z",
  view: stats.views, like: stats.chapterEngagement.votes.reduce((sum, value) => sum + value, 0),
  comment: stats.chapterEngagement.comments.reduce((sum, value) => sum + value, 0),
  current_chap: stats.chapters, series: true,
}));
export const getWriterStory = id => writerStories.find(story => story.id === String(id));
