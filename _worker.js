export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sony Live Player</title>
    <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
    <style>
        body { margin: 0; background-color: #000; display: flex; justify-content: center; align-items: center; height: 100vh; }
        .player-wrapper { width: 100%; max-width: 800px; }
    </style>
</head>
<body>
    <div class="player-wrapper">
        <video id="player" controls crossorigin playsinline muted></video>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.15"></script>
    <script src="https://cdn.plyr.io/3.7.8/plyr.js"></script>
    <script>
        const video = document.getElementById('player');
        // Yahan apni Sony wali m3u8 link daal sakte hain
        const streamUrl = "https://sonydaimenew.akamaized.net/hls/live/2094590/cricodi1809/TAM/std_lrh-800300010.m3u8?hdnea=exp=1789747035~acl=/*~id=85257464605952000924575211579778~hmac=94e2175eab0b98450236e44060c28f2045535837604668e0ebfc193418355714";
        
        const source = \`\${window.location.origin}/?url=\${encodeURIComponent(streamUrl)}\`;

        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 30
            });
            hls.loadSource(source);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                const player = new Plyr(video, {
                    autoplay: true,
                    controls: ['play-large', 'play', 'mute', 'volume', 'settings', 'fullscreen']
                });
                player.play();
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = source;
            video.addEventListener('loadedmetadata', () => {
                const player = new Plyr(video, { autoplay: true });
                player.play();
            });
        }
    </script>
</body>
</html>`;
      return new Response(html, {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // Sony ke liye headers adjust kiye gaye hain
    const forwardHeaders = new Headers();
    forwardHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    forwardHeaders.set("Referer", "https://www.sonyliv.com/");
    forwardHeaders.set("Origin", "https://www.sonyliv.com");

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
      });

      const contentType = response.headers.get("content-type"] || "";
      const isManifest = contentType.includes("mpegurl") || targetUrl.includes(".m3u8");

      if (isManifest) {
        const manifestText = await response.text();
        
        const rewrittenManifest = manifestText
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
              try {
                const absoluteUrl = new URL(trimmed, targetUrl).href;
                return `${url.origin}/?url=${encodeURIComponent(absoluteUrl)}`;
              } catch (e) {
                return line;
              }
            }
            return line;
          })
          .join("\n");

        return new Response(rewrittenManifest, {
          status: response.status,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        });
      }

      const mediaResponse = new Response(response.body, response);
      mediaResponse.headers.set("Access-Control-Allow-Origin", "*");
      return mediaResponse;
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  },
};
