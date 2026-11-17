import fs from "node:fs";
import path from "node:path";
import { isAdmin } from "@/lib/auth";
import { uploadsDir } from "@/lib/import/service";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await isAdmin())) return new Response("需要管理權限", { status: 401 });
  const { name } = await params;
  if (!/^job-\d+-(paper|answer)\.pdf$/.test(name)) return new Response("Not found", { status: 404 });
  const file = path.join(uploadsDir(), name);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` },
  });
}
