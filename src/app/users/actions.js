"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { GENDERS, PHONE_PATTERN, normalizeFacebookLink, validBirthday } from "@/lib/profile-model.mjs";
import { assertUser } from "@/server/auth/dal";
import { ApiError } from "@/server/http";
import { isUploadedFile, removeImage, uploadImage } from "@/server/storage";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const optional = (schema) => z.union([z.literal(""), schema]);

const profileSchema = z.object({
  username: z.string().trim()
    .min(3, "Username cần ít nhất 3 ký tự.").max(50, "Username tối đa 50 ký tự.")
    .regex(/^[a-zA-Z0-9_.]+$/, "Username chỉ gồm chữ không dấu, số, dấu chấm và gạch dưới."),
  email: z.string().trim().toLowerCase().max(255).email("Địa chỉ email không hợp lệ!"),
  bio: z.string().trim().max(300, "Giới thiệu tối đa 300 ký tự."),
  birthday: optional(z.string().refine((value) => validBirthday(value), "Ngày sinh không hợp lệ!")),
  gender: optional(z.enum(GENDERS.map((gender) => gender.value))),
  phone: optional(z.string().trim().regex(PHONE_PATTERN, "Số điện thoại phải có 9–14 chữ số!")),
  facebook: z.string().trim().max(500),
});

const errorMessage = (error) => (error instanceof ApiError ? error.message : "Không thể lưu hồ sơ lúc này, vui lòng thử lại.");

// Chỉ sửa được hồ sơ CỦA CHÍNH MÌNH: id lấy từ phiên đăng nhập, không lấy từ form.
export async function updateProfile(_prevState, formData) {
  try {
    const user = await assertUser();
    const parsed = profileSchema.safeParse({
      username: formData.get("username") ?? "",
      email: formData.get("email") ?? "",
      bio: formData.get("bio") ?? "",
      birthday: formData.get("birthday") ?? "",
      gender: formData.get("gender") ?? "",
      phone: formData.get("phone") ?? "",
      facebook: formData.get("facebook") ?? "",
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const input = parsed.data;
    const facebook = normalizeFacebookLink(input.facebook);
    if (facebook === null) return { error: "Link Facebook không hợp lệ. Hãy dùng facebook.com/tennguoidung hoặc một link hồ sơ Facebook." };

    const supabase = createAdminClient();
    const { data: current } = await supabase.from("profiles").select("avatar").eq("user_id", user.id).maybeSingle();

    const { error: userError } = await supabase
      .from("users")
      .update({ username: input.username, email: input.email, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (userError) {
      if (userError.code === "23505") return { error: userError.message.includes("email") ? "Email này đã được dùng cho tài khoản khác." : "Username đã có người dùng." };
      throw userError;
    }

    const avatarFile = formData.get("avatar");
    const avatar = isUploadedFile(avatarFile)
      ? await uploadImage("avatars", avatarFile, { prefix: String(user.id), maxBytes: AVATAR_MAX_BYTES })
      : current?.avatar ?? null;

    const { error: profileError } = await supabase.from("profiles").upsert({
      user_id: user.id,
      bio: input.bio || null,
      birthday: input.birthday || null,
      gender: input.gender || null,
      phone_number: input.phone || null,
      fb_link: facebook || null,
      avatar,
    });
    if (profileError) {
      if (avatar !== current?.avatar) await removeImage("avatars", avatar); // không để lại ảnh mồ côi
      throw profileError;
    }
    if (avatar !== current?.avatar) await removeImage("avatars", current?.avatar);

    revalidatePath("/", "layout"); // navbar hiển thị username/avatar mới
    return { ok: true, message: "Cập nhật hồ sơ thành công!" };
  } catch (error) {
    if (!(error instanceof ApiError)) console.error("[profile] update", error);
    return { error: errorMessage(error) };
  }
}

// Theo dõi / bỏ theo dõi. Trigger trong DB tự cập nhật count_follower / count_following.
export async function toggleFollow(targetId) {
  try {
    const user = await assertUser();
    const target = Number(targetId);
    if (!Number.isInteger(target) || target <= 0) return { error: "Người dùng không hợp lệ." };
    if (target === user.id) return { error: "Không thể tự theo dõi chính mình." };

    const supabase = createAdminClient();
    const { count } = await supabase.from("follows").select("follower_id", { head: true, count: "exact" })
      .eq("follower_id", user.id).eq("follow_id", target);
    const following = (count ?? 0) > 0;
    const { error } = following
      ? await supabase.from("follows").delete().eq("follower_id", user.id).eq("follow_id", target)
      : await supabase.from("follows").insert({ follower_id: user.id, follow_id: target });
    if (error) {
      if (error.code === "23503") return { error: "Người dùng không tồn tại." };
      throw error;
    }
    revalidatePath(`/users/${target}`);
    return { ok: true, following: !following };
  } catch (error) {
    if (!(error instanceof ApiError)) console.error("[profile] follow", error);
    return { error: errorMessage(error) };
  }
}
