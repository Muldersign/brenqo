'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Info, PiggyBank, Percent, Landmark, HeartPulse, BookOpenCheck } from 'lucide-react';
import { useCustomers, useExpenses, useInvoices, useOrg, useStore, useTransactions } from '@/lib/store';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { SwitchRow } from '@/components/ui/switch';
import { AnimatedNumber, EmptyState, IconTile, PageHeader, Segmented } from '@/components/ui/misc';
import { DEFAULT_TAX_SETTINGS, estimateIncomeTax, projectYear, yearFraction, type TaxSettings } from '@/lib/domain/tax';
import { incomeStatement, ledgerEntries } from '@/lib/domain/ledger';
import { quarterRange, vatDeadline, vatSummary } from '@/lib/domain/vat';
import { formatEUR, parseAmount } from '@/lib/domain/money';
import { formatDateLong, todayISO } from '@/lib/domain/dates';
import { cn } from '@/lib/utils';

export default function TaxPage() {
  const org = useOrg();
  const update = useStore((s) => s.updateOrganization);
  const invoices = useInvoices();
  const expenses = useExpenses();
  const transactions = useTransactions();
  const customers = useCustomers();
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [basis, setBasis] = useState<'projected' | 'ytd'>('projected');
  const settings: TaxSettings = { ...DEFAULT_TAX_SETTINGS, ...org.tax };
  const current = year === thisYear;

  const calc = useMemo(() => {
    const to = current ? today : `${year}-12-31`;
    const entries = ledgerEntries({ kind: org.kind, vatRegistered: org.vatRegistered, invoices, expenses, transactions, customers }, `${year}-01-01`, to);
    const st = incomeStatement(entries);
    const projectedProfit = current ? projectYear(st.result, today, year) : st.result;
    const fullYear = estimateIncomeTax({ year, profit: projectedProfit, settings });
    const soFar = estimateIncomeTax({ year, profit: st.result, settings });

    // VAT that still has to be paid: quarters whose deadline hasn't passed.
    let vatOpen = 0;
    const openQuarters: { q: number; amount: number; deadline: string }[] = [];
    for (const q of [1, 2, 3, 4]) {
      const r = quarterRange(year, q);
      const deadline = vatDeadline(year, q);
      if (r.from > today || deadline < today) continue;
      const amount = vatSummary(invoices, expenses, r.from, r.to < today ? r.to : today).balance;
      openQuarters.push({ q, amount, deadline });
      vatOpen += Math.max(0, amount);
    }
    if (!org.vatRegistered) { vatOpen = 0; openQuarters.length = 0; }

    // Income tax earned so far, minus what the provisional assessment already covered.
    const fraction = yearFraction(today, year);
    const ibSoFar = Math.max(0, fullYear.total * fraction - fullYear.provisionalPaid * fraction);
    const ibToReserve = current ? ibSoFar : Math.max(0, fullYear.remaining);
    return { st, projectedProfit, fullYear, soFar, vatOpen, openQuarters, ibToReserve, fraction };
  }, [org.kind, org.vatRegistered, invoices, expenses, transactions, customers, year, current, today, settings.hoursCriterion, settings.starter, settings.otherIncome, settings.provisionalPaid]);

  if (org.kind === 'association') {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Belasting" />
        <Card>
          <EmptyState
            icon={<BookOpenCheck />}
            title="Een vereniging betaalt meestal geen inkomstenbelasting"
            description="Verenigingen zonder winstoogmerk zijn vaak vrijgesteld van vennootschapsbelasting. Voor de ledenvergadering heb je vooral de jaarcijfers nodig."
            action={<Button variant="outline" asChild><Link href="/jaarcijfers">Naar jaarcijfers</Link></Button>}
          />
        </Card>
      </div>
    );
  }

  const est = current && basis === 'ytd' ? calc.soFar : calc.fullYear;
  const reserve = calc.vatOpen + calc.ibToReserve;
  const setTax = (patch: Partial<TaxSettings>) => update({ tax: { ...settings, ...patch } });
  const pct = Math.round(calc.fullYear.effectiveRate * 100);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Belasting"
        description="Wat moet je ongeveer betalen? Dan weet je hoeveel je opzij moet zetten."
        actions={<Segmented value={String(year)} onChange={(v) => setYear(Number(v))} options={[{ value: String(thisYear - 1), label: String(thisYear - 1) }, { value: String(thisYear), label: String(thisYear) }]} />}
      />

      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[13.5px] font-medium text-muted"><PiggyBank className="size-4" /> {current ? 'Zet nu ongeveer opzij' : `Nog te betalen over ${year}`}</div>
        <div className="mt-2 text-[44px] font-semibold leading-[1.1] tracking-display sm:text-[56px]"><AnimatedNumber value={reserve} /></div>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">
          {current ? (
            <>
              {org.vatRegistered && <><span className="font-semibold text-ink">{formatEUR(calc.vatOpen)}</span> voor de btw die nog aangegeven moet worden en </>}
              <span className="font-semibold text-ink">{formatEUR(calc.ibToReserve)}</span> voor inkomstenbelasting en Zvw-bijdrage over wat je dit jaar tot nu toe verdiend hebt.
              {pct > 0 && <> Vuistregel: zet van elke euro winst ongeveer <span className="font-semibold text-ink">{pct} cent</span> apart{org.vatRegistered ? ', plus de btw op je facturen' : ''}.</>}
            </>
          ) : (
            <>Geschatte inkomstenbelasting en Zvw-bijdrage over {year}, min wat je al via een voorlopige aanslag betaald hebt.</>
          )}
        </p>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile icon={<Percent />} label="Btw nog aan te geven" value={calc.vatOpen} sub={org.vatRegistered ? (calc.openQuarters.length ? calc.openQuarters.map((q) => `Q${q.q} vóór ${formatDateLong(q.deadline)}`).join(' · ') : 'Niets openstaand') : 'Niet btw-plichtig'} href="/btw" />
        <Tile icon={<Landmark />} label={`Inkomstenbelasting ${year}`} value={calc.fullYear.incomeTax} sub={current ? 'Verwacht voor het hele jaar' : 'Over het hele jaar'} />
        <Tile icon={<HeartPulse />} label="Zvw-bijdrage" value={calc.fullYear.zvw} sub="Bijdrage zorgverzekeringswet" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader
            title="Zo rekenen we"
            description={current && basis === 'projected' ? `Je winst tot nu toe, doorgetrokken naar heel ${year}` : current ? 'Alleen je winst tot nu toe' : `Je winst over ${year}`}
            action={current ? <Segmented value={basis} onChange={setBasis} options={[{ value: 'projected', label: 'Hele jaar' }, { value: 'ytd', label: 'Tot nu toe' }]} /> : undefined}
          />
          <dl className="divide-y divide-line px-5 py-2 sm:px-6">
            <Row label="Omzet" value={calc.st.totalIncome} sub={current ? 'Tot nu toe, exclusief btw' : 'Exclusief btw'} />
            <Row label="Kosten" value={-calc.st.totalCosts} sub="Bonnetjes, inkoopfacturen en geboekte afschrijvingen van de bank" />
            <Row label={current && basis === 'projected' ? 'Verwachte winst' : 'Winst'} value={est.profit} strong />
            <Row label="Zelfstandigenaftrek" value={-est.selfEmployedDeduction} sub={settings.hoursCriterion ? undefined : 'Alleen als je aan het urencriterium voldoet'} indent />
            {settings.starter && <Row label="Startersaftrek" value={-est.starterDeduction} indent />}
            <Row label="Mkb-winstvrijstelling" value={-est.smeExemption} sub="12,7% van je winst na aftrek" indent />
            <Row label="Belastbare winst" value={est.taxableProfit} strong />
            <Row label="Inkomstenbelasting" value={est.incomeTax} sub={settings.otherIncome > 0 ? `Bovenop de loonheffing over ${formatEUR(settings.otherIncome)} ander inkomen, na heffingskortingen` : 'Na algemene heffingskorting en arbeidskorting'} />
            <Row label="Zvw-bijdrage" value={est.zvw} />
            {est.provisionalPaid > 0 && <Row label="Al betaald (voorlopige aanslag)" value={-est.provisionalPaid} />}
            <div className="flex items-center justify-between py-4">
              <dt className="font-display text-[16px] font-semibold">{est.remaining >= 0 ? 'Geschat te betalen' : 'Geschat terug te krijgen'}</dt>
              <dd className="tabular font-display text-[20px] font-semibold">{formatEUR(Math.abs(est.remaining))}</dd>
            </div>
          </dl>
        </Card>

        <div className="space-y-4">
          <Card className="px-5 pb-2 pt-5">
            <h3 className="font-display text-[15px] font-semibold">Jouw situatie</h3>
            <p className="mt-0.5 text-[13px] text-muted">Dit verandert de berekening.</p>
            <div className="divide-y divide-line">
              <SwitchRow title="Ik werk minstens 1.225 uur per jaar in mijn bedrijf" description="Het urencriterium. Dan krijg je zelfstandigenaftrek." checked={settings.hoursCriterion} onCheckedChange={(v) => setTax({ hoursCriterion: v })} />
              <SwitchRow title="Ik ben starter" description="Een van je eerste vijf jaar, en maximaal drie keer eerder aftrek gehad." checked={settings.starter} disabled={!settings.hoursCriterion} onCheckedChange={(v) => setTax({ starter: v })} />
              <div className="space-y-4 py-4">
                <Field label="Ander inkomen per jaar" hint="Bijvoorbeeld loon uit een baan, bruto. Daar wordt al belasting op ingehouden." optional>
                  <MoneyInput value={settings.otherIncome} onChange={(v) => setTax({ otherIncome: v })} />
                </Field>
                <Field label={`Voorlopige aanslag ${year} al betaald`} hint="Wat je dit jaar al aan de Belastingdienst hebt betaald voor inkomstenbelasting." optional>
                  <MoneyInput key={year} value={settings.provisionalPaid[String(year)] ?? 0} onChange={(v) => setTax({ provisionalPaid: { ...settings.provisionalPaid, [String(year)]: v } })} />
                </Field>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-start gap-3 text-[13px] leading-relaxed text-muted">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>
                Een schatting op basis van je administratie en de tarieven van {est.exactRates ? year : 'het meest recente jaar dat we kennen'}, voor iemand onder de AOW-leeftijd.
                Hypotheekrente, partner, toeslagen en box 3 tellen niet mee. De echte aangifte doe je bij de Belastingdienst of met je boekhouder.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, sub, href }: { icon: React.ReactNode; label: string; value: number; sub: string; href?: string }) {
  const body = (
    <Card className={cn('h-full p-4 sm:p-5', href && 'transition hover:border-line-strong')}>
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted"><IconTile className="size-7 rounded-[9px] [&_svg]:size-3.5">{icon}</IconTile>{label}</div>
      <div className="tabular mt-3 font-display text-[22px] font-semibold tracking-[-0.03em]">{formatEUR(value)}</div>
      <div className="mt-1 text-[12.5px] text-muted">{sub}</div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Row({ label, value, sub, strong, indent }: { label: string; value: number; sub?: string; strong?: boolean; indent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className={cn('min-w-0', indent && 'pl-4')}>
        <dt className={cn('text-[14px]', strong ? 'font-semibold text-ink' : indent ? 'text-muted' : 'font-medium text-ink')}>{label}</dt>
        {sub && <dd className="text-[12px] text-faint">{sub}</dd>}
      </div>
      <span className={cn('tabular text-[14.5px]', strong ? 'font-semibold' : 'font-medium')}>{formatEUR(value)}</span>
    </div>
  );
}

/** Amount field that only commits on blur, so typing isn't interrupted by recalculation. */
function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(value ? String(value).replace('.', ',') : '');
  return (
    <Input
      prefix="€"
      inputMode="decimal"
      value={text}
      placeholder="0"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { const v = Math.max(0, parseAmount(text) || 0); setText(v ? String(v).replace('.', ',') : ''); if (v !== value) onChange(v); }}
    />
  );
}
