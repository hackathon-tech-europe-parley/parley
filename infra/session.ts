import { cookies } from "next/headers";

const COOKIE_NAME = "parley_session";

export async function getSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}
