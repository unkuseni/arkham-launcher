import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	const policySignedCookie = request.cookies.get("policy_signed");

	// If the user is trying to access the dashboard and the policy_signed cookie is not 'true'
	if (request.nextUrl.pathname.startsWith("/dashboard")) {
		if (!policySignedCookie || policySignedCookie.value !== "true") {
			// Redirect them to the home page
			return NextResponse.redirect(new URL("/", request.url));
		}
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - / (the home page itself, to avoid redirect loop if cookie is missing)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico).*)",
		// Explicitly include /dashboard and its subpaths for the check
		"/dashboard/:path*",
	],
};
