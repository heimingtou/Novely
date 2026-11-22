import "server-only";
import bcrypt from "bcryptjs";

// Tương thích với hash crypt(..., gen_salt('bf', 10)) mà seed tạo bằng pgcrypto ($2a$10$...).
const ROUNDS = 10;
let dummyHash;

export const hashPassword = (password) => bcrypt.hash(password, ROUNDS);

// Không tìm thấy tài khoản vẫn so sánh với một hash giả, để thời gian phản hồi như nhau
// (kẻ tấn công không đoán được email/username nào đã đăng ký dựa vào tốc độ trả lời).
export async function verifyPassword(password, hash) {
  dummyHash ??= await bcrypt.hash("novely-dummy-password", ROUNDS);
  const ok = await bcrypt.compare(password, hash || dummyHash);
  return Boolean(hash) && ok;
}
