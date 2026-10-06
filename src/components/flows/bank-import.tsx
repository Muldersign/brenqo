'use client';

import { useRef, useState } from 'react';
import { FileUp, Upload, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/input';
import { useBankAccounts, useStore } from '@/lib/store';
import { parseBankStatement, type ImportResult } from '@/lib/domain/bank-import';
import { formatEUR } from '@/lib/domain/money';
import { formatDate } from '@/lib/domain/dates';
import { pluralize } from '@/lib/utils';

/** Import a bank statement (CSV from ING, Rabobank, ABN AMRO, or CAMT.053). Works without any bank connection. */
export function BankImport({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const accounts = useBankAccounts();
  const addBankAccount = useStore((s) => s.addBankAccount);
  const importTransactions = useStore((s) => s.importTransactions);
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [accountId, setAccountId] = useState('');

  async function read(file?: File) {
    if (!file) return;
    try {
      const text = await file.text();
      const r = parseBankStatement(text, file.name);
      if (!r.transactions.length) throw new Error('Er staan geen transacties in dit bestand.');
      setResult(r);
      setFileName(file.name);
      const iban = r.accountIbans[0]?.replace(/\s/g, '');
      const match = accounts.find((a) => a.iban.replace(/\s/g, '') === iban);
      setAccountId(match?.id ?? (iban ? `new:${iban}` : accounts[0]?.id ?? 'new:'));
    } catch (e) {
      toast.error('Dit bestand kan ik niet lezen', { description: e instanceof Error ? e.message : undefined });
    }
  }

  function doImport() {
    if (!result) return;
    let id = accountId;
    if (id.startsWith('new:')) {
      const iban = id.slice(4);
      const bank = /INGB/.test(iban) ? 'ING' : /RABO/.test(iban) ? 'Rabobank' : /ABNA/.test(iban) ? 'ABN AMRO' : /BUNQ/.test(iban) ? 'bunq' : /KNAB/.test(iban) ? 'Knab' : result.format === 'CSV' ? 'Bank' : result.format;
      id = addBankAccount({ bankName: bank, name: `${bank} rekening`, iban });
      useStore.setState((s) => ({ bankAccounts: s.bankAccounts.map((a) => (a.id === id ? { ...a, provider: 'import' as const } : a)) }));
    }
    const r = importTransactions(id, result.transactions);
    toast.success(r.added ? `${pluralize(r.added, 'transactie', 'transacties')} geïmporteerd` : 'Alles uit dit bestand stond er al in', {
      description: r.matched ? `${pluralize(r.matched, 'betaling is', 'betalingen zijn')} meteen aan een factuur gekoppeld.` : r.added ? 'Kijk hieronder welke je nog moet verwerken.' : undefined,
    });
    setResult(null);
    onOpenChange(false);
  }

  const total = result?.transactions.reduce((s, t) => s + t.amount, 0) ?? 0;
  const dates = result?.transactions.map((t) => t.date).sort() ?? [];

  return (
    <Modal open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setResult(null); }} title="Afschrift importeren" icon={<FileUp />} size="sm"
      description="Download een afschrift in je bank-app of internetbankieren (CSV of CAMT.053) en zet het hier neer. Dubbele transacties worden overgeslagen."
      footer={result ? <><Button variant="outline" onClick={() => setResult(null)}>Ander bestand</Button><Button onClick={doImport}><Check /> Importeren</Button></> : undefined}>
      <input ref={fileRef} type="file" accept=".csv,.txt,.xml,.tab,text/csv,text/xml,application/xml" className="hidden" onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} />
      {!result ? (
        <button onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); read(e.dataTransfer.files[0]); }}
          className="flex w-full flex-col items-center gap-3 rounded-[24px] border border-dashed border-[#d4d4d4] px-6 py-10 text-center transition hover:border-ink">
          <span className="grid size-12 place-items-center rounded-full bg-canvas"><Upload className="size-5" /></span>
          <span className="font-medium">Kies een bestand</span>
          <span className="text-[13px] text-muted">ING, Rabobank, ABN AMRO (CSV/TXT) of CAMT.053 (XML)</span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[18px] bg-canvas p-4">
            <div className="text-[13px] text-muted">{fileName} · {result.format}</div>
            <div className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">{pluralize(result.transactions.length, 'transactie', 'transacties')}</div>
            <div className="text-[13px] text-muted">{dates.length ? `${formatDate(dates[0])} t/m ${formatDate(dates[dates.length - 1])}` : ''} · saldo mutaties {formatEUR(total, { sign: true })}</div>
          </div>
          <Field label="Op welke rekening?">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.iban}</option>)}
              {result.accountIbans.filter((i) => !accounts.some((a) => a.iban.replace(/\s/g, '') === i.replace(/\s/g, ''))).map((i) => <option key={i} value={`new:${i}`}>Nieuwe rekening {i}</option>)}
              {!result.accountIbans.length && <option value="new:">Nieuwe rekening</option>}
            </Select>
          </Field>
        </div>
      )}
    </Modal>
  );
}
