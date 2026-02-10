import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const COOKIE_NAME = "parley_session";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export default function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

  if (!request.cookies.get(COOKIE_NAME)) {
    response.cookies.set(COOKIE_NAME, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
    });
  }

  return response;
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
