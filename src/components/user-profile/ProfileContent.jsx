
"use client";

import { useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import ProfileActions from "./ProfileActions";

export default function ProfileContent({
  initialUser,
  isOwnProfile,
}) {
  // Dữ liệu hồ sơ đang hiển thị
  const [profile, setProfile] = useState(initialUser);

  // Trạng thái mở form chỉnh sửa
  const [isEditing, setIsEditing] = useState(false);

  // Dữ liệu đang nhập trong form
  const [form, setForm] = useState({
    name: initialUser.name,
    username: initialUser.username,
    bio: initialUser.bio,
  });

  const [notice, setNotice] = useState("");

  // Mở form Edit Profile
  function handleEdit() {
    setForm({
      name: profile.name,
      username: profile.username,
      bio: profile.bio,
    });

    setNotice("");
    setIsEditing(true);
  }

  // Lưu thông tin chỉnh sửa trong React
  function handleSave(event) {
    event.preventDefault();

    const updatedProfile = {
      ...profile,
      name: form.name.trim(),
      username: form.username.trim(),
      bio: form.bio.trim(),
    };

    if (!updatedProfile.name || !updatedProfile.username) {
      return;
    }

    setProfile(updatedProfile);
    setIsEditing(false);
    setNotice("Đã cập nhật giao diện hồ sơ (chưa lưu lên máy chủ).");
  }

  return (
    <section className="rounded-2xl border border-gray-200 p-6 shadow-sm">

      {/* Avatar + tên */}
      <div className="flex items-center gap-5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-red-100 text-4xl font-bold text-[#FF5454]">
          {profile.name.charAt(0).toUpperCase()}
        </div>

        <div>
          <h2 className="text-2xl font-bold">
            {profile.name}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            @{profile.username}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            ID: {profile.id}
          </p>
        </div>
      </div>

      {/* Reader / Writer */}
      <div className="mt-6 flex gap-2">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800">
          Reader
        </span>

        {profile.storiesCount > 0 && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-600">
            Writer
          </span>
        )}
      </div>

      {/* Bio */}
      <p className="mt-5">
        {profile.bio}
      </p>

      {/* Followers + Follow/Message */}
      <ProfileActions
        followers={profile.followers}
        following={profile.following}
        isOwnProfile={isOwnProfile}
      />

      {/* Chỉ chủ hồ sơ mới có Edit Profile */}
      {isOwnProfile && (
        <div className="mt-6">
          <button
            type="button"
            onClick={handleEdit}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 px-5 py-3 font-semibold transition hover:bg-gray-100"
          >
            <Pencil size={18} />
            Edit Profile
          </button>
        </div>
      )}

      {notice && (
        <p className="mt-3 text-sm text-green-600" role="status">
          {notice}
        </p>
      )}

      {/* Form chỉnh sửa */}
      {isOwnProfile && isEditing && (
        <form
          onSubmit={handleSave}
          className="mt-6 space-y-4 rounded-xl border border-gray-200 p-5"
        >
          <h3 className="text-xl font-bold">
            Chỉnh sửa hồ sơ
          </h3>

          {/* Tên */}
          <div>
            <label
              htmlFor="profile-name"
              className="mb-2 block text-sm font-medium"
            >
              Tên hiển thị
            </label>

            <input
              id="profile-name"
              type="text"
              required
              maxLength={60}
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-transparent p-3"
            />
          </div>

          {/* Username */}
          <div>
            <label
              htmlFor="profile-username"
              className="mb-2 block text-sm font-medium"
            >
              Username
            </label>

            <input
              id="profile-username"
              type="text"
              required
              maxLength={30}
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-transparent p-3"
            />
          </div>

          {/* Bio */}
          <div>
            <label
              htmlFor="profile-bio"
              className="mb-2 block text-sm font-medium"
            >
              Giới thiệu
            </label>

            <textarea
              id="profile-bio"
              rows={3}
              maxLength={300}
              value={form.bio}
              onChange={(e) =>
                setForm({ ...form, bio: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-transparent p-3"
            />
          </div>

          {/* Save + Cancel */}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#FF5454] px-5 py-3 font-semibold text-white"
            >
              <Save size={18} />
              Save Changes
            </button>

            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-5 py-3"
            >
              <X size={18} />
              Cancel
            </button>
          </div>
        </form>
      )}

    </section>
  );
}
