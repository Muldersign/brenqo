import { round2 } from './money';

/**
 * Dutch income tax (box 1) for a sole trader, as an estimate. Only the parts
 * a ZZP'er needs to set money aside: entrepreneur deductions, mkb-winst-
 * vrijstelling, the general and labour tax credits and the Zvw contribution.
 * Rates for people below AOW age.
 */
export interface TaxYear {
  year: number;
  brackets: { upTo: number; rate: number }[];
  selfEmployedDeduction: number;
  starterDeduction: number;
  smeExemption: number;
  /** Deductions are only worth this rate in the top bracket. */
  maxDeductionRate: number;
  generalCredit: { max: number; phaseOutFrom: number; rate: number };
  /** Labour credit: per bracket `base + rate × (income − from)`. Last row phases out. */
  labourCredit: { from: number; base: number; rate: number }[];
  zvw: { rate: number; maxIncome: number };
}

export const TAX_YEARS: Record<number, TaxYear> = {
  2025: {
    year: 2025,
    brackets: [{ upTo: 38441, rate: 0.3582 }, { upTo: 76817, rate: 0.3748 }, { upTo: Infinity, rate: 0.495 }],
    selfEmployedDeduction: 2470,
    starterDeduction: 2123,
    smeExemption: 0.127,
    maxDeductionRate: 0.3748,
    generalCredit: { max: 3068, phaseOutFrom: 28406, rate: 0.06337 },
    labourCredit: [
      { from: 0, base: 0, rate: 0.08053 },
      { from: 12169, base: 980, rate: 0.3003 },
      { from: 26288, base: 5220, rate: 0.02258 },
      { from: 43071, base: 5599, rate: -0.0651 },
    ],
    zvw: { rate: 0.0526, maxIncome: 75860 },
  },
  2026: {
    year: 2026,
    brackets: [{ upTo: 38883, rate: 0.3575 }, { upTo: 78426, rate: 0.3756 }, { upTo: Infinity, rate: 0.495 }],
    selfEmployedDeduction: 1200,
    starterDeduction: 2123,
    smeExemption: 0.127,
    maxDeductionRate: 0.3756,
    generalCredit: { max: 3115, phaseOutFrom: 29736, rate: 0.06398 },
    labourCredit: [
      { from: 0, base: 0, rate: 0.08324 },
      { from: 11965, base: 996, rate: 0.31009 },
      { from: 25845, base: 5300, rate: 0.0195 },
      { from: 45592, base: 5685, rate: -0.0651 },
    ],
    zvw: { rate: 0.0485, maxIncome: 79409 },
  },
};

/** Rates for `year`, or the most recent year we know (flagged as such). */
export function taxYear(year: number): TaxYear & { exact: boolean } {
  if (TAX_YEARS[year]) return { ...TAX_YEARS[year], exact: true };
  const known = Object.keys(TAX_YEARS).map(Number).sort((a, b) => a - b);
  const pick = year < known[0] ? known[0] : known[known.length - 1];
  return { ...TAX_YEARS[pick], exact: false };
}

