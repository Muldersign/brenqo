import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Organization, YearClosing } from '../types';
import { budgetKey, statementCategories, type YearReport } from '../domain/ledger';
import { formatEUR } from '../domain/money';
import { formatDateLong } from '../domain/dates';

/**
 * Financial year report: for the general meeting of an association (with
 * budget and audit committee) or as a year overview for a business.
 */
export function YearReportPdf({ org, report, budget, nextBudget, closing }: {
  org: Organization;
  report: YearReport;
  budget: Record<string, number>;
  nextBudget: Record<string, number>;
  closing?: YearClosing;
}) {
  const assoc = org.kind === 'association';
  const { year, statement: st, previous: prev } = report;
  const amount = (list: { category: string; amount: number }[], c: string) => list.find((l) => l.category === c)?.amount ?? 0;
  const cols = assoc ? [`${year}`, `Begroting ${year}`, `${year - 1}`, `Begroting ${year + 1}`] : [`${year}`, `${year - 1}`];

  const section = (side: 'income' | 'cost') => {
    const cats = statementCategories(side, [st, prev], assoc ? [budget, nextBudget] : []);
    const list = side === 'income' ? st.income : st.costs;
    const prevList = side === 'income' ? prev.income : prev.costs;
    const values = (c: string) => assoc
      ? [amount(list, c), budget[budgetKey(side, c)] ?? 0, amount(prevList, c), nextBudget[budgetKey(side, c)] ?? 0]
      : [amount(list, c), amount(prevList, c)];
    const sumBudget = (b: Record<string, number>) => cats.reduce((sum, c) => sum + (b[budgetKey(side, c)] ?? 0), 0);
    const totals = assoc
      ? [side === 'income' ? st.totalIncome : st.totalCosts, sumBudget(budget), side === 'income' ? prev.totalIncome : prev.totalCosts, sumBudget(nextBudget)]
      : [side === 'income' ? st.totalIncome : st.totalCosts, side === 'income' ? prev.totalIncome : prev.totalCosts];
    return { cats, values, totals };
  };
  const inc = section('income');
  const cost = section('cost');
  const result = inc.totals.map((v, i) => v - cost.totals[i]);

  return (
    <Document title={`Financieel jaarverslag ${year} ${org.name}`} author={org.name} language="nl">
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{assoc ? 'FINANCIEEL JAARVERSLAG' : 'JAAROVERZICHT'}</Text>
        <Text style={s.title}>{org.name} · {year}</Text>
        <Text style={s.muted}>{report.until.endsWith('-12-31') ? `Boekjaar 1 januari t/m 31 december ${year}` : `Tussentijds, t/m ${formatDateLong(report.until)}`}</Text>

        <Text style={s.h2}>{assoc ? 'Staat van baten en lasten' : 'Winst-en-verliesrekening'}</Text>
        <View style={[s.row, s.head]}>
          <Text style={s.cat} />
          {cols.map((c) => <Text key={c} style={s.num}>{c}</Text>)}
        </View>
        <Text style={s.group}>{assoc ? 'Baten' : 'Opbrengsten'}</Text>
        {inc.cats.map((c) => <Line key={`i${c}`} label={c} values={inc.values(c)} />)}
        <Line label={assoc ? 'Totaal baten' : 'Totaal opbrengsten'} values={inc.totals} bold />
        <Text style={s.group}>{assoc ? 'Lasten' : 'Kosten'}</Text>
        {cost.cats.map((c) => <Line key={`c${c}`} label={c} values={cost.values(c)} />)}
        <Line label={assoc ? 'Totaal lasten' : 'Totaal kosten'} values={cost.totals} bold />
        <Line label={assoc ? 'Resultaat' : 'Winst'} values={result} bold top />

        <Text style={s.h2}>Balans</Text>
        <View style={[s.row, s.head]}>
          <Text style={s.cat} />
          <Text style={s.num}>{report.closing.date.endsWith('-12-31') ? `31-12-${year}` : formatDateLong(report.closing.date)}</Text>
          <Text style={s.num}>31-12-{year - 1}</Text>
        </View>
        <Text style={s.group}>Bezittingen</Text>
        {report.closing.bank.map((b, i) => <Line key={b.id} label={b.name} values={[b.known ? b.amount : null, report.opening.bank[i]?.known ? report.opening.bank[i].amount : null]} />)}
        <Line label={assoc ? 'Nog te ontvangen (contributie, sponsoring)' : 'Nog te ontvangen van klanten'} values={[report.closing.receivables, report.opening.receivables]} />
        <Text style={s.group}>Schulden en vermogen</Text>
        <Line label="Nog te betalen aan leveranciers" values={[report.closing.payables, report.opening.payables]} />
        {(report.closing.vatPayable !== 0 || report.opening.vatPayable !== 0) && <Line label="Btw nog af te dragen" values={[report.closing.vatPayable, report.opening.vatPayable]} />}
        <Line label={assoc ? 'Verenigingsvermogen' : 'Eigen vermogen'} values={[report.closing.complete ? report.closing.equity : null, report.opening.complete ? report.opening.equity : null]} bold top />

        {assoc && (
          <>
            <Text style={s.h2}>Verklaring kascommissie</Text>
            {closing?.approved ? (
              <Text style={s.p}>
                De kascommissie{closing.auditors ? ` (${closing.auditors})` : ''} heeft op {closing.auditDate ? formatDateLong(closing.auditDate) : '—'} de boeken over {year} gecontroleerd
                en akkoord bevonden. Zij adviseert de algemene ledenvergadering het bestuur decharge te verlenen.
              </Text>
            ) : (
              <Text style={s.p}>De kascontrole over {year} is nog niet afgerond.</Text>
            )}
            {closing?.note ? <Text style={[s.p, s.muted]}>{closing.note}</Text> : null}
            <View style={s.signRow}>
              <View style={s.sign}><Text style={s.muted}>Penningmeester</Text></View>
              <View style={s.sign}><Text style={s.muted}>Kascommissie</Text></View>
            </View>
          </>
        )}

        <Text style={s.footer} fixed>{org.name} · Opgesteld met Brenqo · Bedragen in euro{org.vatRegistered ? ', exclusief btw' : ''}</Text>
      </Page>
    </Document>
  );
}

function Line({ label, values, bold, top }: { label: string; values: (number | null)[]; bold?: boolean; top?: boolean }) {
  return (
    <View style={[s.row, top ? s.top : {}]}>
      <Text style={[s.cat, bold ? s.bold : {}]}>{label}</Text>
      {values.map((v, i) => <Text key={i} style={[s.num, bold ? s.bold : {}]}>{v === null ? '—' : formatEUR(v)}</Text>)}
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 9.5, color: '#0a0a0a', fontFamily: 'Helvetica', lineHeight: 1.45 },
  eyebrow: { fontSize: 8, letterSpacing: 1.2, color: '#737373' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  muted: { color: '#737373' },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 24, marginBottom: 6 },
  group: { fontSize: 8, letterSpacing: 0.8, color: '#737373', marginTop: 8, marginBottom: 2, textTransform: 'uppercase' },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5' },
  head: { borderBottomColor: '#0a0a0a' },
  top: { borderTopWidth: 1, borderTopColor: '#0a0a0a', marginTop: 2 },
  cat: { flex: 1 },
  num: { width: 86, textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },
  p: { marginTop: 4 },
  signRow: { flexDirection: 'row', gap: 24, marginTop: 36 },
  sign: { flex: 1, borderTopWidth: 0.5, borderTopColor: '#a3a3a3', paddingTop: 4 },
  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, fontSize: 7.5, color: '#a3a3a3' },
});
