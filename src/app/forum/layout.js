import localFont from "next/font/local";
import "@/components/forum/forum.css";

const forumFont = localFont({ src: "../../components/reader/fonts/BeVietnamPro-Regular.ttf", weight: "400", display: "swap", variable: "--forum-font", fallback: ["Arial", "sans-serif"] });

export default function ForumLayout({ children }) {
  return <div className={forumFont.variable}>{children}</div>;
}
