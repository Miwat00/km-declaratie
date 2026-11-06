"use client";

import { useState, useEffect } from "react";

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);

  useEffect(() => {
    // Niet tonen als al geïnstalleerd (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Niet tonen als al weggedrukt
    if (sessionStorage.getItem("install-dismissed")) return;

    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !("MSStream" in window);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browserdetectie kan pas na mount
    setIsIos(ios);

    if (ios) {
      // iOS Safari heeft geen beforeinstallprompt — toon altijd de handmatige instructie
      const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/i.test(navigator.userAgent);
      if (isSafari) setShow(true);
      return;
    }

    // Android Chrome: wacht op beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> });
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    sessionStorage.setItem("install-dismissed", "1");
    setShow(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 sm:left-auto sm:right-4 sm:w-80">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 px-4 py-3 flex items-start gap-3">
        {/* App icoon */}
        <div className="bg-blue-600 text-white p-2 rounded-xl flex-shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Installeer de app</p>
          {isIos ? (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Tik op{" "}
              <span className="inline-flex items-center gap-0.5 font-medium text-gray-700">
                <svg className="w-3.5 h-3.5 inline" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V3a1 1 0 011-1z" />
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                </svg>
                Deel
              </span>{" "}
              en dan <span className="font-medium text-gray-700">&quot;Zet op beginscherm&quot;</span>
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">Voor snelle toegang zonder browser</p>
          )}

          {!isIos && (
            <button
              onClick={install}
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Installeren
            </button>
          )}
        </div>

        <button
          onClick={dismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 -mt-0.5"
          aria-label="Sluiten"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
