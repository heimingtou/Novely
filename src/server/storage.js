import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/server/http";

// Tải ảnh lên Supabase Storage (bucket công khai "avatars" / "covers") và trả URL công khai.
const TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// Kiểm tra chữ ký file thật (magic bytes), không tin MIME type trình duyệt gửi lên.
function sniffType(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function isUploadedFile(value) {
  return value && typeof value === "object" && typeof value.arrayBuffer === "function" && value.size > 0;
}

export async function uploadImage(bucket, file, { prefix, maxBytes }) {
  if (file.size > maxBytes) throw new ApiError(400, "FILE_TOO_LARGE", `Ảnh không được lớn hơn ${Math.round(maxBytes / 1024)} KB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type) throw new ApiError(400, "BAD_FILE", "Chỉ hỗ trợ ảnh PNG, JPG hoặc WebP.");

  const path = `${prefix}/${crypto.randomUUID()}.${TYPES[type]}`;
  const storage = createAdminClient().storage.from(bucket);
  const { error } = await storage.upload(path, bytes, { contentType: type, upsert: false });
  if (error) {
    console.error("[storage] upload", error);
    throw new ApiError(500, "UPLOAD_FAILED", "Không tải được ảnh lên, vui lòng thử lại.");
  }
  return storage.getPublicUrl(path).data.publicUrl;
}

// Xoá ảnh cũ trong bucket của mình (bỏ qua URL ngoài, ví dụ ảnh seed từ picsum/dicebear).
export async function removeImage(bucket, publicUrl) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl?.indexOf(marker) ?? -1;
  if (index < 0) return;
  const { error } = await createAdminClient().storage.from(bucket).remove([publicUrl.slice(index + marker.length)]);
  if (error) console.error("[storage] remove", error);
}
