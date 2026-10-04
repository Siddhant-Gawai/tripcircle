import { readFile, writeFile, mkdir } from "node:fs/promises";
const places = JSON.parse(await readFile("src/catalogue.json", "utf8"));
const template = await readFile("dist/index.html", "utf8");
const base = "https://siddhant-gawai.github.io/tripcircle";
const esc = (s = "") =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
for (const p of places) {
  const url = `${base}/places/${p.id}/`;
  const title = `${p.name} · Peaceful trips from Ahmedabad · TripCircle`;
  const photo = p.details?.photos?.[0];
  const image = photo
    ? `${base}/photos/${photo.file.replace(/\.jpg$/, "-960.webp")}`
    : `${base}/photos/bordi-beach.jpg`;
  let html = template.replace(
    /<title>.*?<\/title>/,
    `<title>${esc(title)}</title>`,
  );
  for (const [attr, name, value] of [
    ["name", "description", p.summary],
    ["property", "og:title", title],
    ["property", "og:description", p.summary],
    ["property", "og:url", url],
    ["property", "og:image", image],
    ["property", "og:image:alt", photo?.caption || "Quiet Bordi beach"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", p.summary],
    ["name", "twitter:image", image],
  ]) {
    html = html.replace(
      new RegExp(`<meta ${attr}="${name}" content="[^"]*"\\s*/?>`),
      `<meta ${attr}="${name}" content="${esc(value)}"/>`,
    );
  }
  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${url}"/>`,
  );
  const content = `<main><a href="/tripcircle/">TripCircle</a><h1>${esc(p.name)}</h1><p>${esc(p.summary)}</p><p>From Ahmedabad: ${esc(p.journey)} · ${esc(p.duration)}</p>${photo ? `<img src="${image}" alt="${esc(photo.caption)}" width="960"/>` : ""}<h2>Viewpoints & slow outings</h2>${(p.details?.spots || []).map((s) => `<h3>${esc(s.name)}</h3><p>${esc(s.summary)}</p>`).join("")}<h2>A simple starting plan</h2><p>${esc(p.itinerary)}</p><p>${esc(p.caveat)}</p><h2>Where to stay</h2>${(p.details?.stays || []).map((s) => `<h3>${esc(s.name)}</h3><p>${esc(s.summary)}</p><a href="${esc(s.url)}">Check this stay</a>`).join("")}<a href="${esc(p.source_url)}">Destination source</a><p><a href="/tripcircle/#create">Plan this trip with your group</a></p></main>`;
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root">${content}</div>`,
  );
  await mkdir(`dist/places/${p.id}`, { recursive: true });
  await writeFile(`dist/places/${p.id}/index.html`, html);
}
await writeFile(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[`${base}/`, ...places.map((p) => `${base}/places/${p.id}/`)].map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`,
);
await writeFile(
  "dist/robots.txt",
  `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`,
);
console.log(
  `Pre-rendered ${places.length} destination pages with metadata and sitemap.`,
);
