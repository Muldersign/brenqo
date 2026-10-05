export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const eurRound = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const num = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 });

/** € 1.210,00 */
export function formatEUR(n: number, opts: { round?: boolean; sign?: boolean } = {}) {
  const s = (opts.round ? eurRound : eur).format(Math.abs(n) < 0.005 ? 0 : n);
  if (opts.sign && n > 0) return `+ ${s}`;
  if (opts.sign && n < 0) return `− ${s.replace('-', '')}`;
  return s;
}

export function formatNumber(n: number) {
  return num.format(n);
}

/** Accepts "1.210,50", "1210.5", "€ 52,89". */
export function parseAmount(input: string): number {
  const s = input.replace(/[€\s]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized = s;
  if (lastComma > lastDot) normalized = s.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma && lastComma !== -1) normalized = s.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
