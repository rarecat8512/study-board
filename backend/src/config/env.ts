import "dotenv/config";
import { z } from "zod";

const optionalString = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());
const optionalEmail = z.preprocess((value) => value === "" ? undefined : value, z.email().optional());
const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.url(),
  APP_URL: z.url(),
  COOKIE_SECURE: booleanString.optional(),
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().positive().default(3306),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  BREVO_API_KEY: optionalString,
  BREVO_SENDER_EMAIL: optionalEmail,
  BREVO_SENDER_NAME: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).max(100).optional())
}).superRefine((value, context) => {
  const brevoValues = [value.BREVO_API_KEY, value.BREVO_SENDER_EMAIL, value.BREVO_SENDER_NAME];
  const configuredCount = brevoValues.filter(Boolean).length;
  if (configuredCount > 0 && configuredCount < brevoValues.length) {
    context.addIssue({ code: "custom", message: "Brevo 환경 변수 세 항목을 모두 설정해야 합니다." });
  }
  if (value.NODE_ENV === "production" && configuredCount !== brevoValues.length) {
    context.addIssue({ code: "custom", message: "운영 환경에는 Brevo 이메일 설정이 필요합니다." });
  }
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment variables", result.error.flatten().fieldErrors);
  throw new Error("Environment variable validation failed");
}

export const env = {
  ...result.data,
  COOKIE_SECURE: result.data.COOKIE_SECURE ?? result.data.NODE_ENV === "production"
};
