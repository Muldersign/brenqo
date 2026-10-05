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

## Integraties (optioneel, via `.env.local`)

Zie `.env.example`. Elke integratie valt netjes terug op de demo als de sleutel ontbreekt.

| Functie | Provider | Route |
| --- | --- | --- |
| Bon/factuur uitlezen | Claude vision (`ANTHROPIC_API_KEY`) | `POST /api/ocr` |
| E-mail versturen | Resend (`RESEND_API_KEY`, `EMAIL_FROM`) | `POST /api/email` |
| Online betalen | Mollie (`MOLLIE_API_KEY`, `APP_URL`) | `POST /api/payments`, `POST /api/webhooks/mollie` |
| Inkomende inkoopfacturen | Postmark inbound (of vergelijkbaar) | `POST /api/inbound-email` |
| PDF server-side | @react-pdf/renderer | `POST /api/invoices/pdf` |
| Bankkoppeling | PSD2-aggregator (interface in `src/lib/server/bank.ts`) | — |
| Database, auth, opslag | Supabase | `supabase/migrations/` |

Meer over de opbouw: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Techniek

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Radix UI · Motion · Recharts · Zustand · @react-pdf/renderer · Supabase (PostgreSQL + RLS) · Vitest
