export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    if (!targetUrl) {
      return env.ASSETS.fetch(request);
    }

    try {
      const targetUrlObj = new URL(targetUrl);
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
          "Referer": "https://www.sonyliv.com/",
          "Origin": "https://www.sonyliv.com/"
        }
      });

      // Fetch as ArrayBuffer to handle both text (.m3u8) and binary video (.ts) files
      let body = await response.arrayBuffer(); 
      const responseHeaders = new Headers(response.headers);
      
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
      responseHeaders.set("Access-Control-Allow-Headers", "*");

      const contentType = responseHeaders.get("Content-Type") || "";
      
      // Only rewrite content if it's a playlist (.m3u8)
      if (targetUrl.includes(".m3u8") || contentType.includes("mpegurl")) {
        let text = new TextDecoder("utf-8").decode(body);
        const basePath = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
        const searchParams = targetUrlObj.search; // Capture the ?hdnea= token

        const rewrittenManifest = text.split("\n").map(line => {
          line = line.trim();
          if (!line) return "";
          
          if (line.startsWith("#EXT-X-KEY:") && line.includes("URI=\"")) {
            const uriMatch = line.match(/URI="(.*?)"/);
            if (uriMatch && uriMatch[1]) {
              let absoluteUrl = uriMatch[1].startsWith("http") ? uriMatch[1] : (uriMatch[1].startsWith("/") ? `${targetUrlObj.origin}${uriMatch[1]}` : `${basePath}${uriMatch[1]}`);
              if (!absoluteUrl.includes('?') && searchParams) absoluteUrl += searchParams;
              return line.replace(uriMatch[1], `${url.origin}/?url=${encodeURIComponent(absoluteUrl)}`);
            }
          }
          
          if (!line.startsWith("#")) {
            let absoluteUrl = line.startsWith("http") ? line : (line.startsWith("/") ? `${targetUrlObj.origin}${line}` : `${basePath}${line}`);
            if (!absoluteUrl.includes('?') && searchParams) absoluteUrl += searchParams;
            return `${url.origin}/?url=${encodeURIComponent(absoluteUrl)}`;
          }
          
          return line;
        }).join("\n");
        
        body = new TextEncoder().encode(rewrittenManifest);
        responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
      }

      responseHeaders.delete("Content-Length");

      return new Response(body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
};
