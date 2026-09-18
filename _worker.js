export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrlParam = url.searchParams.get('url');

    // Agar 'url' parameter nahi hai, toh static file (index.html) serve karo
    if (!targetUrlParam) {
      return env.ASSETS.fetch(request);
    }

    let targetUrl;
    try {
      targetUrl = new URL(targetUrlParam);
    } catch (e) {
      return new Response('Invalid URL', { status: 400 });
    }

    const newHeaders = new Headers(request.headers);
    newHeaders.set('Host', targetUrl.host);

    const modifiedRequest = new Request(targetUrl.toString(), {
      headers: newHeaders,
      method: request.method,
      body: request.body,
      redirect: 'follow'
    });

    try {
      const response = await fetch(modifiedRequest);
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegURL') || targetUrl.pathname.endsWith('.m3u8')) {
        let body = await response.text();
        const workerBase = `${url.protocol}//${url.host}/?url=`;

        const lines = body.split('\n');
        const rewrittenLines = lines.map(line => {
          line = line.trim();
          if (!line || line.startsWith('#')) {
            if (line.includes('URI="')) {
              return line.replace(/URI="(.*?)"/, (match, p1) => {
                let absoluteUri = p1.startsWith('http') ? p1 : new URL(p1, targetUrl.href).toString();
                return `URI="${workerBase}${encodeURIComponent(absoluteUri)}"`;
              });
            }
            return line;
          }
          let absoluteSegmentUrl = line.startsWith('http') ? line : new URL(line, targetUrl.href).toString();
          return `${workerBase}${encodeURIComponent(absoluteSegmentUrl)}`;
        });

        const newBody = rewrittenLines.join('\n');
        const newResponseHeaders = new Headers(response.headers);
        newResponseHeaders.set('Access-Control-Allow-Origin', '*');

        return new Response(newBody, {
          status: response.status,
          statusText: response.statusText,
          headers: newResponseHeaders
        });
      }

      const newResponseHeaders = new Headers(response.headers);
      newResponseHeaders.set('Access-Control-Allow-Origin', '*');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newResponseHeaders
      });

    } catch (err) {
      return new Response('Proxy Error: ' + err.message, { status: 500 });
    }
  }
};
