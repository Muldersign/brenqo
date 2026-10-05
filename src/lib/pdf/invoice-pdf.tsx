import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { Customer, Organization } from '../types';
import type { DocumentData } from '@/components/documents/invoice-document';
import { documentTotals, lineNet } from '../domain/calc';
import { formatEUR, formatNumber } from '../domain/money';
import { formatDateLong } from '../domain/dates';

/**
 * PDF version of the invoice. Isomorphic: the browser renders it for instant
 * downloads in the demo, and the same component can be rendered server-side
 * (`renderToBuffer`) to attach to e-mails — see src/app/api/invoices/pdf.
 */
export function InvoicePdf({ org, customer, doc }: { org: Organization; customer?: Customer; doc: DocumentData }) {
  const t = documentTotals(doc.lines);
  const title = doc.kind === 'quote' ? 'OFFERTE' : doc.kind === 'credit' ? 'CREDITFACTUUR' : 'FACTUUR';
  const s = styles(org.accentColor);
  return (
    <Document title={`${title} ${doc.number}`} author={org.name} language="nl">
      <Page size="A4" style={s.page}>
        <View style={s.bar} fixed />
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>{title}</Text>
            <Text style={s.number}>{doc.number || 'Concept'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {org.logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={org.logoDataUrl} style={{ width: 44, height: 44, objectFit: 'contain' }} />
            ) : (
              <View style={s.logo}><Text style={s.logoText}>{org.initials}</Text></View>
            )}
            <Text style={s.orgName}>{org.tradeName || org.name}</Text>
          </View>
        </View>

        <View style={s.parties}>
          <View style={s.col}>
            <Text style={s.label}>AAN</Text>
            {customer && (
              <>
                <Text style={s.bold}>{customer.companyName}</Text>
                {customer.contactName && customer.contactName !== customer.companyName ? <Text>t.a.v. {customer.contactName}</Text> : null}
                <Text>{customer.address}</Text>
                <Text>{customer.postalCode} {customer.city}</Text>
                {customer.vatNumber ? <Text style={s.muted}>Btw: {customer.vatNumber}</Text> : null}
              </>
            )}
          </View>
          <View style={s.col}>
            <Text style={s.label}>VAN</Text>
            <Text style={s.bold}>{org.name}</Text>
            <Text>{org.address}</Text>
            <Text>{org.postalCode} {org.city}</Text>
            <Text style={s.muted}>{org.email}</Text>
          </View>
          <View style={[s.col, { alignItems: 'flex-end' }]}>
            <Text style={s.label}>{doc.kind === 'quote' ? 'OFFERTEDATUM' : 'FACTUURDATUM'}</Text>
            <Text style={s.bold}>{formatDateLong(doc.issueDate)}</Text>
            {doc.kind !== 'credit' && (
              <>
                <Text style={[s.label, { marginTop: 8 }]}>{doc.kind === 'quote' ? 'GELDIG TOT' : 'VERVALDATUM'}</Text>
                <Text style={s.bold}>{formatDateLong(doc.dueDate)}</Text>
              </>
            )}
            {doc.reference ? (<><Text style={[s.label, { marginTop: 8 }]}>KENMERK</Text><Text style={s.bold}>{doc.reference}</Text></>) : null}
          </View>
        </View>

        <View style={s.tableHead}>
          <Text style={[s.th, { flex: 1 }]}>OMSCHRIJVING</Text>
          <Text style={[s.th, s.qty]}>AANTAL</Text>
          <Text style={[s.th, s.price]}>PRIJS</Text>
          <Text style={[s.th, s.amount]}>BEDRAG</Text>
        </View>
        {doc.lines.map((l) => (
          <View key={l.id} style={s.row} wrap={false}>
            <View style={{ flex: 1 }}>
              <Text style={s.bold}>{l.description}</Text>
              <Text style={s.small}>{org.vatRegistered ? `${l.vatRate}% btw` : ''}{l.discountPct ? `  ·  ${l.discountPct}% korting` : ''}</Text>
            </View>
            <Text style={s.qty}>{formatNumber(l.quantity)} {l.unit}</Text>
            <Text style={s.price}>{formatEUR(l.unitPrice)}</Text>
            <Text style={[s.amount, s.bold]}>{formatEUR(lineNet(l))}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.totRow}><Text style={s.muted}>Subtotaal</Text><Text>{formatEUR(t.subtotal)}</Text></View>
          {org.vatRegistered && t.vatByRate.map((r) => (
            <View key={r.rate} style={s.totRow}><Text style={s.muted}>Btw {r.rate}% over {formatEUR(r.base)}</Text><Text>{formatEUR(r.vat)}</Text></View>
          ))}
          <View style={[s.totRow, s.totFinal]}><Text style={s.bold}>Totaal</Text><Text style={s.grand}>{formatEUR(t.total)}</Text></View>
        </View>

        {doc.note || !org.vatRegistered ? (
          <View style={s.note}><Text>{doc.note}{!org.vatRegistered ? `${doc.note ? '\n' : ''}Vrijgesteld van btw.` : ''}</Text></View>
        ) : null}

        {doc.kind === 'invoice' && (
          <Text style={s.pay}>
            Graag ontvangen wij het bedrag van {formatEUR(t.total - (doc.paidAmount ?? 0))} vóór {formatDateLong(doc.dueDate)} op rekening {org.iban} t.n.v. {org.name}, onder vermelding van factuurnummer {doc.number}.
          </Text>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footCol}>{org.name}{'\n'}{org.address}, {org.postalCode} {org.city}</Text>
          <Text style={s.footCol}>{org.email}{'\n'}{org.phone}</Text>
          <Text style={s.footCol}>{org.iban}{org.bic ? `\nBIC ${org.bic}` : ''}</Text>
          <Text style={s.footCol}>KvK {org.kvk || '—'}{org.vatNumber ? `\nBtw ${org.vatNumber}` : ''}</Text>
        </View>
      </Page>
    </Document>
  );
}

function styles(accent: string) {
  return StyleSheet.create({
    page: { paddingTop: 46, paddingBottom: 90, paddingHorizontal: 46, fontSize: 9.5, color: '#1d1d24', fontFamily: 'Helvetica', lineHeight: 1.45 },
    bar: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: accent },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    eyebrow: { fontSize: 8.5, letterSpacing: 1.6, color: accent, fontFamily: 'Helvetica-Bold' },
    number: { fontSize: 24, fontFamily: 'Helvetica-Bold', marginTop: 4 },
    logo: { width: 40, height: 40, borderRadius: 10, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' },
    logoText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 14 },
    orgName: { marginTop: 6, fontFamily: 'Helvetica-Bold', fontSize: 11 },
    parties: { flexDirection: 'row', marginTop: 34, gap: 20 },
    col: { flex: 1 },
    label: { fontSize: 7.5, color: '#9a9aa6', letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
    bold: { fontFamily: 'Helvetica-Bold' },
    muted: { color: '#6b6b76' },
    small: { fontSize: 8, color: '#9a9aa6', marginTop: 1 },
    tableHead: { flexDirection: 'row', marginTop: 34, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#ececf1' },
    th: { fontSize: 7.5, color: '#9a9aa6', letterSpacing: 1, fontFamily: 'Helvetica-Bold' },
    row: { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f3f3f6', alignItems: 'flex-start' },
    qty: { width: 70, textAlign: 'right', color: '#45454f' },
    price: { width: 80, textAlign: 'right', color: '#45454f' },
    amount: { width: 85, textAlign: 'right' },
    totals: { marginTop: 16, marginLeft: 'auto', width: 230 },
    totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
    totFinal: { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#ececf1', alignItems: 'center' },
    grand: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
    note: { marginTop: 28, padding: 14, backgroundColor: '#f8f8fa', borderRadius: 10, color: '#45454f' },
    pay: { marginTop: 18, color: '#45454f' },
    footer: { position: 'absolute', bottom: 34, left: 46, right: 46, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#ececf1', paddingTop: 10 },
    footCol: { flex: 1, fontSize: 7.5, color: '#9a9aa6' },
  });
}
