# Kilometer Declaraties

[![CI](https://github.com/Miwat00/km-declaratie/actions/workflows/ci.yml/badge.svg)](https://github.com/Miwat00/km-declaratie/actions/workflows/ci.yml)

Houd je zakelijke kilometers bij en declareer ze in een paar tikken. Vul start- en eindpunt in en de app berekent de rijafstand via OpenStreetMap. Je kunt ook een hele week aan ritten genereren uit je Outlook-agenda.

**[Probeer de live demo →](https://km-declaratie.vercel.app)**

**Privacy:** alles staat lokaal in je browser (localStorage). Er is geen account, geen database en geen tracking.

![Overzicht met routekaart, snelkeuze en ritten van november](docs/screenshots/overzicht.png)

<p>
  <img src="docs/screenshots/mobiel.png" alt="Rit toevoegen op mobiel: naam, datum en vaak gereden routes" width="260">
  &nbsp;
  <img src="docs/screenshots/agenda-week.png" alt="Ritten uit je agenda: de week per dag met afstanden, en rechts de vraag waar een afspraak was" width="520">
</p>

## Features

- **Eén scherm per maand**: bovenaan het bedrag, de kilometers en of de maand al gedeclareerd is; met ← → blader je door de maanden
- **Declareren met één knop**: mailen (naar het adres uit je instellingen), PDF of CSV; daarna staat de maand op gedeclareerd, met ongedaan maken
- **Ritten als overzichtelijke lijst** per week, met heen en terug op één regel ("Thuis ⇄ Kantoor"); tik erop om te bewerken of te verwijderen
- **"+ Rit"**: je vaak gereden routes met één tik, of een kort formulier (naam, datum, van, naar, waarvoor). De afstand rekent de app zelf uit, je kunt hem aanpassen of zelf invullen
- **Meerdere mensen op één apparaat**: de naam staat per rit in het formulier; zodra een maand meer namen heeft, toont de lijst wie er reed
- **Ritten uit je agenda** via een geplakte agenda-link (Outlook, Google Agenda, iCloud) of een `.ics`-bestand:
  - met een onthouden link opent de app direct op de week die je nog moet declareren
  - afspraken waarvan de plek onbekend is, stelt de app als vraag ("Waar was “Lunch met Jan”?") met de waarschijnlijkste antwoorden als knoppen; "voortaan automatisch" onthoudt het antwoord, en elke keuze is ongedaan te maken
  - per dag een ritketen thuis → afspraak → afspraak → thuis, met de afstand tussen de afspraken; dagen krijgen een vinkje als ze klaar zijn
  - zelf een tussenstop toevoegen voor ritten die niet in je agenda staan (tanken, materiaal ophalen); de route past zich aan
  - herkent terugkerende, verplaatste, geannuleerde en online afspraken (Teams/Zoom) en zoekt adressen uit het locatieveld op
  - ritten die al in je declaratie staan worden niet dubbel toegevoegd
- **Export** naar CSV (Excel-vriendelijk: `;` en komma-decimalen), PDF (via afdrukken, met handtekeningregel) of direct mailen; op mobiel als bijlage via het deelmenu
- **Tarief per rit**: als je het tarief wijzigt, blijven eerdere ritten op hun oude tarief staan
- **Backup en herstel** als JSON-bestand, ook handig om naar een ander apparaat over te stappen
- **Installeerbaar als app** (PWA) op iOS en Android, en opent ook zonder internet

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
| `npm run e2e` | End-to-end tests (Playwright, desktop + mobiel, met axe-toegankelijkheidscontrole). Eenmalig eerst `npx playwright install chromium` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript-controle |

## Je agenda koppelen

**Met een link (aanbevolen):** plak de ICS-link van een gepubliceerde agenda. De app kan die onthouden, zodat je je afspraken daarna met één klik ophaalt.

- **Outlook (web / nieuwe Outlook):** Instellingen → Agenda → Gedeelde agenda's → Een agenda publiceren → kies *Kan alle details weergeven* → Publiceren → kopieer de ICS-link. Bij werkaccounts kan je organisatie dit hebben uitgezet.
- **Google Agenda:** Instellingen → je agenda → Agenda integreren → *Geheim adres in iCal-indeling*
- **iCloud:** deel de agenda als openbare agenda en kopieer de `webcal://`-link

**Met een bestand:**

- **Outlook (Windows):** Bestand → Agenda opslaan → kies het datumbereik → `.ics`
- **Google Agenda:** Instellingen → Importeren en exporteren → Exporteren

## Gebruikte diensten

- Geocoding: [Nominatim](https://nominatim.org/) (OpenStreetMap). De app houdt zich aan de [usage policy](https://operations.osmfoundation.org/policies/nominatim/) van maximaal 1 request per seconde. Ga je de app voor veel mensen hosten, gebruik dan een eigen Nominatim-instantie of een commerciële aanbieder.
- Routes: de publieke [OSRM](https://project-osrm.org/)-demoserver. Die is bedoeld voor licht gebruik.
- Kaart: [Leaflet](https://leafletjs.com/) met [OpenStreetMap-tegels](https://operations.osmfoundation.org/policies/tiles/)

Zonder internet kun je ritten bekijken, bewerken en exporteren. Nieuwe routes berekenen en adressen zoeken heeft wel internet nodig.

## Privacy en veiligheid

- **Geen database.** Ritten, adressen en instellingen staan alleen in de browser van wie de app gebruikt. Bezoekers van de demo zien dus nooit elkaars gegevens, en de beheerder ziet ze ook niet.
- **Wat er naar buiten gaat:** adressen die je intypt gaan naar Nominatim (adres zoeken), coördinaten naar OSRM (afstand berekenen) en kaartuitsneden worden bij OpenStreetMap opgehaald.
- **Agenda-link:** Outlook en Google staan niet toe dat een browser hun agendabestanden rechtstreeks ophaalt (CORS). Daarom haalt één serverfunctie (`/api/calendar`) de agenda op en geeft hem direct terug. De link gaat mee in de request body (niet in de URL, dus niet in toegangslogs), wordt op de server niet opgeslagen of gelogd, en de functie haalt alleen iets op bij Outlook, Google en iCloud, ook bij doorverwijzingen. Zo kan hij niet misbruikt worden als open proxy. Een onthouden link staat alleen in je eigen browser en zit niet in het backupbestand. Let op: met zo'n link kan iedereen je agenda lezen, dus deel hem niet.
- **Beveiligingsheaders:** een Content Security Policy staat alleen verbindingen met de app zelf en de drie OpenStreetMap-diensten toe, en de app kan niet in een frame van een andere site worden geladen.
- **Gedeeld apparaat?** Iedereen die die browser gebruikt, kan je ritten zien. Gebruik dan een eigen browserprofiel. "Leeg maken" wist alleen ritten; wil je alles weg (ook naam en adressen), wis dan de sitegegevens in je browserinstellingen.

Screenshots maken met demodata: `npm run build && npx next start -p 3001`, en in een tweede terminal `node scripts/screenshots.mjs`.

## Projectstructuur

```
app/                  pagina's (overzicht en agenda-import)
components/           UI-componenten
components/agenda/    stappen van de agenda-import + useAgendaImport (state en acties)
app/api/calendar/     serverfunctie die een agenda-link ophaalt (CORS)
lib/                  logica zonder UI: .ics-parser, ritten genereren, export, backup, opslag
tests/                unit tests (Vitest)
tests/e2e/            end-to-end tests (Playwright); OSM/OSRM worden daarin nagebootst
```

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Vitest en Playwright.

## Licentie

[MIT](LICENSE)

---

### English

A small PWA to log business mileage (Dutch UI). It calculates driving distance via OpenStreetMap/OSRM, can generate trips from an `.ics` calendar export, and exports to CSV. All data stays in your browser. Run it with `npm install && npm run dev`.
