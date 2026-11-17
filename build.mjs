// 由 review-app/index.html 產生可安裝、可離線的版本（review-app/pwa/index.html 與 sw.js）
// 用法：node review-app/pwa/build.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dir = path.dirname(new URL(import.meta.url).pathname);
const body = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");
const html = `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>FIT重點複習</title>
<meta name="description" content="會計學、貨幣銀行學、票據法、銀行法的重點、記憶卡、自編練習題與模擬測驗。">
<meta name="theme-color" content="#2d5f4a">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="FIT複習">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<style>
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; font: 14px/1.5 system-ui, sans-serif; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
</head>
<body>
${body}
<script>
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(dir, "index.html"), html);
const version = crypto.createHash("sha256").update(html).digest("hex").slice(0, 12);
const sw = fs.readFileSync(path.join(dir, "sw.template.js"), "utf8").replace("__VERSION__", version);
fs.writeFileSync(path.join(dir, "sw.js"), sw);
fs.writeFileSync(path.join(dir, ".nojekyll"), "");
console.log(`built review-app/pwa (version ${version})`);
