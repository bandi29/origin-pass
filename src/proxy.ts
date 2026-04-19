import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"

export default createMiddleware(routing)

export const config = {
  matcher: [
    "/",
    "/(fr|en|it)/:path*",
    "/((?!_next|_vercel|api|p|s|scan|auth|passports|scans|verifications|analytics|.*\\..*).*)",
  ],
}
