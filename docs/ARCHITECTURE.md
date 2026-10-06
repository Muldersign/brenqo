# Architectuur

## Lagen

```
src/
  app/(app)/…            schermen achter login (dashboard, facturen, bank, …)
  app/f/[token]          publieke factuurpagina + betalen
  app/o/[token]          publieke offertepagina
  app/api/…              server: OCR, e-mail, betalingen, webhooks, inbound mail, PDF
  components/            design system (ui/), shell, flows (scan, versturen, betaald), documenten
  lib/domain/            pure bedrijfslogica — getest, framework-vrij
  lib/store/             client state (demo: localStorage) + selectors per administratie
  lib/services/          client-adapters naar de API-routes (vallen terug op demo)
  lib/server/            server-only: OCR, repository (Supabase service role), bank-adapter
  lib/pdf/               factuur-PDF (isomorf: browser én server)
supabase/migrations/     schema, RLS, databasefuncties
```

De **domeinlaag** (`lib/domain`) bevat alle regels die ertoe doen en is onafhankelijk van UI en opslag:

- `calc.ts` — regelbedragen, korting, btw per tarief, openstaand bedrag
- `status.ts` — afgeleide status (Verlopen, Deels betaald, …) uit opgeslagen staat + datum + betalingen
- `matching.ts` — score van een banktransactie tegen openstaande facturen (bedrag, factuurnummer/kenmerk, IBAN, naam). ≥ 90: automatisch betaald (als de automatisering aan staat), ≥ 45: voorstel
- `reminders.ts` — welke herinnering vandaag uit moet; stopt bij betaling of als het uit staat
- `recurring.ts` — volgende datum, inhalen van gemiste runs, maandeinde
- `vat.ts` — kwartaaloverzicht (factuurstelsel), aangiftedeadline, welk kwartaal nu relevant is
- `categories.ts` — leverancier → categorie: eerst eerdere keuzes (“Adobe → Software”), dan algemene kennis

## Opslag: één datamodel voor browser en server

Elk record wordt in Postgres bewaard als JSON-document (`data`) naast `organization_id`, in exact de vorm van `src/lib/types.ts`. Kolommen die een index of uniciteit nodig hebben (publieke tokens, factuurnummers per administratie, inbox-adres, externe banktransactie-id's) worden uit het document gegenereerd.

Daardoor draait dezelfde bedrijfslogica overal:

- **Browser** — `src/lib/store/index.ts` (React) gebruikt `createActions` uit `src/lib/store/core.ts`.
- **Server** — de dagelijkse taak, de Mollie-webhook en de bankkoppeling maken met dezelfde `createActions` een store voor één administratie (`zustand/vanilla`), voeren dezelfde acties uit en schrijven het verschil terug (`saveChanges`).

**Synchronisatie** (`src/lib/backend/sync.ts`): na inloggen worden alle administraties van de gebruiker geladen. Elke wijziging in de store wordt binnen ~0,4 s weggeschreven: de store wijzigt records nooit in place, dus een nieuw objectreferentie is een gewijzigd record (`diffData`). Als de app weer in beeld komt, of elke minuut, wordt opnieuw geladen (alleen als er niets meer uitstaat), zodat betalingen van de webhook of de dagelijkse taak verschijnen.

## Data-scheiding tussen administraties

- RLS staat aan op alle tabellen; `is_member(org)` en `can_write(org)` bepalen lezen/schrijven via `organization_members`. Rol *viewer* (bijv. de boekhouder) kan alleen lezen.
- Uitnodigen gaat per e-mailadres (`organization_invites`); bij inloggen zet `accept_invites()` dat om in een lidmaatschap.
- `organization_secrets` (de Mollie-sleutel per administratie) en `bank_connections` hebben RLS zonder policies: alleen de server kan erbij.
- Bestanden staan in bucket `documents` onder `<organization_id>/…` met dezelfde regels.
- Server-routes die zonder gebruiker draaien (webhooks, cron, inbound mail, publieke pagina's) gebruiken de service role en filteren altijd zelf op organisatie of token. Publieke pagina's geven alleen terug wat op de factuur staat (`src/lib/server/public-view.ts`).
- Getest in `supabase/tests/rls.sql` en `src/test/backend.e2e.test.ts`.

## Belangrijkste flows

**Factuur → betaald**
1. Concept heeft geen nummer. Bij versturen krijgt hij het volgende nummer (uniek per administratie afgedwongen in de database).
2. `/api/email` (alleen voor leden) mailt via Resend met de PDF (server-side gerenderd) en een knop naar `/f/<token>`.
3. Klant opent → status *Bekeken*.
4. *Betaal* → `/api/payments` maakt met de Mollie-sleutel van díe administratie een betaling; het bedrag komt uit de database.
5. Mollie → `/api/webhooks/mollie?org=…`: we halen de betaling zelf op; alleen bij `paid` wordt hij geboekt (idempotent op Mollie-id), met dezelfde code als in de app: status *Betaald*, betaaldatum, melding, pushbericht. Herinneringen stoppen vanzelf.

**Bon → kosten**
Foto/upload (HEIC wordt omgezet) → `/api/ocr` (Claude vision, gestructureerde output) → leverancier herkend → "Klopt dit?" → opslaan; het origineel gaat naar Storage.

**Inkomende inkoopfactuur**
Mail naar het eigen adres van de administratie → `/api/inbound-email` → bijlage opslaan → OCR → leverancier/categorie herkennen → *Even controleren* → melding.

**Bank**
Afschrift importeren (ING/Rabobank/ABN AMRO CSV, CAMT.053) of PSD2 via GoCardless → transacties (dubbele overgeslagen via externe id) → matcher → automatisch koppelen of voorstel tonen.

**Dagelijks (05:00 UTC)**
`/api/cron/daily`: bank ophalen, periodieke facturen maken (en versturen), herinneringen versturen, betalingen koppelen — per administratie, met e-mail en pushmelding.

## Bewust níet gebouwd

Salarisadministratie, voorraad, goedkeuringsflows, marge-/reisregeling, AI-chat of -coach, workflow-builder, accountantsportaal. Als iets niet helpt bij factureren, betaald krijgen, bonnetjes, bank of btw, hoort het er niet in.
