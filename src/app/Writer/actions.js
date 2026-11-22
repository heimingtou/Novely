"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/server/auth/dal";
import { ApiError } from "@/server/http";
import { isUploadedFile } from "@/server/storage";
import { createNovel, deleteChapter, deleteNovel, saveChapter, updateNovel } from "@/server/services/writer";

const novelSchema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tiêu đề truyện.").max(120, "Tiêu đề truyện tối đa 120 ký tự."),
  description: z.string().trim().min(1, "Vui lòng nhập phần giới thiệu truyện.").max(3000, "Giới thiệu tối đa 3.000 ký tự."),
  status: z.enum(["ongoing", "completed"]).default("ongoing"),
  genreIds: z.array(z.coerce.number().int().positive()).min(1, "Vui lòng chọn ít nhất một thể loại.").max(10, "Chọn tối đa 10 thể loại."),
});

const chapterSchema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tên chương.").max(150, "Tên chương tối đa 150 ký tự."),
  content: z.string().trim().min(1, "Vui lòng nhập nội dung chương.").max(50000, "Nội dung chương tối đa 50.000 ký tự."),
});

function failure(error, scope) {
  if (error instanceof ApiError) return { error: error.message };
  console.error(`[writer] ${scope}`, error);
  return { error: "Không thể lưu lúc này, vui lòng thử lại." };
}

const optionalId = (value) => (value ? Number(value) : null);

function revalidateWriter() {
  revalidatePath("/Writer", "layout");
  revalidatePath("/"); // trang chủ, danh sách, chi tiết truyện công khai
  revalidatePath("/novels/[id]", "page");
}

export async function saveNovelAction(_prevState, formData) {
  try {
    const user = await assertUser();
    const parsed = novelSchema.safeParse({
      title: formData.get("title") ?? "",
      description: formData.get("description") ?? "",
      status: formData.get("status") || undefined,
      genreIds: formData.getAll("genre"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const cover = formData.get("cover");
    const coverFile = isUploadedFile(cover) ? cover : null;
    const novelId = optionalId(formData.get("novelId"));

    if (novelId) {
      await updateNovel(user, novelId, { ...parsed.data, coverFile });
      revalidateWriter();
      return { ok: true, novelId, message: "Đã cập nhật thông tin truyện." };
    }
    if (!coverFile) return { error: "Vui lòng chọn ảnh bìa PNG, JPG hoặc WebP (tối đa 750 KB)." };
    const id = await createNovel(user, { ...parsed.data, coverFile });
    revalidateWriter();
    return { ok: true, novelId: id, message: "Đã tạo truyện. Hãy thêm chương đầu tiên." };
  } catch (error) {
    return failure(error, "save novel");
  }
}

export async function deleteNovelAction(novelId) {
  try {
    await deleteNovel(await assertUser(), novelId);
    revalidateWriter();
    return { ok: true };
  } catch (error) {
    return failure(error, "delete novel");
  }
}

export async function saveChapterAction(_prevState, formData) {
  try {
    const user = await assertUser();
    const parsed = chapterSchema.safeParse({ title: formData.get("title") ?? "", content: formData.get("content") ?? "" });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const novelId = optionalId(formData.get("novelId"));
    if (!novelId) return { error: "Thiếu truyện cần thêm chương." };
    const chapterId = optionalId(formData.get("chapterId"));
    const publish = formData.get("intent") !== "draft";

    const id = await saveChapter(user, novelId, chapterId, { ...parsed.data, publish });
    revalidateWriter();
    return {
      ok: true,
      chapterId: id,
      updated: Boolean(chapterId),
      message: chapterId
        ? (publish ? "Đã cập nhật chương." : "Đã lưu bản nháp.")
        : (publish ? "Đã đăng chương. Bạn có thể viết chương tiếp theo." : "Đã lưu bản nháp. Bạn có thể viết chương tiếp theo."),
    };
  } catch (error) {
    return failure(error, "save chapter");
  }
}

export async function deleteChapterAction(novelId, chapterId) {
  try {
    await deleteChapter(await assertUser(), novelId, chapterId);
    revalidateWriter();
    return { ok: true };
  } catch (error) {
    return failure(error, "delete chapter");
  }
}
