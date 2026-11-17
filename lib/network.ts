import os from "node:os";

/** 本機的區網 IPv4 位址（私有網段優先），供手機連線使用 */
export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === "IPv4" && !a.internal) out.push(a.address);
    }
  }
  const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  return [...new Set(out)].sort((a, b) => Number(isPrivate(b)) - Number(isPrivate(a)));
}
