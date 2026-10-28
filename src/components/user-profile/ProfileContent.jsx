"use client";

import { useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  BookOpen,
  Camera,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Mail,
  MessageCircle,
  Pencil,
  Save,
  Settings,
  Star,
  Users,
  X,
} from "lucide-react";
import ProfileActions from "./ProfileActions";

// Dữ liệu demo trước khi nối API. Có thể thay bằng initialUser.stories/posts/reviews.
const demoStories = [
  {
    id: "demo",
    title: "Thư Viện Ánh Trăng",
    chapters: 24,
    status: "Đang cập nhật",
    description: "Một câu chuyện kỳ ảo về những bí mật bên trong thư viện ánh trăng.",
  },
  {
    id: "nhung-ngay-mua",
    title: "Những Ngày Mưa",
    chapters: 12,
    status: "Hoàn thành",
    description: "Những ký ức dịu dàng qua từng mùa mưa.",
  },
];

const demoPosts = [
  { id: 1, content: "Chương mới sẽ được đăng vào cuối tuần này! ✨", date: "12/10/2026" },
  { id: 2, content: "Cảm ơn mọi người đã ủng hộ truyện của mình!", date: "10/10/2026" },
];

const demoReviews = [
  { id: 1, title: "Khu Vườn Mùa Hạ", rating: 5, content: "Một câu chuyện nhẹ nhàng và rất cảm động!" },
  { id: 2, title: "Ngôi Sao Cuối Cùng", rating: 4, content: "Cốt truyện thú vị, nhân vật được xây dựng tốt." },
];

const tabs = [
  { id: "about", label: "Giới thiệu" },
  { id: "discussions", label: "Hội thoại" },
  { id: "following", label: "Đang theo dõi" },
];

const fieldClass =
  "w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 outline-none transition focus:border-[#FF5454] focus:ring-2 focus:ring-[#FF5454]/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400";
const cardClass =
  "rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900";

function createForm(user) {
  return {
    name: user.name ?? "",
    username: user.username ?? "",
    bio: user.bio ?? "",
    avatar: user.avatar ?? "",
    birthday: user.birthday ?? "",
    gender: user.gender ?? "",
    phone: user.phone ?? "",
    email: user.email ?? "",
    facebook: user.facebook ?? "",
  };
}

// Chỉ cho phép đường dẫn Facebook thật, không chấp nhận URL của website khác.
// Có thể dán cả "facebook.com/username" hoặc "https://facebook.com/username".
// Facebook là thông tin công khai tùy chọn, không nằm trong các trường bắt buộc.
function normalizeFacebookLink(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    const allowedHosts = [
      "facebook.com", "www.facebook.com", "m.facebook.com",
      "web.facebook.com", "fb.com", "www.fb.com", "fb.me", "www.fb.me",
    ];
    if (
      !["https:", "http:"].includes(url.protocol) ||
      !allowedHosts.includes(url.hostname.toLowerCase()) ||
      url.username || url.password ||
      (url.pathname === "/" && !url.searchParams.has("id"))
    ) {
      return null;
    }
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

function validBirthday(birthday) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;
  const [year, month, day] = birthday.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day &&
    birthday <= localToday
  );
}

