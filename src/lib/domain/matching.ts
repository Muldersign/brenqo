import type { BankTransaction, Customer, Expense, Invoice } from '../types';
import { amountDue } from './calc';
import { normalize } from '../utils';

export interface MatchCandidate {
  invoiceId: string;
  confidence: number;
  reasons: string[];
}

/** Above this the payment may be booked without asking (if the automation is on). */
export const AUTO_MATCH_THRESHOLD = 90;
/** Above this we show "Factuur … lijkt betaald" with a confirm button. */
export const SUGGEST_THRESHOLD = 45;

function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalize(a).split(' ').filter((t) => t.length > 1));
  const tb = new Set(normalize(b).split(' ').filter((t) => t.length > 1));
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size);
}

const compact = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();

/**
 * Score how likely an incoming payment pays an open invoice. Uses the signals
 * a person would use: amount, invoice number or payment reference in the
 * description, the payer's name and their IBAN.
 */
export function scoreInvoiceMatch(tx: BankTransaction, inv: Invoice, customer?: Customer): MatchCandidate {
  const reasons: string[] = [];
  let score = 0;
  const due = amountDue(inv);
  if (Math.abs(due - tx.amount) < 0.01) {
    score += 45;
    reasons.push('Bedrag komt exact overeen');
  } else if (tx.amount < due && tx.amount > 0) {
    score += 8;
    reasons.push('Mogelijk een deelbetaling');
  }
  const desc = compact(tx.description);
  if (inv.number && desc.includes(compact(inv.number))) {
    score += 45;
    reasons.push(`Factuurnummer ${inv.number} staat in de omschrijving`);
  } else if (inv.reference && inv.reference.length > 3 && desc.includes(compact(inv.reference))) {
    score += 30;
    reasons.push('Kenmerk staat in de omschrijving');
  }
  if (customer) {
    if (customer.iban && compact(customer.iban) === compact(tx.counterpartyIban)) {
      score += 25;
      reasons.push('Bekend rekeningnummer van deze klant');
    }
    const sim = nameSimilarity(tx.counterparty, customer.companyName);
    if (sim >= 0.99) {
      score += 25;
      reasons.push('Naam betaler komt overeen');
    } else if (sim > 0.4) {
      score += 12;
      reasons.push('Naam betaler lijkt op de klantnaam');
    }
  }
  return { invoiceId: inv.id, confidence: Math.min(100, score), reasons };
}

export function bestInvoiceMatch(
  tx: BankTransaction,
  openInvoices: Invoice[],
  customers: Map<string, Customer>,
): MatchCandidate | null {
  if (tx.amount <= 0) return null;
  let best: MatchCandidate | null = null;
  for (const inv of openInvoices) {
    const c = scoreInvoiceMatch(tx, inv, customers.get(inv.customerId));
    if (!best || c.confidence > best.confidence) best = c;
  }
  return best && best.confidence >= SUGGEST_THRESHOLD ? best : null;
}

/** Outgoing payment ↔ an expense (receipt or purchase invoice) with the same amount and supplier. */
export function bestExpenseMatch(tx: BankTransaction, expenses: Expense[]): { expenseId: string; confidence: number } | null {
  if (tx.amount >= 0) return null;
  let best: { expenseId: string; confidence: number } | null = null;
  for (const e of expenses) {
    if (e.transactionId) continue;
    let score = 0;
    if (Math.abs(e.total + tx.amount) < 0.01) score += 55;
    const sim = nameSimilarity(tx.counterparty, e.supplierName);
    if (sim > 0.4) score += 35;
    if (e.invoiceNumber && compact(tx.description).includes(compact(e.invoiceNumber))) score += 20;
    if (score >= 55 && (!best || score > best.confidence)) best = { expenseId: e.id, confidence: Math.min(100, score) };
  }
  return best;
}
