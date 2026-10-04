import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const html = await readFile("dist/index.html", "utf8");
const entry = html.match(/src="[^"]*\/assets\/([^"]+\.js)"/)?.[1];
if (!entry) throw new Error("Production entry script missing");
const code = await readFile(`dist/assets/${entry}`);
const compressed = gzipSync(code).length;
if (code.length > 280000 || compressed > 90000)
  throw new Error(
    `Initial JS budget exceeded: ${code.length} bytes / ${compressed} gzip`,
  );
if (code.includes("tripcircle-public-auth"))
  throw new Error("Auth/Supabase planner leaked into initial bundle");
const photo = await stat("dist/photos/bordi-beach.jpg");
if (!photo.size) throw new Error("Open Graph photo missing");
console.log(
  `Initial JS: ${code.length} bytes / ${compressed} gzip; deferred planner and OG asset checked.`,
);
