import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNoDbError } from "@/server/http";

// Dữ liệu trang hồ sơ. Thông tin riêng tư (email, SĐT, ngày sinh, giới tính) chỉ trả khi
// người xem chính là chủ hồ sơ.

const GENDER_LABELS = { male: "Nam", female: "Nữ", other: "Khác" };
const STATUS_LABELS = { ongoing: "Đang cập nhật", completed: "Hoàn thành" };

function findUser(supabase, idOrUsername, fields) {
  const column = /^\d+$/.test(idOrUsername) ? "user_id" : "username";
  return supabase.from("users").select(fields).eq(column, idOrUsername).maybeSingle();
}

export const getProfilePage = cache(async (idOrUsername, viewerId) => {
  const supabase = createAdminClient();
  const { data: user, error } = await findUser(
    supabase,
    decodeURIComponent(idOrUsername),
    "user_id, username, email, role, created_at, count_follower, count_following, profile:profiles(avatar, bio, fb_link, birthday, gender, phone_number)",
  );
  assertNoDbError(error);
  if (!user) return null;

  const isOwnProfile = viewerId === user.user_id;
  const [novels, reviews, following, isFollowing] = await Promise.all([
    supabase.from("novels")
      .select("novel_id, title, slug, description, cover_url, status, count_chapter, published")
      .eq("author_id", user.user_id)
      // Chủ hồ sơ thấy cả truyện chưa xuất bản; người khác chỉ thấy truyện đã xuất bản.
      .in("published", isOwnProfile ? [true, false] : [true])
      .order("updated_at", { ascending: false }),
    supabase.from("reviews")
      .select("review_id, rating, content, created_at, novel:novels(title, slug, published)")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("follows")
      .select("followed:users!fk_follows_follow(user_id, username)")
      .eq("follower_id", user.user_id)
      .order("created_at", { ascending: false })
      .limit(50),
    viewerId && !isOwnProfile
      ? supabase.from("follows").select("follower_id", { head: true, count: "exact" }).eq("follower_id", viewerId).eq("follow_id", user.user_id)
      : Promise.resolve({ count: 0 }),
  ]);
  for (const result of [novels, reviews, following, isFollowing]) assertNoDbError(result.error);

  const profile = user.profile ?? {};
  return {
    id: user.user_id,
    name: user.username,
    username: user.username,
    role: user.role,
    bio: profile.bio ?? "",
    avatar: profile.avatar ?? "",
    facebook: profile.fb_link ?? "",
    createdAt: user.created_at,
    followers: user.count_follower,
    following: user.count_following,
    isFollowing: (isFollowing.count ?? 0) > 0,
    // Riêng tư
    ...(isOwnProfile && {
      email: user.email,
      phone: profile.phone_number ?? "",
      birthday: profile.birthday ?? "",
      gender: profile.gender ?? "",
      genderLabel: GENDER_LABELS[profile.gender] ?? "",
    }),
    stories: novels.data.map((novel) => ({
      id: novel.novel_id,
      href: novel.published ? `/novels/${novel.slug}` : `/Writer/novels/${novel.novel_id}`,
      title: novel.title,
      chapters: novel.count_chapter,
      status: novel.published ? STATUS_LABELS[novel.status] : "Chưa xuất bản",
      description: novel.description,
      cover: novel.cover_url,
    })),
    posts: [],
    reviews: reviews.data
      .filter((review) => review.novel?.published)
      .map((review) => ({ id: review.review_id, title: review.novel.title, href: `/novels/${review.novel.slug}`, rating: review.rating, content: review.content ?? "" })),
    followingUsers: following.data
      .filter((row) => row.followed)
      .map((row) => ({ id: row.followed.user_id, name: row.followed.username, username: row.followed.username })),
  };
});
