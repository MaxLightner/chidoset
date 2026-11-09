const SITE = 'chidoset.ir';
const APP = 'app.chidoset.ir';
const ADMIN = 'admin.chidoset.ir';
const redirect = url => Response.redirect(url.toString(), 302);

// Routing selects an entry point; APIs still enforce all account permissions.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405});
    if (url.hostname === `www.${SITE}`) {
      url.hostname = SITE;
      return Response.redirect(url.toString(), 308);
    }
    const production = [SITE, APP, ADMIN].includes(url.hostname);
    if (production && url.protocol !== 'https:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 308);
    }
    if (production && url.pathname === '/website') {
      url.hostname = SITE;
      url.pathname = '/';
      return redirect(url);
    }
    if (production && url.hostname !== SITE && url.pathname.startsWith('/website/')) {
      url.hostname = SITE;
      url.pathname = url.pathname.slice('/website'.length);
      return redirect(url);
    }
    if (production && url.hostname !== ADMIN && ['/central', '/central.html', '/admin', '/admin/'].includes(url.pathname)) {
      url.hostname = ADMIN;
      url.pathname = '/';
      return redirect(url);
    }
    if (url.hostname === SITE && ['/login', '/login.html', '/company.html', '/portal.html', '/company-studio.html', '/live-viewer.html', '/guest.html'].includes(url.pathname)) {
      url.hostname = APP;
      return redirect(url);
    }
    if (url.hostname === SITE && url.pathname.startsWith('/stores/')) {
      return new Response('صفحهٔ این فروشگاه هنوز منتشر نشده است.', {status: 404, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    }
    let assetPath = url.pathname;
    if (assetPath === '/' || assetPath === '/index.html') {
      assetPath = url.hostname === ADMIN ? '/central' : url.hostname === APP ? '/' : '/website/';
    }
    const assetUrl = new URL(url);
    assetUrl.pathname = assetPath;
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (headers.get('Content-Type')?.includes('text/html')) {
      headers.set('Cache-Control', 'no-store');
      if (!assetPath.startsWith('/website/')) headers.set('X-Robots-Tag', 'noindex, nofollow');
    }
    return new Response(response.body, {status: response.status, headers});
  }
};
