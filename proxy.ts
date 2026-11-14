import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE } from "@/lib/auth/shared"

/** Areas that need a signed-in person. The pages themselves re-check against the database. */
const GATED = /^\/(?:dashboard|o|admin|onboarding)(?:\/|$)/
const ORG_PATH = /^\/o\/([a-z0-9-]{1,40})(?:\/|$)/

/** Per-request nonce CSP plus the baseline security headers this dashboard always needs. */
export function proxy(request: NextRequest) {
  // Optimistic gate: no session cookie means no dashboard. The layout and every
  // server action still validate the session against the database.
  const { pathname, search } = request.nextUrl
  if (GATED.test(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", pathname + search)
    return NextResponse.redirect(login)
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const isDev = process.env.NODE_ENV === "development"
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ")

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("Content-Security-Policy", csp)
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "no-referrer")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  )
  response.headers.set("Cache-Control", "no-store")
  // Remember the company last opened, so /dashboard and sign-in land back in it.
  const org = ORG_PATH.exec(pathname)?.[1]
  if (org && request.cookies.get("last_org")?.value !== org)
    response.cookies.set("last_org", org, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    })
  return response
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
