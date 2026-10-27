"use client";

import { SearchIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { faker } from "@faker-js/faker";
import { useI18n } from "@/components/i18n/LocaleProvider";
import cardImg from "../../../public/CardStory.jpg";
import ListStory from "@/components/ListStory/ListStory";
import "./page.css";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export default function SearchPage() {
  const { t } = useI18n();
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [stories] = useState(() => Array.from({ length: 50 }, () => ({
    id: faker.string.uuid(), title: faker.book.title(),
    likes: faker.number.float({ min: 0.5, max: 5, fractionDigits: 1 }).toFixed(1) + "M",
    genres: "Fanfiction", coverImage: cardImg,
  })));
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const results = !ready ? [] : query ? stories.filter(story => story.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) : stories.slice(0, 5);
  return <div>
    <form className="containtSearch" role="search" onSubmit={event => { event.preventDefault(); setQuery(input.trim()); }}>
      <input type="search" aria-label={t("Tìm kiếm")} placeholder={t("search story")} value={input} onChange={event => setInput(event.target.value)} />
      <button type="submit" className="btn_searchBar" aria-label={t("Tìm kiếm")}><SearchIcon color="white" /></button>
    </form>
    <div className="resultSearch"><ListStory title={query ? t("Kết quả tìm kiếm cho “{0}”", [query]) : t("Đề xuất truyện")} DataStory={results} /></div>
  </div>;
}
