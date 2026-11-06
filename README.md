# Kilometer Declaraties

Houd je zakelijke kilometers bij en declareer ze in een paar tikken. Vul start- en eindpunt in en de app berekent de rijafstand via OpenStreetMap. Je kunt ook een hele week aan ritten genereren uit je Outlook-agenda.

**Privacy:** alles staat lokaal in je browser (localStorage). Er is geen account, geen server en geen tracking.

## Features

- **Rit toevoegen** met adres-autocomplete, routekaart en automatische afstand (heen en terug in één keer)
- **Snelknoppen** voor je thuis- en kantooradres
- **Agenda-import** vanuit een `.ics`-export (Outlook, Google Calendar):
  - herkent terugkerende afspraken, verplaatste en geannuleerde afspraken
  - koppelt afspraken aan klanten via zoekwoorden, of aan je kantoor via "kantoor"/"office" in de titel
  - bouwt per dag een ritketen thuis → afspraak → afspraak → thuis
  - zoekt het locatieveld van onbekende afspraken alvast op (Teams/Zoom-links worden overgeslagen)
- **Export** naar CSV (Excel-vriendelijk: `;` en komma-decimalen) of direct mailen; op mobiel als bijlage via het deelmenu
- **Tarief per rit**: als je het tarief wijzigt, blijven eerdere ritten op hun oude tarief staan
- **Installeerbaar als app** (PWA) op iOS en Android

## Starten

```bash
npm install
npm run dev
```

Open daarna <http://localhost:3000>. Bij de eerste keer vraagt de app om je naam, thuisadres en (optioneel) kantooradres.

| Script | Wat het doet |
| --- | --- |
| `npm run dev` | Ontwikkelserver |
| `npm run build` | Productiebuild |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript-controle |

## Agenda exporteren

- **Outlook (Windows):** Bestand → Agenda opslaan → kies het datumbereik → `.ics`
- **Google Calendar:** Instellingen → Importeren en exporteren → Exporteren

## Gebruikte diensten

- Geocoding: [Nominatim](https://nominatim.org/) (OpenStreetMap). De app houdt zich aan de [usage policy](https://operations.osmfoundation.org/policies/nominatim/) van maximaal 1 request per seconde. Ga je de app voor veel mensen hosten, gebruik dan een eigen Nominatim-instantie of een commerciële aanbieder.
- Routes: de publieke [OSRM](https://project-osrm.org/)-demoserver. Die is bedoeld voor licht gebruik.
- Kaart: [Leaflet](https://leafletjs.com/) met OpenStreetMap-tegels

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS en Vitest.

## Licentie

[MIT](LICENSE)

---

### English

A small PWA to log business mileage (Dutch UI). It calculates driving distance via OpenStreetMap/OSRM, can generate trips from an `.ics` calendar export, and exports to CSV. All data stays in your browser. Run it with `npm install && npm run dev`.
