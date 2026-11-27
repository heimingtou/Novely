import { z } from "zod";
import { ApiError } from "../../shared/errors/api-error.js";

// Preserve Next validation/messages, adapting checkbox values to JSON booleans.
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Vui lòng nhập email hoặc tên đăng nhập.").max(255),
  password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(200),
  rememberMe: z.boolean().default(false),
});
export const registerSchema = z.object({
  username: z.string().trim().min(3, "Tên đăng nhập cần ít nhất 3 ký tự.")
    .max(50, "Tên đăng nhập tối đa 50 ký tự.")
    .regex(/^[a-zA-Z0-9_.]+$/, "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm và gạch dưới."),
  email: z.string().trim().toLowerCase().max(255).email("Địa chỉ email không hợp lệ."),
  // Deliberately retain 6–200 characters, including legacy bcrypt truncation.
  password: z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự.").max(200, "Mật khẩu quá dài."),
  confirmPassword: z.string(),
  agreeTerms: z.literal(true, { message: "Vui lòng đồng ý với điều khoản sử dụng của Novely!" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp!", path: ["confirmPassword"],
});

export function parseInput(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError(400, "VALIDATION_ERROR", result.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
  return result.data;
}
