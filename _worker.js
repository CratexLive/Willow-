export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrlParam = url.searchParams.get('url');

    // Agar URL parameter nahi hai, toh built-in HTML player dikhao
    if (!targetUrlParam) {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HLS Player</title>
    <style>
        body { margin: 0; background: #000; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; color: #fff; }
        video { width: 100%; max-height: 85vh; }
        .input-box { margin-bottom: 15px; display: flex; gap: 10px; width: 90%; max-width: 600px; }
        input { flex: 1; padding: 10px; background: #222; border: 1px solid #444; color: #fff; border-radius: 4px; }
        button { padding: 10px 20px; background: #e50914; color: white; border: none; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="input-box">
        <input type="text" id="streamUrl" placeholder="Paste .m3u8 URL here...">
        <button onclick="playStream()">Play</button>
    </div>
    <video id="video" controls autoplay></video>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <script>
        function playStream() {
            const rawUrl = document.getElementById('streamUrl').value.trim();
            if (!rawUrl) return;
            const proxyUrl = window.location.origin + '/?url=' + encodeURIComponent(rawUrl);
            const video = document.getElementById('video');
            
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(proxyUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = proxyUrl;
                video.addEventListener('loadedmetadata', () => video.play());
            }
        }
    </script>
</body>
</html>`;
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
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
