export default {
  async fetch(request, env, ctx) {
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
    forwardHeaders.set("User-Agent", request.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    forwardHeaders.set("Referer", "https://www.sonyliv.com/");
    forwardHeaders.set("Origin", "https://www.sonyliv.com/");

    try {
      const targetUrlObj = new URL(targetUrl);
      // Explicitly extract the Akamai token
      const hdneaToken = targetUrlObj.searchParams.get("hdnea");

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
      });

      const contentType = response.headers.get("content-type") || "";
      const isManifest = contentType.includes("mpegurl") || targetUrl.includes(".m3u8");

      if (isManifest) {
        const manifestText = await response.text();
        
        const rewrittenManifest = manifestText
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return "";

            // Inject token into DRM Keys
            if (trimmed.startsWith("#EXT-X-KEY:") && trimmed.includes('URI="')) {
              const uriMatch = trimmed.match(/URI="(.*?)"/);
              if (uriMatch && uriMatch[1]) {
                try {
                  let innerUrl = new URL(uriMatch[1], targetUrl);
                  if (hdneaToken) innerUrl.searchParams.set("hdnea", hdneaToken);
                  return trimmed.replace(uriMatch[1], `${url.origin}/?url=${encodeURIComponent(innerUrl.href)}`);
                } catch(e) { return trimmed; }
              }
            }

            // Inject token into internal chunklists and video segments
            if (!trimmed.startsWith("#")) {
              try {
                let innerUrl = new URL(trimmed, targetUrl);
                if (hdneaToken) innerUrl.searchParams.set("hdnea", hdneaToken);
                return `${url.origin}/?url=${encodeURIComponent(innerUrl.href)}`;
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

      // Pass through binary video chunks (.ts)
      const mediaResponse = new Response(response.body, response);
      mediaResponse.headers.set("Access-Control-Allow-Origin", "*");
      return mediaResponse;
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  },
};
