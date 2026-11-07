"use client";

import { useFocusTrap } from "./useFocusTrap";

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/** Paneel boven de pagina: op mobiel van onderen, op grotere schermen in het midden. */
export default function Sheet({ title, onClose, children }: Props) {
  const { ref, onKeyDown } = useFocusTrap<HTMLDivElement>(onClose, "container");
  return (
    <div
      className="fixed inset-0 z-[900] bg-black/40 flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        onKeyDown={onKeyDown}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-xl shadow-xl p-5 focus:outline-none"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="sheet-title" className="text-base font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-800" aria-label="Sluiten">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
