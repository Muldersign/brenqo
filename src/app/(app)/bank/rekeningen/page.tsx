'use client';

import { useState } from 'react';
import { Landmark, Plus, RefreshCw, ShieldCheck, Lock, Check, ChevronRight, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useBankAccounts, useStore, useTransactions } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Modal } from '@/components/ui/dialog';
import { formatEUR } from '@/lib/domain/money';
import { daysBetween, formatDateLong, relativeTime, todayISO } from '@/lib/domain/dates';
import { cn } from '@/lib/utils';

const BANKS = [
  ['ING', '#FF6200'], ['Rabobank', '#000099'], ['ABN AMRO', '#00857A'], ['bunq', '#1A1A1A'], ['Knab', '#00A9E0'],
  ['SNS', '#5F2F8F'], ['ASN Bank', '#00A65A'], ['Triodos', '#003B5C'], ['Revolut', '#191C1F'],
] as const;

export default function AccountsPage() {
  const accounts = useBankAccounts();
  const transactions = useTransactions();
  const addAccount = useStore((s) => s.addBankAccount);
  const syncBank = useStore((s) => s.syncBank);
  const [step, setStep] = useState<'closed' | 'choose' | 'redirect' | 'done'>('closed');
  const [bank, setBank] = useState<(typeof BANKS)[number] | null>(null);
  const today = todayISO();

  function connect(b: (typeof BANKS)[number]) {
    setBank(b);
    setStep('redirect');
    setTimeout(() => {
      addAccount({ bankName: b[0], name: `${b[0]} Zakelijk`, iban: `NL${Math.floor(10 + Math.random() * 89)}${b[0].slice(0, 4).toUpperCase().padEnd(4, 'X')}0${Math.floor(100000000 + Math.random() * 899999999)}` });
      setStep('done');
    }, 2200);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Bankrekeningen" description="Via een beveiligde PSD2-koppeling halen we je transacties automatisch op. Alleen lezen, nooit betalen." actions={<Button onClick={() => setStep('choose')}><Plus strokeWidth={2.5} /> Rekening koppelen</Button>} />
      {accounts.length === 0 ? (
        <Card><EmptyState icon={<Landmark />} title="Nog geen bank gekoppeld" description="Koppel je zakelijke rekening, dan zien we automatisch wanneer facturen betaald zijn." action={<Button size="lg" onClick={() => setStep('choose')}><Plus /> Bank koppelen</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => {
            const count = transactions.filter((t) => t.accountId === a.id).length;
            const consentDays = daysBetween(today, a.consentValidUntil);
            return (
              <Card key={a.id} className="overflow-hidden">
                <div className="relative overflow-hidden bg-ink p-5 text-[#fafafa]">
                                    <div className="relative flex items-center justify-between">
                    <span className="text-[14px] font-semibold">{a.bankName}</span>
                    <Landmark className="size-5 opacity-80" />
                  </div>
                  <div className="relative mt-6 text-[12.5px] opacity-75">{a.name}</div>
                  <div className="tabular relative font-display text-[28px] font-semibold tracking-[-0.02em]">{formatEUR(a.balance)}</div>
                  <div className="relative mt-1 font-mono text-[12.5px] tracking-wider opacity-80">{a.iban.replace(/(.{4})/g, '$1 ').trim()}</div>
                </div>
                <div className="space-y-2.5 p-5 text-[13px]">
                  <div className="flex justify-between"><span className="text-muted">Laatst bijgewerkt</span><span>{relativeTime(a.lastSyncAt)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Transacties</span><span>{count}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Toestemming geldig tot</span><span className={cn(consentDays < 14 && 'font-medium text-warning-700')}>{formatDateLong(a.consentValidUntil)}</span></div>
                  <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => { const n = syncBank(a.id); toast.success(n ? `${n} nieuwe transacties` : 'Up-to-date'); }}><RefreshCw /> Nu bijwerken</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-surface p-4 text-[13px] text-muted ring-1 ring-line">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success-600" />
        <p>Brenqo gebruikt een erkende PSD2-dienstverlener. Je logt in bij je eigen bank en geeft alleen <span className="font-medium text-ink-2">leestoegang</span>. Iedere 90 dagen vraagt je bank om de toestemming te verlengen; we herinneren je daar op tijd aan.</p>
      </div>

      <Modal open={step !== 'closed'} onOpenChange={(o) => !o && setStep('closed')} title={step === 'done' ? 'Bank gekoppeld' : 'Kies je bank'} description={step === 'choose' ? 'Je logt in bij je eigen bank. Wij krijgen alleen leestoegang.' : undefined} icon={<Landmark />} size="sm">
        {step === 'choose' && (
          <div className="grid gap-1.5">
            {BANKS.map((b) => (
              <button key={b[0]} onClick={() => connect(b)} className="flex items-center gap-3 rounded-[14px] p-2.5 text-left transition hover:bg-subtle">
                <span className="grid size-9 place-items-center rounded-[10px] text-[12px] font-semibold text-white" style={{ background: b[1] }}>{b[0].slice(0, 2)}</span>
                <span className="flex-1 text-[14.5px] font-medium">{b[0]}</span>
                <ChevronRight className="size-4 text-faint" />
              </button>
            ))}
          </div>
        )}
        {step === 'redirect' && bank && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white"><Lock className="size-5" /></span>
              <LoaderCircle className="size-5 animate-spin text-faint" />
              <span className="grid size-12 place-items-center rounded-2xl text-[14px] font-semibold text-white" style={{ background: bank[1] }}>{bank[0].slice(0, 2)}</span>
            </div>
            <div className="mt-5 font-semibold">Veilig verbinden met {bank[0]}…</div>
            <p className="mt-1 text-[13px] text-muted">In het echt log je nu in bij je bank-app en geef je toestemming.</p>
          </div>
        )}
        {step === 'done' && bank && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="grid size-16 animate-pop place-items-center rounded-full bg-success-500 text-white"><Check className="size-8" strokeWidth={3} /></div>
            <div className="mt-5 font-display text-[18px] font-semibold">{bank[0]} is gekoppeld</div>
            <p className="mt-1 text-[13.5px] text-muted">Transacties komen vanaf nu automatisch binnen en worden gekoppeld aan je facturen.</p>
            <Button className="mt-6 w-full" onClick={() => setStep('closed')}>Klaar</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
