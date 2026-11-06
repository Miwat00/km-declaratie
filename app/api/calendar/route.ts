import { CalendarFetchError, CalendarUrlError, fetchCalendar } from "@/lib/fetchCalendar";

/**
 * Haalt een gepubliceerde agenda (.ics) op namens de browser.
 *
 * Nodig omdat Outlook en Google geen CORS-headers meesturen: de browser mag hun agendabestanden
 * niet zelf ophalen. De link komt in de request body (niet in de URL, zodat hij niet in
 * toegangslogs belandt), wordt niet opgeslagen en niet gelogd.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return error("Ongeldig verzoek.", 400);
  }
  if (typeof url !== "string" || url.length > 2048) return error("Ongeldige link.", 400);

  try {
    const ics = await fetchCalendar(url);
    return new Response(ics, {
      headers: { ...NO_STORE, "Content-Type": "text/calendar; charset=utf-8" },
    });
  } catch (err) {
    if (err instanceof CalendarUrlError) return error(err.message, 400);
    if (err instanceof CalendarFetchError) return error(err.message, err.status);
    return error("Er ging iets mis bij het ophalen van de agenda.", 500);
  }
}