export interface TaxSettings {
  /** At least 1,225 hours in the business: unlocks zelfstandigen- and startersaftrek. */
  hoursCriterion: boolean;
  starter: boolean;
  /** Salary or other box 1 income; its tax is withheld by the employer. */
  otherIncome: number;
  /** Already paid via a voorlopige aanslag, per year. */
  provisionalPaid: Record<string, number>;
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = { hoursCriterion: true, starter: false, otherIncome: 0, provisionalPaid: {} };

function bracketTax(income: number, t: TaxYear) {
  let tax = 0;
  let lower = 0;
  for (const b of t.brackets) {
    if (income <= lower) break;
    tax += (Math.min(income, b.upTo) - lower) * b.rate;
    lower = b.upTo;
  }
  return tax;
}

function generalCredit(income: number, t: TaxYear) {
  const g = t.generalCredit;
  return Math.max(0, g.max - Math.max(0, income - g.phaseOutFrom) * g.rate);
}

function labourCredit(labourIncome: number, t: TaxYear) {
  if (labourIncome <= 0) return 0;
  const row = [...t.labourCredit].reverse().find((r) => labourIncome >= r.from)!;
  return Math.max(0, row.base + (labourIncome - row.from) * row.rate);
}

/** Box 1 tax after credits for a given taxable income and labour income. */
function netTax(taxable: number, labour: number, t: TaxYear) {
  const gross = bracketTax(Math.max(0, taxable), t);
  return Math.max(0, gross - generalCredit(taxable, t) - labourCredit(labour, t));
}

export interface IncomeTaxEstimate {
  year: number;
  exactRates: boolean;
  profit: number;
  selfEmployedDeduction: number;
  starterDeduction: number;
  smeExemption: number;
  taxableProfit: number;
  /** Income tax caused by the business (on top of what is withheld on other income). */
  incomeTax: number;
  zvw: number;
  total: number;
  provisionalPaid: number;
  /** What is probably still to pay (negative: refund). */
  remaining: number;
  /** Effective rate over the profit. */
  effectiveRate: number;
}

export function estimateIncomeTax(input: { year: number; profit: number; settings: TaxSettings }): IncomeTaxEstimate {
  const t = taxYear(input.year);
  const s = input.settings;
  const profit = Math.max(0, input.profit);
  const other = Math.max(0, s.otherIncome || 0);

  const selfEmployed = s.hoursCriterion ? Math.min(t.selfEmployedDeduction, profit) : 0;
  const starter = s.hoursCriterion && s.starter ? Math.min(t.starterDeduction, profit - selfEmployed) : 0;
  const afterDeductions = profit - selfEmployed - starter;
  const sme = afterDeductions * t.smeExemption;
  const taxableProfit = afterDeductions - sme;

  const taxable = other + taxableProfit;
  // Deductions in the top bracket only reduce tax at the capped rate.
  const topStart = t.brackets[t.brackets.length - 2].upTo;
  const capCorrection = Math.min(selfEmployed + starter + sme, Math.max(0, taxable - topStart)) * (t.brackets[t.brackets.length - 1].rate - t.maxDeductionRate);
  const labour = other + afterDeductions;
  const incomeTax = Math.max(0, netTax(taxable, labour, t) - netTax(other, other, t) + capCorrection);

  const zvw = Math.max(0, Math.min(taxableProfit, t.zvw.maxIncome - other)) * t.zvw.rate;
  const total = incomeTax + zvw;
  const provisionalPaid = s.provisionalPaid?.[String(input.year)] ?? 0;

  return {
    year: input.year,
    exactRates: t.exact,
    profit: round2(input.profit),
    selfEmployedDeduction: round2(selfEmployed),
    starterDeduction: round2(starter),
    smeExemption: round2(sme),
    taxableProfit: round2(taxableProfit),
    incomeTax: round2(incomeTax),
    zvw: round2(zvw),
    total: round2(total),
    provisionalPaid: round2(provisionalPaid),
    remaining: round2(total - provisionalPaid),
    effectiveRate: profit > 0 ? total / profit : 0,
  };
}

/** Straight-line projection of a year-to-date amount to the full year. */
export function projectYear(ytd: number, today: string, year: number) {
  const y = Number(today.slice(0, 4));
  if (y > year) return ytd;
  if (y < year) return 0;
  const start = Date.UTC(year, 0, 1);
  const now = Date.UTC(y, Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  const days = Math.max(1, Math.round((now - start) / 86400000) + 1);
  const total = (Date.UTC(year + 1, 0, 1) - start) / 86400000;
  return round2((ytd / days) * total);
}

/** Share of the year that has passed, 0–1. */
export function yearFraction(today: string, year: number) {
  const y = Number(today.slice(0, 4));
  if (y !== year) return y > year ? 1 : 0;
  const start = Date.UTC(year, 0, 1);
  const now = Date.UTC(y, Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  return Math.min(1, (Math.round((now - start) / 86400000) + 1) / ((Date.UTC(year + 1, 0, 1) - start) / 86400000));
}
