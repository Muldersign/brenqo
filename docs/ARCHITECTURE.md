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

## Data-scheiding tussen administraties

Ieder record heeft `organization_id`. In de database:

- RLS staat aan op alle tabellen; `is_member(org)` en `can_write(org)` bepalen lezen/schrijven via `organization_users`.
- Bestanden staan in bucket `documents` onder `<organization_id>/…` met dezelfde policies.
- Server-routes die zonder gebruiker draaien (webhooks, inbound mail) gebruiken de service role en scopen **altijd** expliciet op organization_id.
- Publieke pagina's lezen via `public_invoice(token)` (security definer, alleen niet-concept facturen, alleen de velden die op de factuur staan).

In de demo gebeurt hetzelfde in de client-selectors (`useScoped` in `lib/store`).

## Belangrijkste flows

**Factuur → betaald**
1. Concept heeft geen nummer. Bij versturen: `finalize_invoice()` kent gatloos het volgende nummer toe (rij-lock op settings).
2. E-mail via Resend met PDF en knop naar `/f/<token>`.
3. Klant opent → `viewed_at` (status *Bekeken*).
4. *Betaal* → `/api/payments` maakt een Mollie-betaling met `webhookUrl`.
5. Mollie → `/api/webhooks/mollie`: we halen de betaling zelf op, en alleen bij `paid` roept `record_invoice_payment()` (idempotent op `provider_payment_id`) de betaling op, zet de factuur op *Betaald*, slaat de betaaldatum op en maakt een melding. Herinneringen stoppen vanzelf.

**Bon → kosten**
Foto/upload → `/api/ocr` (Claude vision, gestructureerde output) → leverancier herkend via `suppliers.default_category` → “Klopt dit?” → opslaan → leverancierskeuze wordt onthouden → btw-overzicht bijgewerkt → zodra de betaling via de bank binnenkomt wordt hij gekoppeld.

**Inkomende inkoopfactuur**
Mail naar `<administratie>-XXXX@inbox.brenqo.nl` → inbound webhook → bijlage opslaan → OCR → concept in “Even controleren” → melding.

**Bank**
PSD2-aggregator achter `BankProvider` → transacties upserten (uniek op provider-id) → matcher → automatisch koppelen of voorstel tonen.

## Achtergrondtaken

In de demo draait `runAutomations()` eens per dag bij het openen van de app (periodieke facturen, herinneringen, bankmatching). In productie hoort dat in een geplande job (Supabase cron / Vercel cron) die dezelfde domeinfuncties gebruikt.

## Bewust níet gebouwd

Salarisadministratie, voorraad, goedkeuringsflows, marge-/reisregeling, AI-chat of -coach, workflow-builder, accountantsportaal. Als iets niet helpt bij factureren, betaald krijgen, bonnetjes, bank of btw, hoort het er niet in.

## Volgende stappen naar productie

1. Supabase Auth + de store vervangen door queries/mutaties tegen de tabellen (de types in `lib/types.ts` volgen het schema).
2. Publieke pagina's server-side laten lezen via `public_invoice(token)`, zodat links op ieder apparaat werken.
3. Cron voor automatiseringen; Web Push-abonnementen voor meldingen.
4. Echte PSD2-provider kiezen en `BankProvider` implementeren.
