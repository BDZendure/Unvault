import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata)
     * - api/paddle/webhook (webhook reads its own raw body and verifies signature)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/paddle/webhook|monitoring).*)',
  ],
};
