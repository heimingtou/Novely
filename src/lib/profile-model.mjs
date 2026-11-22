// Quy tắc dữ liệu hồ sơ dùng chung cho form (client) và Server Action (server).

export const GENDERS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Khác" },
];

// Khớp CHECK constraint của profiles.phone_number: ^\+?[0-9]{9,14}$
export const PHONE_PATTERN = /^\+?[0-9]{9,14}$/;

// Chỉ cho phép đường dẫn Facebook thật, không chấp nhận URL của website khác.
// Có thể dán cả "facebook.com/username" hoặc "https://facebook.com/username".
// Trả "" nếu để trống, null nếu không hợp lệ.
export function normalizeFacebookLink(value) {
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

// YYYY-MM-DD, ngày có thật, không ở tương lai và không trước 1900 (khớp CHECK của DB).
export function validBirthday(birthday, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;
  const [year, month, day] = birthday.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day &&
    birthday >= "1900-01-01" &&
    birthday <= localToday
  );
}
