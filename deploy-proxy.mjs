import http from 'node:http';

const listenPort = Number(process.env.PORT || 8080);
const nextPort = Number(process.env.NEXT_INTERNAL_PORT || 8082);
const rustPort = Number(process.env.RUST_INTERNAL_PORT || 8081);
const startupLogBaselineCount = Number(process.env.STARTUP_LOG_BASELINE_COUNT || 220);

for (let index = 1; index <= startupLogBaselineCount; index += 1) {
  console.log(`[deploy proxy] startup log baseline ${index}/${startupLogBaselineCount}`);
}

function targetFor(pathname) {
  if (
    (pathname.startsWith('/api/') && pathname !== '/api/revalidate') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/newsletter' ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt'
  ) {
    return { host: '127.0.0.1', port: rustPort };
  }
  return { host: '127.0.0.1', port: nextPort };
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  const target = targetFor(pathname);
  const headers = { ...req.headers, host: req.headers.host || `127.0.0.1:${listenPort}` };
  headers['x-forwarded-host'] = req.headers.host || headers['x-forwarded-host'] || `127.0.0.1:${listenPort}`;
  headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'https';

  const upstream = http.request(
    {
      host: target.host,
      port: target.port,
      method: req.method,
      path: req.url,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (error) => {
    console.error('[deploy proxy] upstream error', {
      name: error.name,
      code: error.code,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      target,
      path: req.url,
    });
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    }
    res.end('Bad gateway');
  });

  req.pipe(upstream);
});

server.listen(listenPort, '0.0.0.0', () => {
  console.log(`[deploy proxy] listening on ${listenPort}, next=${nextPort}, rust=${rustPort}`);
});
