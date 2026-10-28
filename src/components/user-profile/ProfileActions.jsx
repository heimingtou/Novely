
"use client";

import { useState } from "react";
import {
  UserPlus,
  UserCheck,
  MessageCircle,
} from "lucide-react";

export default function ProfileActions({
  followers,
  following,
  isOwnProfile,
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [message, setMessage] = useState("");

  function handleFollow() {
    const nextValue = !isFollowing;
    setIsFollowing(nextValue);

    setMessage(
      nextValue
        ? "Đã theo dõi trong phiên dùng thử!"
        : "Đã bỏ theo dõi trong phiên dùng thử!"
    );
  }

  function handleMessage() {
    setMessage("Tính năng nhắn tin chưa được tích hợp.");
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-5">

      {/* Thống kê */}
      <div className="flex gap-8">
        <div>
          <p className="text-xl font-bold">
            {followers + (isFollowing ? 1 : 0)}
          </p>
          <p className="text-sm text-gray-500">
            Followers
          </p>
        </div>

        <div>
          <p className="text-xl font-bold">
            {following}
          </p>
          <p className="text-sm text-gray-500">
            Following
          </p>
        </div>
      </div>

      {/* Chỉ người khác mới thấy Follow và Message */}
      {!isOwnProfile && (
        <div className="mt-6 flex flex-wrap gap-3">

          <button
            type="button"
            onClick={handleFollow}
            aria-pressed={isFollowing}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#FF5454] px-5 py-3 font-semibold text-white hover:opacity-90"
          >
            {isFollowing ? (
              <UserCheck size={20} />
            ) : (
              <UserPlus size={20} />
            )}

            {isFollowing ? "Following" : "Follow"}
          </button>

          <button
            type="button"
            onClick={handleMessage}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 px-5 py-3 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <MessageCircle size={20} />
            Message
          </button>

        </div>
      )}

      {message && !isOwnProfile && (
        <p className="mt-3 text-sm text-gray-500" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
