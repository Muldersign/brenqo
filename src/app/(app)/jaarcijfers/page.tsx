'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Pencil, Check, CircleCheck, CircleAlert, Info, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useBankAccounts, useCustomers, useExpenses, useInvoices, useOrg, useStore, useTransactions } from '@/lib/store';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Field, Textarea } from '@/components/ui/input';
import { SwitchRow } from '@/components/ui/switch';
import { AnimatedNumber, PageHeader, Segmented } from '@/components/ui/misc';
import { budgetKey, statementCategories, yearReport, type IncomeStatement } from '@/lib/domain/ledger';
import { formatEUR, parseAmount } from '@/lib/domain/money';
import { formatDateLong, todayISO } from '@/lib/domain/dates';
import { saveFile } from '@/lib/pdf/download';
import type { YearClosing } from '@/lib/types';
import { cn, pluralize } from '@/lib/utils';

const EMPTY_CLOSING: YearClosing = { auditors: '', auditDate: '', approved: false, note: '' };

export default function YearFiguresPage() {
  const org = useOrg();
  const update = useStore((s) => s.updateOrganization);
  const invoices = useInvoices();
  const expenses = useExpenses();
  const transactions = useTransactions();
  const customers = useCustomers();
  const accounts = useBankAccounts();
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [editing, setEditing] = useState(false);
  const assoc = org.kind === 'association';

  const input = useMemo(
    () => ({ kind: org.kind, vatRegistered: org.vatRegistered, invoices, expenses, transactions, customers, accounts }),
    [org.kind, org.vatRegistered, invoices, expenses, transactions, customers, accounts],
  );
  const report = useMemo(() => yearReport(input, year, today), [input, year, today]);
  const budget = org.budgets?.[String(year)] ?? {};
  const nextBudget = org.budgets?.[String(year + 1)] ?? {};
  const closing = { ...EMPTY_CLOSING, ...org.yearClosings?.[String(year)] };
  const st = report.statement;
  const budgetResult = sumBudget(budget, 'income') - sumBudget(budget, 'cost');
  const running = !report.until.endsWith('-12-31');

  const checks = useMemo(() => {
    const inYear = (d: string) => d >= `${year}-01-01` && d <= report.until;
    const open = transactions.filter((t) => inYear(t.date) && (t.status === 'todo' || t.status === 'suggested')).length;
    const review = expenses.filter((e) => inYear(e.date) && e.status === 'review').length;
    const noDoc = expenses.filter((e) => inYear(e.date) && !e.document?.storagePath && !e.document?.previewDataUrl && !e.document?.fileName).length;
    return [
      { ok: open === 0, label: open ? `${pluralize(open, 'banktransactie', 'banktransacties')} nog niet verwerkt` : 'Alle banktransacties zijn verwerkt', href: '/bank' },
      { ok: review === 0, label: review ? `${pluralize(review, 'bon', 'bonnen')} nog niet gecontroleerd` : 'Alle bonnen en facturen zijn gecontroleerd', href: '/bonnetjes' },
      { ok: noDoc === 0, label: noDoc ? `${pluralize(noDoc, 'uitgave', 'uitgaven')} zonder bon of factuur` : 'Bij elke uitgave zit een bon of factuur', href: '/bonnetjes' },
      !report.complete
        ? { ok: false, label: `Bankafschriften vanaf 1 januari ${year} ontbreken`, href: '/bank' }
        : { ok: Math.abs(report.unexplained) < 1, label: Math.abs(report.unexplained) < 1 ? 'Resultaat en banksaldo sluiten op elkaar aan' : `${formatEUR(Math.abs(report.unexplained))} verschil tussen resultaat en banksaldo`, href: '/bank' },
    ];
  }, [transactions, expenses, year, report.until, report.unexplained, report.complete]);

  function setBudget(y: number, side: 'income' | 'cost', category: string, value: number) {
    const all = { ...org.budgets };
    const b = { ...all[String(y)] };
    if (value) b[budgetKey(side, category)] = value; else delete b[budgetKey(side, category)];
    all[String(y)] = b;
    update({ budgets: all });
  }

  function copyActualsToNextYear() {
    const b: Record<string, number> = {};
    st.income.forEach((l) => { b[budgetKey('income', l.category)] = Math.round(l.amount); });
    st.costs.forEach((l) => { b[budgetKey('cost', l.category)] = Math.round(l.amount); });
    update({ budgets: { ...org.budgets, [String(year + 1)]: b } });
    setEditing(true);
    toast.success(`Begroting ${year + 1} gevuld met de cijfers van ${year}`);
  }

  const setClosing = (patch: Partial<YearClosing>) => update({ yearClosings: { ...org.yearClosings, [String(year)]: { ...closing, ...patch } } });

  async function exportPdf() {
    const [{ pdf }, { YearReportPdf }] = await Promise.all([import('@react-pdf/renderer'), import('@/lib/pdf/year-report-pdf')]);
    const blob = await pdf(<YearReportPdf org={org} report={report} budget={budget} nextBudget={nextBudget} closing={assoc ? closing : undefined} />).toBlob();
    await saveFile(`${assoc ? 'Financieel jaarverslag' : 'Jaaroverzicht'} ${year} - ${org.name}.pdf`, blob);
  }

  function exportCsv() {
    const n = (v: number) => v.toFixed(2).replace('.', ',');
    const rows = [`Soort;Categorie;${year};${year - 1}${assoc ? `;Begroting ${year};Begroting ${year + 1}` : ''}`];
    for (const side of ['income', 'cost'] as const) {
      for (const c of statementCategories(side, [st, report.previous], [budget, nextBudget])) {
        const cur = pick(st, side, c);
        const prev = pick(report.previous, side, c);
        rows.push(`${side === 'income' ? (assoc ? 'Baten' : 'Opbrengsten') : assoc ? 'Lasten' : 'Kosten'};${c};${n(cur)};${n(prev)}${assoc ? `;${n(budget[budgetKey(side, c)] ?? 0)};${n(nextBudget[budgetKey(side, c)] ?? 0)}` : ''}`);
      }
    }
    saveFile(`jaarcijfers-${year}-${org.name}.csv`, new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }));
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={assoc ? 'Jaarcijfers' : 'Jaaroverzicht'}
        description={assoc ? 'Alles voor de penningmeester: baten en lasten, balans, begroting en kascontrole.' : 'Je winst-en-verliesrekening en balans. Handig voor je aangifte en je boekhouder.'}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}><FileSpreadsheet /> CSV</Button>
            <Button onClick={() => exportPdf().catch(() => toast.error('PDF maken lukte niet'))}><Download /> {assoc ? 'Jaarverslag (PDF)' : 'PDF'}</Button>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented value={String(year)} onChange={(v) => { setYear(Number(v)); setEditing(false); }} options={[thisYear - 2, thisYear - 1, thisYear].map((y) => ({ value: String(y), label: String(y) }))} />
        {running && <span className="text-[13px] text-muted">Tussenstand t/m {formatDateLong(report.until)}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label={assoc ? 'Baten' : 'Opbrengsten'} value={st.totalIncome} sub={assoc && sumBudget(budget, 'income') ? `Begroot ${formatEUR(sumBudget(budget, 'income'), { round: true })}` : `${year - 1}: ${formatEUR(report.previous.totalIncome, { round: true })}`} />
        <Stat label={assoc ? 'Lasten' : 'Kosten'} value={st.totalCosts} sub={assoc && sumBudget(budget, 'cost') ? `Begroot ${formatEUR(sumBudget(budget, 'cost'), { round: true })}` : `${year - 1}: ${formatEUR(report.previous.totalCosts, { round: true })}`} />
        <Stat label={assoc ? 'Resultaat' : 'Winst'} value={st.result} sub={assoc && Object.keys(budget).length ? `Begroot ${formatEUR(budgetResult, { round: true })}` : st.result >= 0 ? 'Positief' : 'Negatief'} />
        <Stat label={assoc ? 'Verenigingsvermogen' : 'Eigen vermogen'} value={report.closing.equity} sub={report.opening.complete ? `Begin van het jaar ${formatEUR(report.opening.equity, { round: true })}` : 'Begin van het jaar onbekend'} />
      </div>

      <Card className="mt-4 sm:mt-5">
        <CardHeader
          title={assoc ? 'Staat van baten en lasten' : 'Winst-en-verliesrekening'}
          description={assoc ? 'Werkelijke cijfers naast de begroting' : `${year} vergeleken met ${year - 1}`}
          action={assoc ? (
            <Button size="sm" variant={editing ? 'primary' : 'outline'} onClick={() => setEditing(!editing)}>{editing ? <><Check /> Klaar</> : <><Pencil /> Begroting</>}</Button>
          ) : undefined}
        />
        <div className="overflow-x-auto px-5 pb-5 pt-3 sm:px-6">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] font-medium text-muted">
                <th className="py-2 font-medium">Categorie</th>
                <th className="py-2 text-right font-medium">{year}</th>
                {assoc && <th className="py-2 text-right font-medium">Begroting {year}</th>}
                <th className="py-2 text-right font-medium">{year - 1}</th>
                {assoc && <th className="py-2 text-right font-medium">Begroting {year + 1}</th>}
              </tr>
            </thead>
            {(['income', 'cost'] as const).map((side) => {
              const cats = statementCategories(side, [st, report.previous], assoc ? [budget, nextBudget] : []);
              const total = side === 'income' ? st.totalIncome : st.totalCosts;
              const prevTotal = side === 'income' ? report.previous.totalIncome : report.previous.totalCosts;
              return (
                <tbody key={side}>
                  <tr><td colSpan={5} className="pb-1 pt-4 text-[12px] font-medium uppercase tracking-[0.05em] text-muted">{side === 'income' ? (assoc ? 'Baten' : 'Opbrengsten') : assoc ? 'Lasten' : 'Kosten'}</td></tr>
                  {cats.length === 0 && <tr><td colSpan={5} className="py-2 text-[13px] text-faint">Nog niets geboekt</td></tr>}
                  {cats.map((c) => {
                    const cur = pick(st, side, c);
                    const b = budget[budgetKey(side, c)];
                    const over = assoc && b !== undefined && (side === 'cost' ? cur > b * 1.05 : cur < b * 0.95) && !running;
                    return (
                      <tr key={c} className="border-b border-line/70">
                        <td className="py-2.5 pr-3">{c}</td>
                        <td className={cn('tabular py-2.5 text-right font-medium', over && 'text-warning-700')}>{formatEUR(cur)}</td>
                        {assoc && <td className="py-1.5 text-right">{editing ? <BudgetInput key={`b${year}${c}${b ?? ''}`} value={b} onChange={(v) => setBudget(year, side, c, v)} /> : <span className="tabular text-muted">{b !== undefined ? formatEUR(b) : '—'}</span>}</td>}
                        <td className="tabular py-2.5 text-right text-muted">{formatEUR(pick(report.previous, side, c))}</td>
                        {assoc && <td className="py-1.5 text-right">{editing ? <BudgetInput key={`n${year}${c}${nextBudget[budgetKey(side, c)] ?? ''}`} value={nextBudget[budgetKey(side, c)]} onChange={(v) => setBudget(year + 1, side, c, v)} /> : <span className="tabular text-muted">{nextBudget[budgetKey(side, c)] !== undefined ? formatEUR(nextBudget[budgetKey(side, c)]) : '—'}</span>}</td>}
                      </tr>
                    );
                  })}
                  <tr className="font-semibold">
                    <td className="py-2.5">Totaal</td>
                    <td className="tabular py-2.5 text-right">{formatEUR(total)}</td>
                    {assoc && <td className="tabular py-2.5 text-right">{formatEUR(sumBudget(budget, side))}</td>}
                    <td className="tabular py-2.5 text-right">{formatEUR(prevTotal)}</td>
                    {assoc && <td className="tabular py-2.5 text-right">{formatEUR(sumBudget(nextBudget, side))}</td>}
                  </tr>
                </tbody>
              );
            })}
            <tfoot>
              <tr className="border-t-2 border-ink font-display text-[15px] font-semibold">
                <td className="py-3">{assoc ? 'Resultaat' : 'Winst'}</td>
                <td className="tabular py-3 text-right">{formatEUR(st.result)}</td>
                {assoc && <td className="tabular py-3 text-right">{formatEUR(budgetResult)}</td>}
                <td className="tabular py-3 text-right">{formatEUR(report.previous.result)}</td>
                {assoc && <td className="tabular py-3 text-right">{formatEUR(sumBudget(nextBudget, 'income') - sumBudget(nextBudget, 'cost'))}</td>}
              </tr>
            </tfoot>
          </table>
          {assoc && editing && (
            <div className="mt-4 flex flex-col gap-2 rounded-[18px] bg-canvas p-4 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
              <span>Een nieuwe post? Boek eerst iets op die categorie, of begin met de cijfers van dit jaar.</span>
              <Button size="sm" variant="outline" onClick={copyActualsToNextYear}><Copy /> Cijfers {year} als begroting {year + 1}</Button>
            </div>
          )}
        </div>
      </Card>

      <div className={cn('mt-4 grid grid-cols-1 gap-4', assoc && 'xl:grid-cols-2')}>
        <Card>
          <CardHeader title="Balans" description={`Wat ${assoc ? 'de vereniging' : 'je bedrijf'} bezit en nog moet betalen`} />
          <div className="overflow-x-auto px-5 pb-5 pt-3 sm:px-6">
            <table className="w-full min-w-[420px] text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-muted">
                  <th className="py-2 text-left font-medium" />
                  <th className="py-2 text-right font-medium">{running ? 'Vandaag' : `31-12-${year}`}</th>
                  <th className="py-2 text-right font-medium">31-12-{year - 1}</th>
                </tr>
              </thead>
              <tbody>
                <Group label="Bezittingen" />
                {report.closing.bank.map((b, i) => <BRow key={b.id} label={b.name} a={b.known ? b.amount : null} b={report.opening.bank[i]?.known ? report.opening.bank[i].amount : null} />)}
                {report.closing.bank.length === 0 && <tr><td colSpan={3} className="py-2 text-[13px] text-faint"><Link href="/bank/rekeningen" className="underline">Koppel een bankrekening</Link> voor de banksaldi</td></tr>}
                <BRow label={assoc ? 'Nog te ontvangen' : 'Nog te ontvangen van klanten'} a={report.closing.receivables} b={report.opening.receivables} />
                <Group label="Schulden" />
                <BRow label="Nog te betalen aan leveranciers" a={report.closing.payables} b={report.opening.payables} />
                {(report.closing.vatPayable !== 0 || report.opening.vatPayable !== 0) && <BRow label="Btw nog af te dragen" a={report.closing.vatPayable} b={report.opening.vatPayable} />}
                <tr className="border-t-2 border-ink font-semibold">
                  <td className="py-3">{assoc ? 'Verenigingsvermogen' : 'Eigen vermogen'}</td>
                  <td className="tabular py-3 text-right">{report.closing.complete ? formatEUR(report.closing.equity) : '—'}</td>
                  <td className="tabular py-3 text-right">{report.opening.complete ? formatEUR(report.opening.equity) : '—'}</td>
                </tr>
              </tbody>
            </table>
            {!report.complete ? (
              <p className="mt-4 flex gap-2 rounded-[18px] bg-canvas p-4 text-[13px] leading-relaxed text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  De bankgegevens beginnen {report.historyFrom ? `op ${formatDateLong(report.historyFrom)}` : 'nog niet'}. Het banksaldo op 31 december {year - 1} weten we daarom niet.{' '}
                  <Link href="/bank" className="font-medium text-ink underline underline-offset-2">Importeer je bankafschriften</Link> vanaf 1 januari {year}, dan klopt de balans helemaal.
                </span>
              </p>
            ) : (
            <dl className="mt-4 space-y-1.5 rounded-[18px] bg-canvas p-4 text-[13px]">
              <Flow label="Vermogen begin van het jaar" v={report.opening.equity} />
              <Flow label={assoc ? 'Resultaat' : 'Winst'} v={st.result} />
              {report.otherMovements !== 0 && <Flow label={assoc ? 'Overige mutaties' : 'Privé en belastingen'} v={report.otherMovements} />}
              {Math.abs(report.unexplained) >= 1 && <Flow label="Nog niet verklaard" v={report.unexplained} muted />}
              <Flow label="Vermogen nu" v={report.closing.equity} strong />
            </dl>
            )}
            {Math.abs(report.unexplained) >= 1 && (
              <p className="mt-3 flex gap-2 text-[12.5px] leading-relaxed text-muted"><Info className="mt-0.5 size-3.5 shrink-0" />Meestal betekent een verschil dat er nog banktransacties te verwerken zijn, of dat er een betaling is zonder factuur of bon.</p>
            )}
          </div>
        </Card>

        {assoc && (
          <Card>
            <CardHeader
              title="Kascontrole"
              description={`Klaar voor de kascommissie en de ledenvergadering over ${year}`}
              action={closing.approved ? <Badge tone="success"><CircleCheck className="size-3" /> Akkoord</Badge> : <Badge tone="muted">Nog niet</Badge>}
            />
            <div className="px-5 pb-5 pt-4 sm:px-6">
              <ul className="space-y-2">
                {checks.map((c) => (
                  <li key={c.label}>
                    <Link href={c.href} className="flex items-center gap-3 rounded-[14px] px-1 py-1 text-[14px] transition hover:bg-canvas">
                      {c.ok ? <CircleCheck className="size-[18px] shrink-0 text-success-600" /> : <CircleAlert className="size-[18px] shrink-0 text-warning-700" />}
                      <span className={c.ok ? 'text-ink-2' : 'font-medium text-ink'}>{c.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-4 border-t border-line pt-5">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_170px]">
                  <Field label="Kascommissie"><Input key={`a${year}`} defaultValue={closing.auditors} placeholder="Bijvoorbeeld: Johan Kuipers en Iris Wolters" onBlur={(e) => e.target.value !== closing.auditors && setClosing({ auditors: e.target.value })} /></Field>
                  <Field label="Datum controle"><Input type="date" value={closing.auditDate} onChange={(e) => setClosing({ auditDate: e.target.value })} /></Field>
                </div>
                <Field label="Opmerkingen" optional><Textarea key={`n${year}`} defaultValue={closing.note} className="min-h-[72px]" placeholder="Bevindingen of afspraken" onBlur={(e) => e.target.value !== closing.note && setClosing({ note: e.target.value })} /></Field>
                <SwitchRow title="Kascommissie is akkoord" description="Komt als verklaring in het jaarverslag, met het advies om het bestuur decharge te verlenen." checked={closing.approved} onCheckedChange={(v) => setClosing({ approved: v, auditDate: closing.auditDate || today })} />
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function pick(st: IncomeStatement, side: 'income' | 'cost', category: string) {
  return (side === 'income' ? st.income : st.costs).find((l) => l.category === category)?.amount ?? 0;
}

function sumBudget(b: Record<string, number>, side: 'income' | 'cost') {
  return Object.entries(b).filter(([k]) => k.startsWith(`${side}:`)).reduce((s, [, v]) => s + v, 0);
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div className="mt-2 font-display text-[22px] font-semibold tracking-[-0.03em] sm:text-[28px]"><AnimatedNumber value={value} /></div>
      <div className="mt-1.5 text-[12.5px] text-muted">{sub}</div>
    </Card>
  );
}

function Group({ label }: { label: string }) {
  return <tr><td colSpan={3} className="pb-1 pt-4 text-[12px] font-medium uppercase tracking-[0.05em] text-muted">{label}</td></tr>;
}

function BRow({ label, a, b }: { label: string; a: number | null; b: number | null }) {
  return (
    <tr className="border-b border-line/70">
      <td className="py-2.5 pr-3">{label}</td>
      <td className="tabular py-2.5 text-right font-medium">{a === null ? '—' : formatEUR(a)}</td>
      <td className="tabular py-2.5 text-right text-muted">{b === null ? '—' : formatEUR(b)}</td>
    </tr>
  );
}

function Flow({ label, v, strong, muted }: { label: string; v: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between', strong && 'border-t border-line pt-1.5 font-semibold text-ink', muted ? 'text-muted' : 'text-ink-2')}>
      <dt>{label}</dt>
      <dd className="tabular">{formatEUR(v)}</dd>
    </div>
  );
}

function BudgetInput({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(value !== undefined ? String(value).replace('.', ',') : '');
  return (
    <Input
      prefix="€"
      inputMode="decimal"
      className="ml-auto w-[120px] text-right"
      value={text}
      placeholder="0"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { const v = Math.max(0, parseAmount(text) || 0); if (v !== (value ?? 0)) onChange(v); }}
    />
  );
}
