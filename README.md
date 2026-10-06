# Brenqo

Eenvoudige boekhouding voor ZZP'ers en verenigingen: facturen, betalingen, bonnetjes, bank en btw — zonder boekhoudkennis.

> “Ik heb eigenlijk geen verstand van boekhouden, maar hiermee lukt het vanzelf.”

## Starten

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # domeinlogica: btw, matching, herinneringen, nummering, demo-data
npm run build      # productiebuild
```

**Live demo:** `npm run build:demo` maakt `demo/dist/brenqo.html`: de hele app als één zelfstandige pagina (in-memory router, geen server nodig). Die versie staat als Artifact online.

Zonder configuratie draait Brenqo als **volledig klikbare demo** met twee administraties (Muldersign en V&Z Veendam). Data staat dan in de browser (localStorage); integraties worden gesimuleerd. Via *Instellingen → Gebruikers → Demo herstellen* begin je opnieuw.

## Wat er in zit

| Onderdeel | Wat je kunt |
| --- | --- |
| **Overzicht** | Omzet, openstaand, kosten en btw in één oogopslag; “Aandacht nodig”; inkomsten vs. uitgaven; grote *Bon scannen*-knop op mobiel |
| **Facturen** | Maken met live preview, productbibliotheek, korting per regel, versturen met eigen e-mailtekst, PDF, online factuurlink, betaallink, statussen (Concept → Verzonden → Bekeken → Openstaand → Betaald / Deels betaald / Verlopen / Gecrediteerd), creditfacturen, bulkacties, meerdere facturen tegelijk (contributie) |
| **Periodiek** | Maandelijks / per kwartaal / jaarlijks, automatisch aanmaken en versturen |
| **Offertes** | Zelfde editor, online accepteren/afwijzen, omzetten naar factuur |
| **Klanten & producten** | Klantpagina met omzet, openstaand, betaalgedrag; snelknoppen |
| **Bonnetjes & inkoopfacturen** | Foto of upload → automatisch uitlezen → “Klopt dit?” → opslaan; onthoudt per leverancier de categorie; eigen inbox-adres per administratie; archief met filters |
| **Bank** | Transacties, automatische match-voorstellen (“Factuur 2026-037 lijkt betaald”), koppelen aan factuur/bon/categorie, PSD2-koppelflow |
| **Herinneringen** | Drie stappen met eigen teksten, uit te zetten per klant of factuur, stoppen vanzelf na betaling |
| **Btw & rapporten** | Kwartaaloverzicht in gewone taal met aangifterubrieken (1a/1b/1e/5b), omzet/kosten/resultaat per periode, CSV-export |
| **Meerdere administraties** | Volledig gescheiden data, nummering, huisstijl en instellingen; snel wisselen linksboven |
| **PWA** | Installeerbaar op iPhone/Android, standalone, safe areas, service worker met offline-pagina, snelkoppelingen (*Bon scannen*, *Nieuwe factuur*), push-handler |

## Van demo naar echt

Zonder configuratie is Brenqo een klikbare demo (data in de browser). Met Supabase ingesteld wordt het een echte meergebruikers-app: inloggen met een code per mail, alle administraties in de database, afgeschermd per administratie. **Volg [`docs/SETUP.md`](docs/SETUP.md)**: stap voor stap, per onderdeel.

| Functie | Dienst | Waar |
| --- | --- | --- |
| Database, inloggen, bestanden | Supabase | `supabase/migrations/`, `src/lib/backend/` |
| Hosting + dagelijkse taak | Vercel (Cron) | `vercel.json`, `/api/cron/daily` |
| Facturen e-mailen (met PDF) | Resend | `/api/email` |
| Online betalen, per administratie | Mollie | `/api/payments`, `/api/webhooks/mollie`, Instellingen → Betalingen |
| Bonnen & facturen uitlezen | Claude vision | `/api/ocr` |
| Inkoopfacturen per mail | Postmark inbound | `/api/inbound-email` |
| Bank | Afschrift-import (CSV/CAMT.053), PSD2 via GoCardless | `src/lib/domain/bank-import.ts`, `/api/bank/*` |
| Pushmeldingen | Web Push (VAPID) | `/api/push/subscribe`, `public/sw.js` |

Meer over de opbouw: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Testen

```bash
npm test           # bedrijfslogica, bankimport, synchronisatie (32 tests)
npm run test:db    # schema + row level security op Postgres
npm run test:e2e   # end-to-end: echte Supabase-client, Postgres, PostgREST
```

## Techniek

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Geist · Radix UI · Motion · Recharts · Zustand · @react-pdf/renderer · Supabase (PostgreSQL + RLS) · Vitest
