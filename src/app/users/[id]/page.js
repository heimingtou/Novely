
import { notFound, redirect } from "next/navigation";
import ProfileContent from "@/components/user-profile/ProfileContent";
import { getCurrentUser, requireUser } from "@/server/auth/dal";
import { getProfilePage } from "@/server/services/profiles";

export async function generateMetadata({ params }) {
  const { id } = await params;
  if (id === "me") return { title: "Hồ sơ của tôi | Novely" };
  const profile = await getProfilePage(id, null);
  return { title: profile ? `${profile.name} | Novely` : "Không tìm thấy người dùng | Novely" };
}

// /users/:id nhận user_id hoặc username; /users/me chuyển tới hồ sơ của người đang đăng nhập.
export default async function UserProfilePage({ params }) {
  const { id } = await params;
  if (id === "me") {
    const me = await requireUser("/users/me");
    redirect(`/users/${me.id}`);
  }

  const viewer = await getCurrentUser();
  const profile = await getProfilePage(id, viewer?.id ?? null);
  if (!profile) notFound();
  const isOwnProfile = viewer?.id === profile.id;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold">
        User Profile
      </h1>

      <ProfileContent
        initialUser={profile}
        isOwnProfile={isOwnProfile}
        signedIn={Boolean(viewer)}
      />

    </main>
  );
}
