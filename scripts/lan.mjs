// 以區網模式啟動（手機可連線），並在終端機印出網址與 QR code
// 用法：npm run lan（建置後以正式模式啟動，建議手機使用）或 npm run lan:dev（開發模式）
// 連接埠可用環境變數 PORT 指定，預設 3000
import os from "node:os";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import QRCode from "qrcode";

const require = createRequire(import.meta.url);
const mode = process.argv[2] === "start" ? "start" : "dev";
const port = process.env.PORT || "3000";

const ips = [];
for (const list of Object.values(os.networkInterfaces())) {
  for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) ips.push(a.address);
}
const isPrivate = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
ips.sort((a, b) => Number(isPrivate(b)) - Number(isPrivate(a)));

console.log("\n公股銀行考題練習｜手機連線（手機與電腦需在同一個 Wi‑Fi）");
console.log(`電腦本機：http://localhost:${port}`);
if (!ips.length) {
  console.log("找不到區網位址，請確認電腦已連上 Wi‑Fi 或有線網路。");
} else {
  for (const ip of ips) console.log(`手機開啟：http://${ip}:${port}`);
  const url = `http://${ips[0]}:${port}`;
  console.log(`\n用手機相機掃描下方 QR code（${url}）：\n`);
  console.log(await QRCode.toString(url, { type: "terminal", small: true }));
  console.log(`網站啟動後，也可以在電腦瀏覽器開啟 http://localhost:${port}/connect 顯示 QR code。`);
}
console.log("提醒：區網內的其他裝置也能連到此網站，請只在信任的網路使用；管理頁仍需密碼。\n");

const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, mode, "-H", "0.0.0.0", "-p", port], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
