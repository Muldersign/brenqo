# Brenqo live zetten

Stap voor stap van demo naar echte administratie. Reken op ongeveer een uur, waarvan het meeste wachten is op DNS en verificaties. Elke stap staat los: wat je overslaat blijft gewoon in demo-modus werken (zonder Mollie bijvoorbeeld de demo-betaalpagina).

Alle variabelen staan met uitleg in `.env.example`.

## 1. Supabase (database, inloggen, bestanden)

1. Maak een project op [supabase.com](https://supabase.com) — regio **Frankfurt (eu-central-1)**.
2. **SQL Editor** → plak de inhoud van `supabase/migrations/20261006000000_brenqo.sql` → *Run*.
3. **Project Settings → API**: noteer
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - publishable (anon) key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - service_role / secret key → `SUPABASE_SERVICE_ROLE_KEY` (geheim!)
4. **Authentication → URL Configuration**: *Site URL* = je app-adres (bijv. `https://app.brenqo.nl`), en zet hetzelfde adres bij *Redirect URLs*.
5. **Authentication → Email Templates → Magic Link**: zet de code in de mail, zodat inloggen ook in de geïnstalleerde app werkt:
   ```
   <h2>Inloggen bij Brenqo</h2>
   <p>Je code is <strong style="font-size:24px;letter-spacing:4px">{{ .Token }}</strong></p>
   <p>Of tik op <a href="{{ .ConfirmationURL }}">deze link</a>.</p>
   ```
6. **Authentication → SMTP Settings**: koppel Resend (stap 3), anders kan Supabase maar een paar mails per uur versturen.
   Host `smtp.resend.com`, poort `465`, gebruiker `resend`, wachtwoord = je Resend API-sleutel.

## 2. Hosting (Vercel)

1. [vercel.com](https://vercel.com) → *Add New Project* → importeer de GitHub-repo `Muldersign/brenqo` (branch na merge: `main`).
2. Vul de environment variables in (zie `.env.example`). De gegenereerde waarden voor `CRON_SECRET`, `INBOUND_SECRET` en de VAPID-sleutels staan in `brenqo-geheimen.env`.
3. *Domains*: voeg `app.brenqo.nl` toe en zet het CNAME-record dat Vercel noemt bij je domeinbeheer.
4. De dagelijkse taak (`vercel.json`) draait om 05:00 UTC: periodieke facturen, herinneringen en banktransacties.

## 3. E-mail (Resend)

1. Account op [resend.com](https://resend.com) → *Domains* → voeg `brenqo.nl` toe en zet de DNS-records (SPF/DKIM).
2. *API Keys* → maak een sleutel → `RESEND_API_KEY`. Zet `EMAIL_FROM=facturen@brenqo.nl`.
3. Facturen gaan uit namens de administratie ("Muldersign <facturen@brenqo.nl>"); antwoorden van klanten gaan naar het e-mailadres van die administratie.

## 4. Bonnen uitlezen (Claude)

[console.anthropic.com](https://console.anthropic.com) → API key → `ANTHROPIC_API_KEY`. Zonder sleutel vul je bonnen zelf in.

## 5. Online betalen (Mollie)

Per administratie, in de app zelf: **Instellingen → Betalingen → Koppel Mollie** en plak de API-sleutel uit het Mollie-dashboard (*Ontwikkelaars → API-sleutels*). Begin met de `test_`-sleutel, test een betaling, en vervang hem daarna door de `live_`-sleutel. De sleutel wordt alleen op de server bewaard. Webhooks stelt Brenqo zelf in.

## 6. Inkoopfacturen per mail (Postmark inbound)

1. [postmarkapp.com](https://postmarkapp.com) → server → *Inbound* stream.
2. DNS: MX-record voor `inbox.brenqo.nl` → `inbound.postmarkapp.com` (prioriteit 10). Zet `NEXT_PUBLIC_INBOX_DOMAIN=inbox.brenqo.nl`.
3. *Inbound webhook URL*: `https://brenqo:<INBOUND_SECRET>@app.brenqo.nl/api/inbound-email`, en vink *Include raw email content* uit.
4. Elke administratie heeft een eigen adres (Instellingen → E-mail). Facturen die daar binnenkomen staan na een paar seconden in *Even controleren*.

## 7. Bankkoppeling (PSD2)

- **Werkt meteen, zonder account:** Bank → *Afschrift importeren* (CSV van ING, Rabobank, ABN AMRO of CAMT.053). Dubbele transacties worden overgeslagen, betalingen meteen gekoppeld.
- **Automatisch ophalen:** maak een account bij [GoCardless Bank Account Data](https://bankaccountdata.gocardless.com) → *User secrets* → `BANK_PROVIDER_SECRET_ID` / `BANK_PROVIDER_SECRET_KEY`. Daarna: Bankrekeningen → *Rekening koppelen* → kies je bank → inloggen in je bank-app. De toestemming is 90 dagen geldig; Brenqo laat weten wanneer je moet verlengen.

## 8. Pushmeldingen

Vul de VAPID-sleutels in (staan in `brenqo-geheimen.env`, of genereer met `npx web-push generate-vapid-keys`). Daarna per apparaat: Instellingen → Automatisering → *Meldingen op dit apparaat*. Op iPhone werkt dit als Brenqo op het beginscherm staat (iOS 16.4+).

## 9. Eerste keer inloggen

Open de app → vul je e-mailadres in → typ de code uit de mail → maak je eerste administratie (bijv. *Muldersign*) → Instellingen → Bedrijf: logo, KvK, btw-nummer en IBAN. Een tweede administratie (*V&Z Veendam*) maak je linksboven via de administratiewisselaar. Je boekhouder of medebestuurder nodig je uit via Instellingen → Gebruikers.

## Testen

```bash
npm test            # bedrijfslogica, bankimport, synchronisatie
npm run test:db     # database + beveiliging (vraagt een lokale Postgres)
npm run test:e2e    # end-to-end met lokale Postgres + PostgREST (zie supabase/tests)
```
