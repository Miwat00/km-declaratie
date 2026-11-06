import type { Step } from "./useAgendaImport";

const LABELS = ["Uploaden", "Periode", "Koppelen", "Controleren"];

export default function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
      {([1, 2, 3, 4] as const).map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-shrink-0">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            step > s ? "bg-green-500 text-white" : step === s ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
          }`}>
            {step > s ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : s}
          </div>
          <span className={`text-xs hidden sm:inline ${step === s ? "text-gray-900 font-medium" : "text-gray-500"}`}>
            {LABELS[i]}
          </span>
          {i < 3 && <div className="w-4 h-px bg-gray-200 flex-shrink-0" />}
        </div>
      ))}
    </div>
  );
}
