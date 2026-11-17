import { headers } from "next/headers";
import QRCode from "qrcode";
import { lanAddresses } from "@/lib/network";
import { InstallButton } from "@/components/Pwa";

export const dynamic = "force-dynamic";

async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111827", light: "#ffffff" } });
}

function validUrl(u: string | undefined): string | null {
  if (!u || u.length > 500) return null;
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:" ? x.toString() : null;
  } catch {
    return null;
  }
}

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const port = host.includes(":") ? host.split(":").pop()! : proto === "https" ? "" : "80";
  const hostname = host.replace(/:\d+$/, "");
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  const portPart = port && port !== "80" && port !== "443" ? `:${port}` : "";

  const urls = isLocal ? lanAddresses().map((ip) => `http://${ip}${portPart}`) : [`${proto}://${host}`];
  const custom = validUrl((await searchParams).url);
  const items = await Promise.all(
    [...urls.slice(0, 3), ...(custom ? [custom] : [])].map(async (u) => ({ url: u, svg: await qrSvg(u) })),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="h1">手機連線與安裝 App</h1>

      <section className="card space-y-3">
        <h2 className="h2">用手機掃描開啟</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>在電腦用 <code className="rounded bg-slate-100 px-1">npm run lan</code> 啟動（一般的 <code className="rounded bg-slate-100 px-1">npm run dev</code> 手機連不到）。</li>
          <li>手機與電腦連上<strong>同一個 Wi‑Fi</strong>。</li>
          <li>用手機相機掃描下方 QR code。</li>
        </ol>
        {items.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((it) => (
              <figure key={it.url} className="flex flex-col items-center gap-2 rounded-lg border p-3" style={{ borderColor: "var(--line)" }}>
                <div className="w-56 max-w-full" dangerouslySetInnerHTML={{ __html: it.svg }} />
                <figcaption className="break-all text-center font-mono text-sm">{it.url}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-sm text-red-700">找不到電腦的區網位址，請確認電腦已連上網路。</p>
        )}
        {isLocal && urls.length > 1 && (
          <p className="text-xs muted">若有多個網址，通常第一個（192.168.x.x 或 10.x.x.x）是家中 Wi‑Fi 的位址。</p>
        )}
        <form method="get" className="flex flex-col gap-2 sm:flex-row">
          <input name="url" type="url" className="input flex-1" placeholder="其他網址（例如你自行設定的通道網址）" defaultValue={custom ?? ""} aria-label="自訂網址" />
          <button className="btn btn-outline">產生 QR code</button>
        </form>
        <p className="text-xs text-amber-800">
          提醒：用 npm run lan 啟動時，同一網路的其他裝置也能開啟本網站（練習頁不需密碼，管理頁需要密碼），請只在信任的網路使用。
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">安裝成 App（加入主畫面）</h2>
        <InstallButton />
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <h3 className="font-semibold">iPhone／iPad（Safari）</h3>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">
              <li>用 Safari 開啟上方網址</li>
              <li>點下方「分享」按鈕</li>
              <li>選「加入主畫面」→「新增」</li>
            </ol>
            <p className="mt-1 text-xs muted">之後從主畫面圖示開啟，會以全螢幕 App 模式顯示。</p>
          </div>
          <div>
            <h3 className="font-semibold">Android（Chrome）</h3>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">
              <li>用 Chrome 開啟上方網址</li>
              <li>點右上「⋮」選單</li>
              <li>選「加到主畫面」或「安裝應用程式」</li>
            </ol>
            <p className="mt-1 text-xs muted">
              透過區網 http 網址連線時，Chrome 只能建立主畫面捷徑；完整安裝（獨立視窗、離線提示頁）需要 https 或 localhost。
            </p>
          </div>
          <div>
            <h3 className="font-semibold">電腦（Chrome／Edge）</h3>
            <p className="mt-1">開啟 http://localhost:3000，點網址列右側的「安裝」圖示，或使用上方「安裝 App」按鈕。</p>
          </div>
          <div>
            <h3 className="font-semibold">注意</h3>
            <p className="mt-1">
              題庫與作答紀錄存在電腦上，手機 App 需要電腦開著且執行網站才能使用；連不到時會顯示離線提示頁（https 或 localhost 環境）。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
