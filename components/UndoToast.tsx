"use client";

import { useEffect } from "react";

export type Notice = { id: number; message: string; undo?: () => void };

/** Korte melding onderin, optioneel met "Ongedaan maken". Verdwijnt na 7 seconden. */
export default function UndoToast({ notice, onDone }: { notice: Notice | null; onDone: (id: number) => void }) {
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => onDone(notice.id), 7000);
    return () => clearTimeout(t);
  }, [notice, onDone]);

  if (!notice) return null;
  return (
    <div className="fixed bottom-4 inset-x-0 z-[950] flex justify-center px-4 pointer-events-none print:hidden" role="status">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-gray-900 text-white text-sm pl-4 pr-2 py-2 shadow-lg max-w-full">
        <span className="truncate py-1">{notice.message}</span>
        {notice.undo && (
          <button type="button" onClick={notice.undo} className="flex-shrink-0 rounded-full px-3 py-1 font-medium text-blue-200 hover:bg-white/10">
            Ongedaan maken
          </button>
        )}
      </div>
    </div>
  );
}
