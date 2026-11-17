"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** 註冊 Service Worker（僅限 HTTPS 或 localhost 等安全環境），並保留安裝提示事件 */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as BeforeInstallPromptEvent;
      listeners.forEach((l) => l());
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}

/** 瀏覽器支援時顯示「安裝 App」按鈕 */
export function InstallButton() {
  const [can, setCan] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const update = () => setCan(!!deferred);
    listeners.add(update);
    update();
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    return () => {
      listeners.delete(update);
    };
  }, []);
  if (installed) return <p className="text-sm text-emerald-700">目前已在 App 模式中開啟。</p>;
  if (!can) return null;
  return (
    <button
      className="btn btn-primary"
      onClick={async () => {
        if (!deferred) return;
        await deferred.prompt();
        await deferred.userChoice;
        deferred = null;
        setCan(false);
      }}
    >
      安裝 App
    </button>
  );
}
