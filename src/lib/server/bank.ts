import 'server-only';

/**
 * Open Banking (PSD2) adapter. Brenqo only needs read access: accounts,
 * balances and transactions. Any aggregator (GoCardless Bank Account Data,
 * Tink, Yapily, Enable Banking) fits behind this interface; the rest of the
 * app — matching, notifications — works on `NormalizedTransaction`.
 *
 * Flow: createConsent() → user is redirected to their bank → callback with
 * consent id → listAccounts() → fetchTransactions() on a schedule (and on
 * "Ophalen") → upsert into bank_transactions (unique on provider id) → run
 * the matcher (src/lib/domain/matching.ts).
 */
export interface NormalizedTransaction {
  providerTransactionId: string;
  date: string;
  amount: number;
  description: string;
  counterparty: string;
  counterpartyIban: string;
}

export interface BankProvider {
  createConsent(input: { institutionId: string; redirectUrl: string; reference: string }): Promise<{ consentId: string; authUrl: string; validUntil: string }>;
  listAccounts(consentId: string): Promise<{ providerAccountId: string; iban: string; name: string; balance: number }[]>;
  fetchTransactions(providerAccountId: string, since: string): Promise<NormalizedTransaction[]>;
}

export function bankProviderConfigured() {
  return !!(process.env.BANK_PROVIDER_SECRET_ID && process.env.BANK_PROVIDER_SECRET_KEY);
}
