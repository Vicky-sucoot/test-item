// 由 lib/seed.ts 的自編示範題產生線上示範版單一網頁：node standalone/build.mjs <demo.json>
import fs from "node:fs";
import path from "node:path";
const dir = path.dirname(new URL(import.meta.url).pathname);
const data = fs.readFileSync(process.argv[2], "utf8").replace(/</g, "\\u003c");
const html = fs.readFileSync(path.join(dir, "app.template.html"), "utf8").replace("__DATA__", data);
fs.writeFileSync(path.join(dir, "index.html"), html);
console.log("wrote standalone/index.html", html.length);
