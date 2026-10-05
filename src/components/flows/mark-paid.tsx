'use client';

import { useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/lib/store/ui';
import { useStore } from '@/lib/store';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { amountDue } from '@/lib/domain/calc';
import { formatEUR, parseAmount } from '@/lib/domain/money';
import { todayISO } from '@/lib/domain/dates';
import type { PaymentMethod } from '@/lib/types';

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  bank: 'Bankoverschrijving', ideal: 'iDEAL', bancontact: 'Bancontact', creditcard: 'Creditcard', cash: 'Contant', other: 'Anders',
};

export function MarkPaidModal() {
  const id = useUI((s) => s.markPaidId);
  const setUI = useUI((s) => s.set);
  const inv = useStore((s) => s.invoices.find((x) => x.id === id));
  const registerPayment = useStore((s) => s.registerPayment);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('bank');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!inv) return;
    setDate(todayISO());
    setAmount(amountDue(inv).toFixed(2).replace('.', ','));
    setMethod('bank');
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!inv) return null;
  const due = amountDue(inv);
  const value = parseAmount(amount);
  const partial = value > 0 && value < due - 0.004;

  return (
    <Modal
      open={!!id}
      onOpenChange={(o) => !o && setUI({ markPaidId: null })}
      title="Markeer als betaald"
      description={`Factuur ${inv.number} · nog te ontvangen ${formatEUR(due)}`}
      icon={<CircleCheck />}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => setUI({ markPaidId: null })}>Annuleren</Button>
          <Button
            variant="success"
            disabled={value <= 0}
            onClick={() => {
              registerPayment(inv.id, { date, amount: value, method, note, source: 'manual' });
              setUI({ markPaidId: null });
              toast.success(partial ? `Deelbetaling van ${formatEUR(value)} opgeslagen` : `Factuur ${inv.number} staat op betaald`, {
                description: partial ? `Er staat nog ${formatEUR(due - value)} open.` : 'Herinneringen voor deze factuur zijn automatisch gestopt.',
              });
            }}
          >
            {partial ? 'Deelbetaling opslaan' : 'Markeer betaald'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Betaaldatum"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Bedrag"><Input prefix="€" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        </div>
        <Field label="Betaalmethode">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Notitie" optional><Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[72px]" placeholder="Bijvoorbeeld: contant ontvangen op de beurs" /></Field>
        {partial && <p className="rounded-xl bg-warning-50 px-3.5 py-2.5 text-[13px] text-warning-700">Dit is minder dan het openstaande bedrag. De factuur krijgt de status “Deels betaald”.</p>}
      </div>
    </Modal>
  );
}
