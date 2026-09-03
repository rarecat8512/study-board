import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("올바른 이메일 형식이 아닙니다.").max(255)),
  password: z
    .string()
    .min(8, "비밀번호는 최소 8자여야 합니다.")
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
      message: "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다."
    }),
  name: z.string().trim().min(2, "이름은 최소 2자여야 합니다.").max(50)
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, "인증 토큰이 필요합니다.")
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("올바른 이메일 형식이 아닙니다.").max(255)),
  password: z.string().min(1, "비밀번호를 입력해주세요.")
});

const securePasswordSchema = z
  .string()
  .min(8, "비밀번호는 최소 8자여야 합니다.")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
    message: "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다."
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요."),
    newPassword: securePasswordSchema,
    newPasswordConfirm: z.string().min(1, "새 비밀번호 확인을 입력해주세요.")
  })
  .refine((input) => input.newPassword === input.newPasswordConfirm, {
    path: ["newPasswordConfirm"],
    message: "새 비밀번호가 일치하지 않습니다."
  });

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요.")
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
