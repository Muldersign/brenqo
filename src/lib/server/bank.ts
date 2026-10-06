import 'server-only';

/**
 * Open Banking (PSD2) via GoCardless Bank Account Data (formerly Nordigen):
 * read-only access to accounts, balances and transactions of Dutch banks.
 * Credentials: BANK_PROVIDER_SECRET_ID / BANK_PROVIDER_SECRET_KEY.
 *
 * Flow: createConsent() → user approves in their own bank app → our callback
 * → listAccounts() → fetchTransactions() daily (cron) and on "Ophalen".
 */
const API = 'https://bankaccountdata.gocardless.com/api/v2';

export interface NormalizedTransaction {
  externalId: string;
  date: string;
  amount: number;
  description: string;
  counterparty: string;
  counterpartyIban: string;
}

export function bankProviderConfigured() {
  return !!(process.env.BANK_PROVIDER_SECRET_ID && process.env.BANK_PROVIDER_SECRET_KEY);
}

let token: { access: string; expires: number } | null = null;

async function accessToken() {
  if (token && token.expires > Date.now() + 60_000) return token.access;
  const res = await fetch(`${API}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_id: process.env.BANK_PROVIDER_SECRET_ID, secret_key: process.env.BANK_PROVIDER_SECRET_KEY }),
  });
  if (!res.ok) throw new Error(`Bankkoppeling: inloggen bij provider mislukt (${res.status})`);
  const json = (await res.json()) as { access: string; access_expires: number };
  token = { access: json.access, expires: Date.now() + json.access_expires * 1000 };
  return token.access;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...init.headers } });
  if (!res.ok) throw new Error(`Bankkoppeling ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export function listInstitutions(country = 'NL') {
  return call<{ id: string; name: string; logo: string; transaction_total_days: string }[]>(`/institutions/?country=${country}`);
}

export async function createConsent(input: { institutionId: string; redirectUrl: string; reference: string }) {
  const agreement = await call<{ id: string; access_valid_for_days: number }>('/agreements/enduser/', {
    method: 'POST',
    body: JSON.stringify({ institution_id: input.institutionId, max_historical_days: 90, access_valid_for_days: 90, access_scope: ['balances', 'details', 'transactions'] }),
  });
  const req = await call<{ id: string; link: string }>('/requisitions/', {
    method: 'POST',
    body: JSON.stringify({ redirect: input.redirectUrl, institution_id: input.institutionId, reference: input.reference, agreement: agreement.id, user_language: 'NL' }),
  });
  return { requisitionId: req.id, link: req.link, validDays: agreement.access_valid_for_days };
}

export function getRequisition(id: string) {
  return call<{ id: string; status: string; accounts: string[]; institution_id: string }>(`/requisitions/${id}/`);
}

export async function accountInfo(accountId: string) {
  const [details, balances] = await Promise.all([
    call<{ account: { iban?: string; name?: string; ownerName?: string; product?: string } }>(`/accounts/${accountId}/details/`),
    call<{ balances: { balanceAmount: { amount: string }; balanceType: string }[] }>(`/accounts/${accountId}/balances/`),
  ]);
  const pick = balances.balances.find((b) => b.balanceType === 'interimAvailable') ?? balances.balances.find((b) => b.balanceType === 'closingBooked') ?? balances.balances[0];
  return { iban: details.account.iban ?? '', name: details.account.name || details.account.product || details.account.ownerName || 'Rekening', balance: pick ? Number(pick.balanceAmount.amount) : 0 };
}

interface RawTx {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount: { amount: string };
  creditorName?: string;
  debtorName?: string;
  creditorAccount?: { iban?: string };
  debtorAccount?: { iban?: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  additionalInformation?: string;
}

export function normalizeTransaction(t: RawTx): NormalizedTransaction {
  const amount = Number(t.transactionAmount.amount);
  const incoming = amount > 0;
  const counterparty = (incoming ? t.debtorName : t.creditorName) ?? t.creditorName ?? t.debtorName ?? '';
  const description = t.remittanceInformationUnstructured ?? t.remittanceInformationUnstructuredArray?.join(' ') ?? t.additionalInformation ?? counterparty;
  return {
    externalId: `psd2_${t.transactionId ?? t.internalTransactionId ?? `${t.bookingDate}_${amount}_${description}`}`,
    date: (t.bookingDate ?? t.valueDate ?? new Date().toISOString()).slice(0, 10),
    amount,
    description: description.replace(/\s+/g, ' ').trim(),
    counterparty: counterparty.trim(),
    counterpartyIban: ((incoming ? t.debtorAccount?.iban : t.creditorAccount?.iban) ?? '').replace(/\s/g, ''),
  };
}

export async function fetchTransactions(accountId: string, since: string): Promise<NormalizedTransaction[]> {
  const res = await call<{ transactions: { booked: RawTx[] } }>(`/accounts/${accountId}/transactions/?date_from=${since}`);
  return res.transactions.booked.map(normalizeTransaction);
}
