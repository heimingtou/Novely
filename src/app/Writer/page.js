"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import CardWriter from "@/components/CardWriter/cardwriter";
import Tabs from "@/components/Tabs/Tabs";
import WriterEditor from "@/components/WriterStatistics/WriterEditor";
import { writerStories } from "@/data/writer-stories.mjs";
import { useLocalStorageState } from "@/lib/useLocalStorageState";
import { normalizeDrafts, WRITER_DRAFT_STORAGE_KEY } from "@/lib/writer-model.mjs";
import { useI18n } from "@/components/i18n/LocaleProvider";
import "./page.css";

const EMPTY = [];
export default function WriterPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("published");
  const [drafts, setDrafts, ready, failed] = useLocalStorageState(WRITER_DRAFT_STORAGE_KEY, EMPTY, normalizeDrafts);
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState("");
  const stories = [...writerStories, ...drafts.filter(draft => !writerStories.some(story => story.id === draft.id)).map(draft => ({ ...draft, img: "/CardStory.jpg", view: 0, like: 0, comment: 0, current_chap: 0, draft: true }))];
  const filtered = stories.filter(story => activeTab === "published" ? !story.draft : activeTab === "series" ? story.series : true);
  return <div className="ContaintPage writer-page">
    <div className="titlePage"><h1>{t("Truyện đã viết")}</h1><button type="button" className="btn" disabled={!ready || drafts.length >= 100} onClick={() => setEditor({})}><Plus /><span>{t("Đăng truyện mới")}</span></button></div>
    <p className="writer-caption">{t("Số liệu minh họa. Bản nháp được lưu riêng trên trình duyệt này.")}</p>
    {failed && <p role="alert">{t("Không thể lưu trên trình duyệt. Thay đổi mới chỉ được giữ trong phiên này và sẽ mất khi tải lại.")}</p>}
    <p role="status">{t(notice)}</p>
    <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
    <div className="writer-content" id="writer-story-list">{filtered.map(story => <CardWriter key={story.id} {...story} onWrite={() => setEditor({ story: drafts.find(draft => draft.id === story.id) || story })} />)}</div>
    {editor && <WriterEditor story={editor.story} onClose={() => setEditor(null)} onSave={draft => {
      setDrafts(current => [draft, ...current.filter(item => item.id !== draft.id)]);
      setEditor(null); setActiveTab("all"); setNotice("Đã lưu bản nháp.");
    }} />}
  </div>;
}
