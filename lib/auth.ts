import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "admin_session";

export function adminConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

function token(): string {
  return createHash("sha256").update(`bank-exam-admin:${process.env.ADMIN_PASSWORD ?? ""}`).digest("hex");
}

export function checkPassword(pw: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = createHash("sha256").update(pw).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function setAdminCookie() {
  (await cookies()).set(COOKIE, token(), { httpOnly: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 12 });
}

export async function clearAdminCookie() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const a = Buffer.from(v);
  const b = Buffer.from(token());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 每個管理頁面與管理動作都必須呼叫 */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin-login");
}
