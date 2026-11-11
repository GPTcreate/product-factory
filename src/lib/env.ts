import { z } from "zod";

/**
 * Browser-safe environment. The app must fail fast with a useful message when
 * required configuration is missing, rather than rendering a broken dashboard.
 *
 * Only VITE_-prefixed, browser-safe values may ever appear here. Never read a
 * Supabase secret key, Google secret, refresh token, or Bing key in the client.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string()
    .url("VITE_SUPABASE_URL에 올바른 주소를 설정해 주세요."),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "VITE_SUPABASE_PUBLISHABLE_KEY 설정이 필요합니다."),
  VITE_APP_URL: z.string().url("VITE_APP_URL에 올바른 주소를 설정해 주세요."),
  // Your Supabase plan's database-size limit, in megabytes, used to draw the
  // usage gauge on the System page. Free = 500, Pro = 8192. Optional.
  VITE_DB_SIZE_LIMIT_MB: z.coerce.number().positive().default(500),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `화면 실행에 필요한 환경 설정이 없거나 올바르지 않습니다.\n` +
      `.env.example을 .env.local로 복사한 뒤 필요한 값을 설정해 주세요.\n${issues}`,
  );
}

export const env = parsed.data;
