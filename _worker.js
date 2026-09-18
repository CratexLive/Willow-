export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return env.ASSETS.fetch(request);
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

    const forwardHeaders = new Headers();
    forwardHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36");

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
      });

      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("mpegurl") || targetUrl.includes(".m3u8")) {
        const manifest = await response.text();
        const rewritten = manifest.split("\n").map(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            try {
              const absUrl = new URL(trimmed, targetUrl).href;
              return `${url.origin}/?url=${encodeURIComponent(absUrl)}`;
            } catch {
              return line;
            }
          }
          return line;
        }).join("\n");

        return new Response(rewritten, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        });
      }

      const mediaRes = new Response(response.body, response);
      mediaRes.headers.set("Access-Control-Allow-Origin", "*");
      return mediaRes;
    } catch (err) {
      return new Response(err.message, { 
        status: 502, 
        headers: { "Access-Control-Allow-Origin": "*" } 
      });
    }
  },
};
