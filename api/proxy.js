const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyAgent = new HttpsProxyAgent('http://103.135.189.6:83'); 

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Provide ?url=");

    try {
        const response = await axios({
            method: 'GET',
            url: targetUrl,
            responseType: 'arraybuffer',
            httpsAgent: proxyAgent,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.sonyliv.com/",
                "Origin": "https://www.sonyliv.com/"
            }
        });

        const contentType = response.headers['content-type'] || '';
        
        if (targetUrl.includes(".m3u8") || contentType.includes("mpegurl")) {
            let manifestText = response.data.toString('utf-8');
            const targetUrlObj = new URL(targetUrl);
            const hdneaToken = targetUrlObj.searchParams.get("hdnea");

            const rewrittenManifest = manifestText.split("\n").map(line => {
                const trimmed = line.trim();
                if (!trimmed) return "";

                if (trimmed.startsWith("#EXT-X-KEY:") && trimmed.includes('URI="')) {
                    const uriMatch = trimmed.match(/URI="(.*?)"/);
                    if (uriMatch && uriMatch[1]) {
                        try {
                            let innerUrl = new URL(uriMatch[1], targetUrl);
                            if (hdneaToken) innerUrl.searchParams.set("hdnea", hdneaToken);
                            return trimmed.replace(uriMatch[1], `https://${req.headers.host}/api/proxy?url=${encodeURIComponent(innerUrl.href)}`);
                        } catch(e) { return trimmed; }
                    }
                }

                if (!trimmed.startsWith("#")) {
                    try {
                        let innerUrl = new URL(trimmed, targetUrl);
                        if (hdneaToken) innerUrl.searchParams.set("hdnea", hdneaToken);
                        return `https://${req.headers.host}/api/proxy?url=${encodeURIComponent(innerUrl.href)}`;
                    } catch (e) { return line; }
                }
                return line;
            }).join("\n");

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewrittenManifest);
        }

        res.setHeader('Content-Type', contentType);
        return res.send(response.data);

    } catch (error) {
        return res.status(500).send(error.message);
    }
};
