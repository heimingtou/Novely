
"use client";

import { useState } from "react";
import {
  BookOpen,
  PenLine,
  Star,
  MessageCircle,
  Heart,
} from "lucide-react";

// Các tab của User Profile
const tabs = [
  { id: "stories", label: "Stories", icon: PenLine },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "posts", label: "Posts", icon: MessageCircle },
];

// Dữ liệu mẫu - sẽ thay bằng API sau này
const readingList = [
  {
    id: 1,
    title: "Khu Vườn Mùa Hạ",
    progress: "12/30 chương",
    isFavourite: true,
  },
  {
    id: 2,
    title: "Ngôi Sao Cuối Cùng",
    progress: "8/20 chương",
    isFavourite: false,
  },
];

const stories = [
  {
    id: 1,
    title: "Thư Viện Ánh Trăng",
    chapters: 24,
    status: "Đang cập nhật",
  },
  {
    id: 2,
    title: "Những Ngày Mưa",
    chapters: 12,
    status: "Hoàn thành",
  },
];

const reviews = [
  {
    id: 1,
    title: "Khu Vườn Mùa Hạ",
    rating: 5,
    content: "Một câu chuyện nhẹ nhàng và rất cảm động!",
  },
  {
    id: 2,
    title: "Ngôi Sao Cuối Cùng",
    rating: 4,
    content: "Cốt truyện thú vị, nhân vật được xây dựng tốt.",
  },
];

const posts = [
  {
    id: 1,
    content: "Chương mới sẽ được đăng vào cuối tuần này! ✨",
    date: "12/10/2026",
  },
  {
    id: 2,
    content: "Cảm ơn mọi người đã ủng hộ truyện của mình!",
    date: "10/10/2026",
  },
];

export default function ProfileTabs({ userName }) {
  // State xác định tab đang chọn
  const [activeTab, setActiveTab] = useState("reading");

  return (
    <section className="mt-8 rounded-2xl border border-gray-200 p-6 shadow-sm dark:border-gray-700">

      {/* Thanh chuyển tab */}
      <div className="flex gap-6 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`flex shrink-0 cursor-pointer items-center gap-2 border-b-2 pb-4 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-[#FF5454] text-[#FF5454]"
                  : "border-transparent text-gray-500 hover:text-[#FF5454]"
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>


      {/* TAB STORIES */}
      {activeTab === "stories" && (
        <div className="mt-6">
          <h2 className="mb-4 text-xl font-bold">
            Published Stories
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {stories.map((story) => (
              <div
                key={story.id}
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
              >
                <h3 className="font-semibold">
                  {story.title}
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  {story.chapters} chương
                </p>

                <p className="mt-2 text-sm text-[#FF5454]">
                  {story.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB REVIEWS */}
      {activeTab === "reviews" && (
        <div className="mt-6">
          <h2 className="mb-4 text-xl font-bold">
            My Reviews
          </h2>

          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
              >
                <h3 className="font-semibold">
                  {review.title}
                </h3>

                <p className="mt-2 text-yellow-500">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </p>

                <p className="mt-2 text-sm">
                  {review.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB POSTS */}
      {activeTab === "posts" && (
        <div className="mt-6">
          <h2 className="mb-4 text-xl font-bold">
            Community Posts
          </h2>

          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
              >
                <h3 className="font-semibold">
                  {userName}
                </h3>

                <p className="mt-2">
                  {post.content}
                </p>

                <p className="mt-3 text-xs text-gray-500">
                  {post.date}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </section>
  );
}
