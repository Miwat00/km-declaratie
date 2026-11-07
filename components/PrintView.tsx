import { formatDateNL } from "@/lib/date";
import { totals, tripRate } from "@/lib/export";
import type { Trip } from "@/lib/types";

const nl = (n: number, digits: number) => n.toFixed(digits).replace(".", ",");

type Props = {
  trips: Trip[];
  periodLabel: string;
  companyName: string;
};

/** Alleen zichtbaar bij afdrukken (window.print → "Opslaan als PDF"). */
export default function PrintView({ trips, periodLabel, companyName }: Props) {
  const names = [...new Set(trips.map((t) => t.name))].join(", ");
  const sum = totals(trips);

  return (
    <div className="hidden print:block text-[11px] text-black">
      <h1 className="text-xl font-bold">Kilometerdeclaratie</h1>
      <table className="mt-2 mb-4">
        <tbody>
          <tr><td className="pr-6 text-gray-600">Naam</td><td className="font-medium">{names || "—"}</td></tr>
          {companyName && <tr><td className="pr-6 text-gray-600">Werkgever</td><td>{companyName}</td></tr>}
          <tr><td className="pr-6 text-gray-600">Periode</td><td>{periodLabel}</td></tr>
        </tbody>
      </table>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 pr-2">Datum</th>
            <th className="py-1 pr-2">Doel</th>
            <th className="py-1 pr-2">Klant / project</th>
            <th className="py-1 pr-2">Route</th>
            <th className="py-1 pr-2 text-center">Doorb.</th>
            <th className="py-1 pr-2 text-right">Km</th>
            <th className="py-1 pr-2 text-right">€/km</th>
            <th className="py-1 text-right">Bedrag</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((t) => (
            <tr key={t.id} className="border-b border-gray-300 align-top break-inside-avoid">
              <td className="py-1 pr-2 whitespace-nowrap">{formatDateNL(t.date)}</td>
              <td className="py-1 pr-2">{t.purpose}</td>
              <td className="py-1 pr-2">{t.client}</td>
              <td className="py-1 pr-2">{t.locationA.shortName} → {t.locationB.shortName}</td>
              <td className="py-1 pr-2 text-center">{t.billable ? "Ja" : "Nee"}</td>
              <td className="py-1 pr-2 text-right whitespace-nowrap">{nl(t.distanceKm, 1)}</td>
              <td className="py-1 pr-2 text-right whitespace-nowrap">{nl(tripRate(t), 2)}</td>
              <td className="py-1 text-right whitespace-nowrap">€ {nl(t.amount, 2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td className="py-1" colSpan={5}>Totaal ({trips.length} {trips.length === 1 ? "rit" : "ritten"})</td>
            <td className="py-1 pr-2 text-right whitespace-nowrap">{nl(sum.km, 1)}</td>
            <td />
            <td className="py-1 text-right whitespace-nowrap">€ {nl(sum.amount, 2)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-12 grid grid-cols-2 gap-12">
        <div>
          <div className="border-b border-black h-10" />
          <p className="mt-1 text-gray-600">Handtekening declarant</p>
        </div>
        <div>
          <div className="border-b border-black h-10" />
          <p className="mt-1 text-gray-600">Datum</p>
        </div>
      </div>
    </div>
  );
}
