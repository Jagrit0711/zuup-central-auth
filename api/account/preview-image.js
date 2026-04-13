function isAllowedHost(value) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "zuup.dev" || hostname.endsWith(".zuup.dev");
  } catch {
    return false;
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function svgFallback(title, subtitle) {
  const safeTitle = escapeXml(title || "Zuup");
  const safeSubtitle = escapeXml(subtitle || "Preview");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#111827" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#e8425a" />
          <stop offset="100%" stop-color="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="1200" height="700" fill="url(#bg)" />
      <circle cx="180" cy="140" r="130" fill="#e8425a" fill-opacity="0.16" />
      <circle cx="1020" cy="520" r="180" fill="#f59e0b" fill-opacity="0.12" />
      <rect x="70" y="70" width="1060" height="560" rx="34" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.12" />
      <text x="110" y="170" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="800" fill="#f8fafc">${safeTitle}</text>
      <text x="110" y="240" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="500" fill="#cbd5e1">${safeSubtitle}</text>
      <rect x="110" y="300" width="420" height="14" rx="7" fill="url(#accent)" />
      <rect x="110" y="340" width="560" height="12" rx="6" fill="#94a3b8" fill-opacity="0.25" />
      <rect x="110" y="372" width="480" height="12" rx="6" fill="#94a3b8" fill-opacity="0.18" />
      <rect x="110" y="404" width="360" height="12" rx="6" fill="#94a3b8" fill-opacity="0.12" />
      <text x="110" y="520" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600" fill="#e2e8f0">Zuup preview image</text>
    </svg>
  `;
}

function parseMetaImage(html, attrName) {
  const pattern = new RegExp(`<meta[^>]+${attrName}=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+${attrName}=["']([^"']+)["'][^>]*>`, "i");
  const match = html.match(pattern);
  if (!match) return "";
  return match[1] || match[2] || match[3] || match[4] || "";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed", expected: ["GET"] });
  }

  const source = String(req.query.url || "").trim();
  if (!source || !isAllowedHost(source)) {
    return res.status(400).send(svgFallback("Zuup", "Preview unavailable"));
  }

  const parsedUrl = new URL(source);
  const title = parsedUrl.hostname.replace(/^www\./, "");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(source, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ZuupPreview/1.0)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const html = await response.text();
      const ogImage = parseMetaImage(html, "property=\\"og:image\\"") || parseMetaImage(html, "name=\\"twitter:image\\"") || parseMetaImage(html, "name=\\"image\\"");
      if (ogImage) {
        const resolved = new URL(ogImage, source).toString();
        res.setHeader("Cache-Control", "no-store, max-age=0");
        return res.redirect(302, resolved);
      }
    }
  } catch {
    // Fall through to SVG fallback.
  }

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).send(svgFallback(title, "Live preview"));
}