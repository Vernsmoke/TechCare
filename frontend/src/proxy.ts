import { NextRequest, NextResponse } from 'next/server';
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const socketOrigin = new URL(process.env.TECHCARE_ORIGIN || request.url);
  socketOrigin.protocol = socketOrigin.protocol === 'https:' ? 'wss:' : 'ws:';
  const csp =
    "default-src 'self'; script-src 'self' 'nonce-" +
    nonce +
    "' 'strict-dynamic'" +
    (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '') +
    "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob: https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; connect-src 'self' " +
    socketOrigin.origin +
    "; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!api|_next/static|_next/image|static/|favicon.ico).*)'] };
