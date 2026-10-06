/**
 * Bank statement import: CSV exports of the big Dutch banks and the
 * international CAMT.053 XML format. Pure functions, no DOM, so they also
 * run on the server and in tests.
 */

export interface ImportedTransaction {
  date: string; // YYYY-MM-DD
  amount: number; // positive = money in
  description: string;
  counterparty: string;
  counterpartyIban: string;
  accountIban: string;
  /** Stable id so importing the same file twice adds nothing. */
  externalId: string;
}

export interface ImportResult {
  format: 'ING' | 'Rabobank' | 'ABN AMRO' | 'CAMT.053' | 'CSV';
  transactions: ImportedTransaction[];
  accountIbans: string[];
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function num(s: string): number {
  const t = s.trim().replace(/^\+/, '');
  if (/,\d{1,2}$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  return Number(t.replace(/,/g, ''));
}

function isoDate(s: string): string {
  const t = s.trim();
  if (/^\d{8}$/.test(t)) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return t;
}

/** Small, deterministic string hash (FNV-1a) for external ids. */
export function hashId(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** RFC-4180-ish CSV parser with configurable delimiter and quoted fields. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const d = delimiter ?? ([';', ',', '\t'].map((c) => [c, firstLine.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0]);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === d) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

function withIds(list: Omit<ImportedTransaction, 'externalId'>[]): ImportedTransaction[] {
  const seen = new Map<string, number>();
  return list.map((t) => {
    const base = `${t.accountIban}|${t.date}|${t.amount.toFixed(2)}|${t.counterparty}|${t.description}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...t, externalId: `imp_${hashId(`${base}|${n}`)}` };
  });
}

function ibans(list: { accountIban: string }[]) {
  return [...new Set(list.map((t) => t.accountIban).filter(Boolean))];
}

function parseIng(rows: string[][]): ImportResult {
  const h = rows[0].map((x) => x.toLowerCase());
  const col = (name: string) => h.findIndex((x) => x.startsWith(name));
  const [cDate, cName, cAcc, cCounter, cDir, cAmount, cMsg] = [col('datum'), col('naam'), col('rekening'), col('tegenrekening'), col('af bij'), col('bedrag'), col('mededelingen')];
  const list = rows.slice(1).map((r) => ({
    date: isoDate(r[cDate]),
    amount: num(r[cAmount]) * (/^af$/i.test(r[cDir].trim()) ? -1 : 1),
    counterparty: clean(r[cName] ?? ''),
    counterpartyIban: clean(r[cCounter] ?? ''),
    accountIban: clean(r[cAcc] ?? ''),
    description: clean(r[cMsg] ?? '') || clean(r[cName] ?? ''),
  }));
  return { format: 'ING', transactions: withIds(list), accountIbans: ibans(list) };
}

function parseRabo(rows: string[][]): ImportResult {
  const h = rows[0].map((x) => x.toLowerCase());
  const col = (name: string) => h.indexOf(name);
  const desc = h.map((x, i) => (x.startsWith('omschrijving') ? i : -1)).filter((i) => i >= 0);
  const list = rows.slice(1).map((r) => ({
    date: isoDate(r[col('datum')]),
    amount: num(r[col('bedrag')]),
    counterparty: clean(r[col('naam tegenpartij')] ?? ''),
    counterpartyIban: clean(r[col('tegenrekening iban/bban')] ?? ''),
    accountIban: clean(r[col('iban/bban')] ?? ''),
    description: clean(desc.map((i) => r[i] ?? '').join(' ')),
  }));
  return { format: 'Rabobank', transactions: withIds(list), accountIbans: ibans(list) };
}

/** ABN AMRO TXT/TAB export: no header. account, currency, date, start, end, valuedate, amount, description. */
function parseAbn(rows: string[][]): ImportResult {
  const list = rows.map((r) => {
    const description = clean(r[7] ?? '');
    const name = description.match(/\/NAME\/([^/]+)/)?.[1] ?? description.match(/Naam:\s*([^\s].*?)(\s{2,}|Omschrijving|$)/)?.[1] ?? '';
    const iban = description.match(/\/IBAN\/([A-Z]{2}\d{2}[A-Z0-9]+)/)?.[1] ?? description.match(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9]+)/)?.[1] ?? '';
    const remi = description.match(/\/REMI\/(.*?)(\/[A-Z]{3,4}\/|$)/)?.[1] ?? description.match(/Omschrijving:\s*(.*?)(\s{2,}|Kenmerk|$)/)?.[1] ?? description;
    return { date: isoDate(r[2]), amount: num(r[6]), counterparty: clean(name), counterpartyIban: iban, accountIban: clean(r[0] ?? ''), description: clean(remi) };
  });
  return { format: 'ABN AMRO', transactions: withIds(list), accountIbans: ibans(list) };
}

function parseGenericCsv(rows: string[][]): ImportResult {
  const h = rows[0].map((x) => x.toLowerCase());
  const find = (...names: string[]) => h.findIndex((x) => names.some((n) => x.includes(n)));
  const cDate = find('datum', 'date', 'boekdatum');
  const cAmount = find('bedrag', 'amount');
  const cName = find('naam', 'name', 'tegenpartij', 'counterparty');
  const cDesc = find('omschrijving', 'description', 'mededeling');
  const cIban = find('tegenrekening', 'iban');
  if (cDate < 0 || cAmount < 0) throw new Error('Dit bestand herken ik niet. Exporteer je afschrift als CSV of CAMT.053 uit je bank-app.');
  const list = rows.slice(1).map((r) => ({
    date: isoDate(r[cDate]), amount: num(r[cAmount]), counterparty: clean(r[cName] ?? ''), counterpartyIban: clean(r[cIban] ?? ''),
    accountIban: '', description: clean(r[cDesc] ?? ''),
  }));
  return { format: 'CSV', transactions: withIds(list), accountIbans: [] };
}

function tag(xml: string, path: string[]): string {
  let cur = xml;
  for (const t of path) {
    const m = cur.match(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${t}>`));
    if (!m) return '';
    cur = m[1];
  }
  return cur.trim();
}

function parseCamt(xml: string): ImportResult {
  const stmts = xml.split(/<(?:\w+:)?Stmt>/).slice(1);
  const list: Omit<ImportedTransaction, 'externalId'>[] = [];
  const known = new Set<string>();
  for (const stmt of stmts) {
    const accountIban = tag(stmt, ['Acct', 'Id', 'IBAN']);
    for (const entry of stmt.split(/<(?:\w+:)?Ntry>/).slice(1)) {
      const amount = Number(tag(entry, ['Amt']).replace(',', '.'));
      const credit = tag(entry, ['CdtDbtInd']) === 'CRDT';
      const date = isoDate(tag(entry, ['BookgDt', 'Dt']) || tag(entry, ['BookgDt', 'DtTm']) || tag(entry, ['ValDt', 'Dt']));
      const party = credit ? 'Dbtr' : 'Cdtr';
      const counterparty = tag(entry, ['RltdPties', party, 'Nm']) || tag(entry, ['RltdPties', party, 'Pty', 'Nm']);
      const counterpartyIban = tag(entry, ['RltdPties', `${party}Acct`, 'Id', 'IBAN']);
      const description = clean(tag(entry, ['RmtInf', 'Ustrd']) || tag(entry, ['AddtlNtryInf']) || tag(entry, ['RmtInf', 'Strd', 'CdtrRefInf', 'Ref']));
      const ref = tag(entry, ['AcctSvcrRef']) || tag(entry, ['NtryRef']);
      if (ref) known.add(ref);
      list.push({ date, amount: credit ? amount : -amount, counterparty: clean(counterparty), counterpartyIban, accountIban, description: description || clean(counterparty) });
    }
  }
  return { format: 'CAMT.053', transactions: withIds(list), accountIbans: ibans(list) };
}

export function parseBankStatement(text: string, fileName = ''): ImportResult {
  if (/<\?xml|<Document[\s>]/.test(text.slice(0, 500)) || /\.xml$/i.test(fileName)) return parseCamt(text);
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('Het bestand is leeg.');
  const head = rows[0].map((x) => x.toLowerCase().trim());
  if (head.includes('af bij') && head.some((x) => x.startsWith('naam'))) return parseIng(rows);
  if (head.includes('iban/bban') && head.includes('naam tegenpartij')) return parseRabo(rows);
  if (rows[0].length >= 8 && /^\d{8}$/.test(rows[0][2]?.trim() ?? '') && /^[A-Z]{3}$/.test(rows[0][1]?.trim() ?? '')) return parseAbn(rows);
  return parseGenericCsv(rows);
}
