import { describe, expect, it } from 'vitest';
import { parseBankStatement, parseCsv } from './bank-import';

describe('bank statement import', () => {
  it('reads an ING export (semicolon, Af/Bij)', () => {
    const csv = [
      '"Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Code";"Af Bij";"Bedrag (EUR)";"Mutatiesoort";"Mededelingen";"Saldo na mutatie";"Tag"',
      '"20261005";"De Leo Media";"NL00INGB0123456789";"NL20RABO0312345678";"OV";"Bij";"1210,00";"Overschrijving";"Naam: De Leo Media Omschrijving: Factuur 2026-034";"8420,55";""',
      '"20261004";"Adobe Systems Software Ireland";"NL00INGB0123456789";"";"BA";"Af";"72,59";"Betaalautomaat";"ADOBE *CREATIVE CLOUD";"7210,55";""',
    ].join('\r\n');
    const r = parseBankStatement(csv);
    expect(r.format).toBe('ING');
    expect(r.transactions[0]).toMatchObject({ date: '2026-10-05', amount: 1210, counterparty: 'De Leo Media', counterpartyIban: 'NL20RABO0312345678' });
    expect(r.transactions[1].amount).toBe(-72.59);
    expect(r.accountIbans).toEqual(['NL00INGB0123456789']);
  });

  it('reads a Rabobank export (signed amounts, three description columns)', () => {
    const csv = [
      '"IBAN/BBAN","Munt","BIC","Volgnr","Datum","Rentedatum","Bedrag","Saldo na trn","Tegenrekening IBAN/BBAN","Naam tegenpartij","Naam uiteindelijke partij","Naam initiërende partij","BIC tegenpartij","Code","Batch ID","Transactiereferentie","Machtigingskenmerk","Incassant ID","Betalingskenmerk","Omschrijving-1","Omschrijving-2","Omschrijving-3","Reden retour","Oorspr bedrag","Oorspr munt","Koers"',
      '"NL00RABO0123456789","EUR","RABONL2U","000000000000001234","2026-10-03","2026-10-03","+150,00","+6312,40","NL11INGB0001234567","R. Brink","","","INGBNL2A","cb","","","","","","Contributie VZ-2026-016","","","","","",""',
    ].join('\n');
    const r = parseBankStatement(csv);
    expect(r.format).toBe('Rabobank');
    expect(r.transactions[0]).toMatchObject({ date: '2026-10-03', amount: 150, counterparty: 'R. Brink', description: 'Contributie VZ-2026-016' });
  });

  it('reads an ABN AMRO tab export', () => {
    const tab = '123456789\tEUR\t20261002\t1000,00\t936,05\t20261002\t-63,95\t/TRTP/SEPA Incasso/CSID/NL00ZZZ/NAME/KPN B.V./MARF/123/REMI/KPN zakelijk factuur/IBAN/NL27INGB0000026500/';
    const r = parseBankStatement(tab);
    expect(r.format).toBe('ABN AMRO');
    expect(r.transactions[0]).toMatchObject({ amount: -63.95, counterparty: 'KPN B.V.', description: 'KPN zakelijk factuur', counterpartyIban: 'NL27INGB0000026500' });
  });

  it('reads CAMT.053 XML', () => {
    const xml = `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt>
      <Acct><Id><IBAN>NL00INGB0123456789</IBAN></Id></Acct>
      <Ntry><Amt Ccy="EUR">423.50</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-10-05</Dt></BookgDt><AcctSvcrRef>REF1</AcctSvcrRef>
        <NtryDtls><TxDtls><RltdPties><Dbtr><Nm>Studio Noord</Nm></Dbtr><DbtrAcct><Id><IBAN>NL71RABO0398765432</IBAN></Id></DbtrAcct></RltdPties>
        <RmtInf><Ustrd>Betaling posters tentoonstelling</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
      <Ntry><Amt Ccy="EUR">6.40</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-10-02</Dt></BookgDt>
        <NtryDtls><TxDtls><RltdPties><Cdtr><Nm>Q-Park Groningen</Nm></Cdtr></RltdPties><RmtInf><Ustrd>Parkeren</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
    </Stmt></BkToCstmrStmt></Document>`;
    const r = parseBankStatement(xml, 'afschrift.xml');
    expect(r.format).toBe('CAMT.053');
    expect(r.transactions).toEqual([
      expect.objectContaining({ amount: 423.5, counterparty: 'Studio Noord', counterpartyIban: 'NL71RABO0398765432', date: '2026-10-05' }),
      expect.objectContaining({ amount: -6.4, counterparty: 'Q-Park Groningen', description: 'Parkeren' }),
    ]);
  });

  it('gives identical rows distinct but stable ids', () => {
    const csv = 'Datum;Bedrag;Naam;Omschrijving\n2026-10-01;-2,50;Koffie;Koffie\n2026-10-01;-2,50;Koffie;Koffie\n';
    const a = parseBankStatement(csv).transactions.map((t) => t.externalId);
    const b = parseBankStatement(csv).transactions.map((t) => t.externalId);
    expect(new Set(a).size).toBe(2);
    expect(a).toEqual(b);
  });

  it('parses quoted fields with delimiters and escaped quotes', () => {
    expect(parseCsv('a;"b;c";"d ""e"""\n')).toEqual([['a', 'b;c', 'd "e"']]);
  });
});
