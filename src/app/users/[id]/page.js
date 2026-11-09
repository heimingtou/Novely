
import { notFound } from "next/navigation";
import ProfileContent from "@/components/user-profile/ProfileContent";
// Dữ liệu mẫu

const user = {
  id: "minh-tho-ha",
  name: "Minh Thơ Hà",
  username: "minhthoha",
  bio: "Một người yêu sách và thích kể những câu chuyện kỳ ảo.",
  avatar: "",
  birthday: "",
  gender: "",
  phone: "",
  email: "",
  followers: 128,
  following: 64,
  storiesCount: 2,
};


// Giả lập người đang đăng nhập
const currentUserId = "minh-tho-ha";

export default async function UserProfilePage({ params }) {
  const { id } = await params;

  if (id !== user.id) {
    notFound();
  }

  const isOwnProfile = currentUserId === user.id;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold">
        User Profile
      </h1>

      <ProfileContent
        initialUser={user}
        isOwnProfile={isOwnProfile}
      />

    </main>
  );
}
