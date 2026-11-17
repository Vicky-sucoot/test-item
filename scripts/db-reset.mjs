// 刪除本機資料庫；下次啟動時自動重建並載入預設主題與自編示範題
import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), process.env.DATABASE_PATH || "data/app.db");
for (const f of [file, `${file}-wal`, `${file}-shm`]) {
  if (fs.existsSync(f)) fs.rmSync(f);
}
console.log(`已刪除 ${file}（含作答紀錄）。重新執行 npm run dev 時會自動建立並載入示範資料。`);
