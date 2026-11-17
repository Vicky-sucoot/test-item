import { createHash } from "node:crypto";

/** 全形轉半形、去除空白與標點，用於比對重複題 */
export function normalizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

/** 題幹＋選項（排序後）之雜湊；選項順序不同仍視為同一題 */
export function stemHash(stem: string, options: (string | null | undefined)[]): string {
  const opts = options.map(normalizeText).filter(Boolean).sort();
  return createHash("sha1")
    .update(normalizeText(stem) + "|" + opts.join("|"))
    .digest("hex");
}
