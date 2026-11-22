
"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  UserPlus,
  UserCheck,
  MessageCircle,
} from "lucide-react";
import { toggleFollow } from "@/app/users/actions";

export default function ProfileActions({
  userId,
  followers,
  following,
  initialFollowing = false,
  isOwnProfile,
  signedIn = false,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // Hiển thị ngay (optimistic), rồi đồng bộ lại theo kết quả server.
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(followers ?? 0);
  const [message, setMessage] = useState("");

  function handleFollow() {
    if (!signedIn) {
      router.push(`/auth?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const previous = { isFollowing, followerCount };
    setIsFollowing(!isFollowing);
    setFollowerCount((count) => count + (isFollowing ? -1 : 1));
    setMessage("");

    startTransition(async () => {
      const result = await toggleFollow(userId);
      if (result?.error) {
        setIsFollowing(previous.isFollowing);
        setFollowerCount(previous.followerCount);
        setMessage(result.error);
        return;
      }
      setMessage(result.following ? "Đã theo dõi!" : "Đã bỏ theo dõi!");
      router.refresh();
    });
  }

  function handleMessage() {
    setMessage("Tính năng nhắn tin chưa được tích hợp.");
  }

  return (

    <div className="w-full">

      {/* Thống kê */}
      <div className="flex gap-8">
        <div>
          <p className="text-xl font-bold">
            {followerCount}
          </p>
          <p className="text-sm text-gray-500">
            Followers
          </p>
        </div>

        <div>
          <p className="text-xl font-bold">
            {following ?? 0}
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
            disabled={pending}
            aria-pressed={isFollowing}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
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
