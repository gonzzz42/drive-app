import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Directory, File, Paths } from "expo-file-system";

// Supabase 연결.
// .env 파일의 EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY 를 읽는다.
// (.env를 바꾸면 npx expo start 를 다시 켜야 반영된다)

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// 로그인 세션을 앱을 껐다 켜도 유지하려면 저장소가 필요하다.
// 라이브러리를 더 넣지 않고 expo-file-system 파일 하나에 저장한다.
const authDir = new Directory(Paths.document, "auth");

function authFile(key: string): File {
  // key에 파일명으로 못 쓰는 글자가 있을 수 있어 단순화한다
  return new File(authDir, key.replace(/[^a-zA-Z0-9._-]/g, "_") + ".json");
}

const fileStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const f = authFile(key);
      return f.exists ? await f.text() : null;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!authDir.exists) authDir.create({ intermediates: true, idempotent: true });
    authFile(key).write(value);
  },
  async removeItem(key: string): Promise<void> {
    try {
      const f = authFile(key);
      if (f.exists) f.delete();
    } catch {
      // 없으면 그만
    }
  },
};

// .env가 비어 있으면 undefined. 그러면 서버 저장은 건너뛴다.
export const supabase: SupabaseClient | undefined =
  url.startsWith("https://") && anonKey.length > 20
    ? createClient(url, anonKey, {
        auth: {
          storage: fileStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : undefined;

// 로그인돼 있으면 그 사용자 id, 아니면 익명 로그인 후 id.
// Supabase 대시보드에서 "Allow anonymous sign-ins"를 켜야 한다.
export async function ensureSignedIn(): Promise<string> {
  if (!supabase) throw new Error("Supabase 설정이 없습니다 (.env 확인)");
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error("익명 로그인 실패");
  return anon.user.id;
}