export default function ProfileContent({ initialUser, isOwnProfile }) {
  const [profile, setProfile] = useState(initialUser);
  const [form, setForm] = useState(() => createForm(initialUser));
  const [activeTab, setActiveTab] = useState("about");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Nếu sau này API trả danh sách thật, component sẽ ưu tiên danh sách đó.
  const stories = Array.isArray(profile.stories)
    ? profile.stories
    : Number(profile.storiesCount) > 0
      ? demoStories.slice(0, Number(profile.storiesCount))
      : [];
  const posts = Array.isArray(profile.posts) ? profile.posts : demoPosts;
  const reviews = Array.isArray(profile.reviews) ? profile.reviews : demoReviews;
  const followingUsers = Array.isArray(profile.followingUsers) ? profile.followingUsers : [];

  const avatar = isEditing ? form.avatar : profile.avatar;
  // An toàn cả với đường dẫn Facebook do API/initialUser cung cấp.
  const facebookUrl = normalizeFacebookLink(profile.facebook);
  const toastMessage = error || notice;
  const joinedAt = profile.joinedAt || profile.createdAt;
  const joinDate = joinedAt && !Number.isNaN(new Date(joinedAt).getTime())
    ? new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(joinedAt))
    : null;

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleEdit() {
    setForm(createForm(profile));
    setError("");
    setNotice("");
    setActiveTab("about");
    setIsEditing(true);
  }

  function handleCancel() {
    setForm(createForm(profile));
    setError("");
    setIsEditing(false);
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Ảnh đại diện không được lớn hơn 2MB.");
      event.target.value = "";
      return;
    }

    setError("");
    setIsLoadingAvatar(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") updateField("avatar", reader.result);
    };
    reader.onerror = () => setError("Không thể đọc ảnh. Hãy thử lại.");
    reader.onloadend = () => setIsLoadingAvatar(false);
    reader.readAsDataURL(file);
  }

  function handleSave(event) {
    event.preventDefault();
    if (!isOwnProfile || isLoadingAvatar) return;

    const updated = {
      ...profile,
      ...form,
      name: form.name.trim(),
      username: form.username.trim(),
      bio: form.bio.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      facebook: form.facebook.trim(),
    };
    const requiredFields = [
      ["Ảnh đại diện", updated.avatar],
      ["Tên hiển thị", updated.name],
      ["Username", updated.username],
      ["Ngày sinh", updated.birthday],
      ["Giới tính", updated.gender],
      ["Số điện thoại", updated.phone],
      ["Email", updated.email],
      ["Giới thiệu", updated.bio],
    ];
    const missing = requiredFields
      .filter(([, value]) => !String(value ?? "").trim())
      .map(([label]) => label);

    setNotice("");
    if (missing.length) {
      setError(`Vui lòng nhập đầy đủ: ${missing.join(", ")}`);
      return;
    }
    const facebookLink = normalizeFacebookLink(updated.facebook);
    if (facebookLink === null) {
      setError("Link Facebook không hợp lệ. Hãy dùng facebook.com/tennguoidung hoặc một link hồ sơ Facebook.");
      return;
    }
    updated.facebook = facebookLink;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updated.email)) {
      setError("Địa chỉ email không hợp lệ!");
      return;
    }
    if (!/^\+?[0-9]{9,15}$/.test(updated.phone)) {
      setError("Số điện thoại phải có 9–15 chữ số (có thể bắt đầu bằng +)!");
      return;
    }
    if (!validBirthday(updated.birthday)) {
      setError("Ngày sinh không hợp lệ!");
      return;
    }

    // Bản demo: chỉ lưu bằng React state; refresh trang sẽ trở về dữ liệu ban đầu.
    setProfile(updated);
    setError("");
    setIsEditing(false);
    setNotice("Cập nhật hồ sơ thành công (bản demo)!");
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setError("");
      setNotice("Đã sao chép liên kết hồ sơ!");
    } catch {
      setNotice("");
      setError("Không thể sao chép liên kết. Hãy thử lại trên HTTPS hoặc localhost.");
    }
  }

  function handleEmailShare() {
    const subject = encodeURIComponent(`Hồ sơ Novely của ${profile.name}`);
    const body = encodeURIComponent(window.location.href);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <section className="w-full space-y-5 text-gray-900 dark:text-gray-100">
      {/* Toast cố định phía trên màn hình */}
      {toastMessage && (
        <div
          role={error ? "alert" : "status"}
          className={`fixed left-1/2 top-5 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-start justify-between gap-3 rounded-xl px-5 py-4 text-white shadow-lg ${error ? "bg-red-600" : "bg-green-600"}`}
        >
          <div className="flex items-start gap-3">
            {error ? <AlertCircle size={22} className="shrink-0" /> : <CheckCircle2 size={22} className="shrink-0" />}
            <span className="text-sm font-semibold">{toastMessage}</span>
          </div>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => { setError(""); setNotice(""); }}
            className="shrink-0 cursor-pointer rounded p-0.5 text-white hover:bg-white/20"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Tên, avatar và hành động theo dõi */}
      <div className={`${cardClass} flex flex-wrap items-center gap-4 p-4 sm:p-5`}>
        <div className="relative shrink-0">
          {avatar ? (
            <Image src={avatar} alt={`Ảnh đại diện ${profile.name}`} width={84} height={84}
              unoptimized className="h-[84px] w-[84px] rounded-full object-cover" />
          ) : (
            <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-red-100 text-3xl font-bold text-[#FF5454] dark:bg-red-950">
              {(profile.name || "U").charAt(0).toUpperCase()}
            </div>
          )}
          {isOwnProfile && isEditing && (
            <label htmlFor="avatar-upload" title="Đổi ảnh đại diện"
              className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#FF5454] text-white">
              <Camera size={17} />
            </label>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold">{profile.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">@{profile.username}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">Reader</span>
            {(Number(profile.storiesCount) > 0 || stories.length > 0) && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-[#D43D3D] dark:bg-red-950 dark:text-red-300">Writer</span>
            )}
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <ProfileActions followers={profile.followers} following={profile.following} isOwnProfile={isOwnProfile} />
        </div>
      </div>

      {/* Thanh tab nằm ngang và nút chỉnh sửa nằm bên phải giống ảnh mẫu */}
      <div className={`${cardClass} flex flex-wrap items-center justify-between gap-x-4 px-4 sm:px-5`}>
        <nav aria-label="Trang cá nhân" className="flex min-w-0 flex-1 gap-4 overflow-x-auto sm:gap-7">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`shrink-0 cursor-pointer border-b-[3px] py-4 text-sm font-semibold transition sm:text-base ${activeTab === tab.id
                ? "border-[#FF6A3D] text-gray-900 dark:text-white"
                : "border-transparent text-gray-500 hover:text-[#FF5454] dark:text-gray-400 dark:hover:text-red-300"}`}>
              {tab.label}
            </button>
          ))}
        </nav>
        {isOwnProfile && (
          <button type="button" onClick={isEditing ? handleCancel : handleEdit}
            className="mb-3 mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-[#FF5454] hover:text-[#FF5454] dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:border-red-400 dark:hover:text-red-300">
            {isEditing ? <X size={18} /> : <Settings size={18} />}
            {isEditing ? "Đóng chỉnh sửa" : "Sửa Hồ sơ"}
          </button>
        )}
      </div>

      {/* Form mở ngay dưới thanh tab để giữ đúng luồng Edit Profile trước đó */}
      {isOwnProfile && isEditing && (
        <form onSubmit={handleSave} noValidate className={`${cardClass} space-y-5 p-5 sm:p-6`}>
          <div className="flex items-center gap-2">
            <Pencil size={20} className="text-[#FF5454]" />
            <h2 className="text-xl font-bold">Chỉnh sửa hồ sơ</h2>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Ảnh đại diện <span className="text-[#FF5454]">*</span></p>
            <input id="avatar-upload" type="file" accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange} className="peer sr-only" aria-label="Chọn ảnh đại diện" />
            <label htmlFor="avatar-upload"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition hover:border-[#FF5454] hover:bg-red-50 peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF5454] dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700">
              <span className="rounded-full bg-red-100 p-3 text-[#FF5454] dark:bg-red-950"><Camera size={25} /></span>
              <span className="text-sm font-semibold">Bấm để chọn ảnh đại diện</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG hoặc WEBP · Tối đa 2MB</span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="edit-name" className="mb-2 block text-sm font-semibold">Tên hiển thị *</label>
              <input id="edit-name" type="text" maxLength={60} value={form.name}
                onChange={(e) => updateField("name", e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="edit-username" className="mb-2 block text-sm font-semibold">Username *</label>
              <input id="edit-username" type="text" maxLength={30} value={form.username}
                onChange={(e) => updateField("username", e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="edit-birthday" className="mb-2 block text-sm font-semibold">Ngày sinh *</label>
              <input id="edit-birthday" type="date" value={form.birthday}
                onChange={(e) => updateField("birthday", e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="edit-gender" className="mb-2 block text-sm font-semibold">Giới tính *</label>
              <select id="edit-gender" value={form.gender}
                onChange={(e) => updateField("gender", e.target.value)} className={fieldClass}>
                <option value="">Chọn giới tính</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
                <option value="Không muốn tiết lộ">Không muốn tiết lộ</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-phone" className="mb-2 block text-sm font-semibold">Số điện thoại *</label>
              <input id="edit-phone" type="tel" maxLength={16} placeholder="Nhập số điện thoại" value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="edit-email" className="mb-2 block text-sm font-semibold">Email *</label>
              <input id="edit-email" type="email" maxLength={254} placeholder="example@gmail.com" value={form.email}
                onChange={(e) => updateField("email", e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div>
            <label htmlFor="edit-bio" className="mb-2 block text-sm font-semibold">Giới thiệu *</label>
            <textarea id="edit-bio" rows={3} maxLength={300} value={form.bio}
              onChange={(e) => updateField("bio", e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label htmlFor="edit-facebook" className="mb-2 block text-sm font-semibold">
              Facebook <span className="font-normal text-gray-500 dark:text-gray-400">(không bắt buộc)</span>
            </label>
            <input
              id="edit-facebook"
              type="text"
              inputMode="url"
              autoComplete="url"
              maxLength={500}
              placeholder="https://www.facebook.com/tennguoidung"
              value={form.facebook}
              onChange={(e) => updateField("facebook", e.target.value)}
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Thêm đường dẫn trang Facebook để người khác có thể ghé thăm. Để trống nếu không muốn hiển thị.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={isLoadingAvatar}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#FF5454] px-5 py-3 font-semibold text-white transition hover:bg-[#E44646] disabled:cursor-not-allowed disabled:opacity-50">
              <Save size={18} /> {isLoadingAvatar ? "Đang xử lý ảnh..." : "Lưu thay đổi"}
            </button>
            <button type="button" onClick={handleCancel}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700">
              <X size={18} /> Hủy
            </button>
          </div>
        </form>
      )}

      {/* Nội dung tab mặc định: Sidebar trái và Truyện bên phải giống hình */}
      {activeTab === "about" && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.05fr)]">
          <aside className="space-y-5">
            <div className={`${cardClass} overflow-hidden`}>
              <div className="space-y-3 p-5">
                <h2 className="text-lg font-bold">Giới thiệu</h2>
                <p className="whitespace-pre-wrap text-sm leading-7">{profile.bio || "Người dùng chưa viết giới thiệu."}</p>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {joinDate ? `Đã tham gia ${joinDate}` : "Thành viên Novely"}
                </p>
              </div>
              <div className="border-y border-gray-200 px-5 py-4 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Link2 size={18} className="text-[#FF5454]" />
                  <span className="truncate">Hồ sơ Novely · @{profile.username}</span>
                </div>
              </div>
              <div className="p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Chia sẻ hồ sơ</p>
                <div className="flex items-center gap-3">
                  {/* Facebook đứng đầu hàng chia sẻ hồ sơ */}
                  {facebookUrl ? (
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Mở trang Facebook"
                      title="Mở trang Facebook"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2] text-xl font-black text-white transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2]"
                    >
                      f
                    </a>
                  ) : (
                    <span
                      aria-label="Chưa thêm Facebook"
                      title="Chưa thêm Facebook. Chọn Sửa Hồ sơ để bổ sung."
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 text-xl font-black text-white dark:bg-gray-600"
                    >
                      f
                    </span>
                  )}
                  <button type="button" onClick={handleCopyLink}
                    aria-label="Sao chép liên kết" title="Sao chép liên kết"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#415E9B] text-white transition hover:opacity-80">
                    <Copy size={19} />
                  </button>
                  <button type="button" onClick={handleEmailShare}
                    aria-label="Chia sẻ qua email" title="Chia sẻ qua email"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#FF663D] text-white transition hover:opacity-80">
                    <Mail size={19} />
                  </button>
                  <button type="button" onClick={async () => {
                    if (typeof navigator.share === "function") {
                      try { await navigator.share({ title: `Hồ sơ ${profile.name}`, url: window.location.href }); }
                      catch (shareError) { if (shareError?.name !== "AbortError") setError("Không thể chia sẻ hồ sơ."); }
                    } else { handleCopyLink(); }
                  }}
                    aria-label="Chia sẻ hồ sơ" title="Chia sẻ hồ sơ"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-slate-700 text-white transition hover:opacity-80">
                    <ExternalLink size={19} />
                  </button>
                </div>
              </div>
            </div>

            {/* Chỉ chủ tài khoản mới xem thông tin nhạy cảm */}
            {isOwnProfile && (
              <div className={`${cardClass} p-5`}>
                <h3 className="mb-3 text-sm font-bold">Thông tin cá nhân <span className="font-normal text-gray-500 dark:text-gray-400">(chỉ mình bạn)</span></h3>
                <div className="space-y-2 break-words text-sm text-gray-600 dark:text-gray-300">
                  <p>Ngày sinh: {profile.birthday || "Chưa cập nhật"}</p>
                  <p>Giới tính: {profile.gender || "Chưa cập nhật"}</p>
                  <p>Số điện thoại: {profile.phone || "Chưa cập nhật"}</p>
                  <p>Email: {profile.email || "Chưa cập nhật"}</p>
                </div>
              </div>
            )}
          </aside>

          <div className={`${cardClass} min-w-0 p-5 sm:p-6`}>
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold sm:text-2xl">Truyện của {profile.name}</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{stories.length} truyện đã đăng (dữ liệu demo)</p>
              </div>
              <BookOpen className="shrink-0 text-gray-400" size={24} />
            </div>
            {stories.length === 0 ? (
              <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">Chưa có truyện nào được đăng.</p>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {stories.map((story) => (
                  <article key={story.id} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row">
                    <div className="flex h-44 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#FF5454]/20 to-amber-100 dark:from-red-950 dark:to-gray-800">
                      {story.cover ? (
                        <Image src={story.cover} alt={`Bìa truyện ${story.title}`} width={128} height={176}
                          unoptimized className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen size={42} className="text-[#FF5454]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="break-words text-lg font-bold">{story.title}</h3>
                      <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <BookOpen size={15} /> {story.chapters ?? story.chapterCount ?? 0} chương
                      </p>
                      {story.description && (
                        <p className="line-clamp-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{story.description}</p>
                      )}
                      <span className="inline-block rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-[#D43D3D] dark:bg-red-950 dark:text-red-300">
                        {story.status || "Đang cập nhật"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Hội thoại sử dụng Posts & Reviews trước đây */}
      {activeTab === "discussions" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className={`${cardClass} p-5 sm:p-6`}>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><MessageCircle size={20} /> Bài viết</h2>
            <div className="space-y-4">
              {posts.length ? posts.map((post) => (
                <article key={post.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="mb-2 font-semibold">{profile.name}</p>
                  <p className="whitespace-pre-wrap text-sm leading-6">{post.content}</p>
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{post.date}</p>
                </article>
              )) : <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có bài viết nào.</p>}
            </div>
          </div>
          <div className={`${cardClass} p-5 sm:p-6`}>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Star size={20} /> Đánh giá</h2>
            <div className="space-y-4">
              {reviews.length ? reviews.map((review) => (
                <article key={review.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="font-semibold">{review.title}</p>
                  <p className="mt-2 text-sm text-amber-500" aria-label={`${review.rating} trên 5 sao`}>
                    {"★".repeat(Math.min(5, Math.max(0, review.rating || 0)))}{"☆".repeat(5 - Math.min(5, Math.max(0, review.rating || 0)))}
                  </p>
                  <p className="mt-2 text-sm leading-6">{review.content}</p>
                </article>
              )) : <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có đánh giá nào.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Tab Theo dõi: chưa giả danh sách người dùng khi chưa có API */}
      {activeTab === "following" && (
        <div className={`${cardClass} p-5 sm:p-6`}>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Users size={21} /> Đang theo dõi</h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{profile.following ?? 0} người đang theo dõi</p>
          {followingUsers.length ? (
            <div className="space-y-3">
              {followingUsers.map((person) => (
                <div key={person.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="font-semibold">{person.name}</p>
                  {person.username && <p className="text-xs text-gray-500 dark:text-gray-400">@{person.username}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-gray-50 p-5 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              Danh sách người đang theo dõi sẽ hiển thị khi kết nối API.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
