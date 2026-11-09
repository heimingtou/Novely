export function createWriterStatistics(novel, now = new Date()) {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index);
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const chapters = Array.isArray(novel.chapters) ? novel.chapters : [];

  return {
    title: novel.title,
    img: novel.coverImage,
    readers: 0,
    views: 0,
    chapters: chapters.length,
    daily: {
      dates,
      readers: dates.map(() => 0),
      votes: dates.map(() => 0),
      comments: dates.map(() => 0),
    },
    chapterEngagement: {
      chapters: chapters.slice(0, 10).map((chapter, index) => `Chương ${chapter.number || index + 1}`),
      reads: chapters.slice(0, 10).map(() => 0),
      votes: chapters.slice(0, 10).map(() => 0),
      comments: chapters.slice(0, 10).map(() => 0),
    },
    demographics: {
      age: [],
      gender: [],
    },
  };
}
