'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronRight, LoaderCircle, Lock } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PublicShell } from '@/components/public-shell';
import { Button } from '@/components/ui/button';
import { amountDue } from '@/lib/domain/calc';
import { formatEUR } from '@/lib/domain/money';
import { todayISO } from '@/lib/domain/dates';
import { cn } from '@/lib/utils';

const BANKS = ['ABN AMRO', 'ASN Bank', 'bunq', 'ING', 'Knab', 'Rabobank', 'Revolut', 'SNS', 'Triodos Bank'];

/**
 * Demo checkout. Stands in for the payment provider's hosted page; finishing it
 * does what the Mollie webhook does in production (see /api/webhooks/mollie).
 */
export default function DemoCheckoutPage() {
  return <PublicShell><Checkout /></PublicShell>;
}

function Checkout() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const inv = useStore((s) => s.invoices.find((i) => i.publicToken === token));
  const org = useStore((s) => s.organizations.find((o) => o.id === inv?.organizationId));
  const registerPayment = useStore((s) => s.registerPayment);
  const [method, setMethod] = useState<'ideal' | 'bancontact' | 'creditcard' | null>(null);
  const [bank, setBank] = useState<string | null>(null);
  const [step, setStep] = useState<'method' | 'processing' | 'done'>('method');

  if (!inv || !org) return <div className="pt-20 text-center text-muted">Betaling niet gevonden.</div>;
  const due = amountDue(inv);

  function complete() {
    if (!inv || !org) return;
    setStep('processing');
    setTimeout(() => {
      // In production this happens server-side when the provider calls our webhook.
      if (org.automations.processOnlinePayments) {
        registerPayment(inv.id, { date: todayISO(), amount: due, method: method === 'creditcard' ? 'creditcard' : method === 'bancontact' ? 'bancontact' : 'ideal', source: 'online', note: bank ? `iDEAL via ${bank}` : '' });
      }
      setStep('done');
      setTimeout(() => router.push(`/f/${token}?betaald=1`), 900);
    }, 1600);
  }

  return (
    <div className="animate-fade-in pt-4">
      <button onClick={() => router.back()} className="mb-6 flex items-center gap-1 text-[13.5px] font-medium text-muted hover:text-ink"><ArrowLeft className="size-4" /> Terug naar factuur</button>
      <div className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <div className="text-[13px] text-muted">{org.name}</div>
            <div className="font-display text-[15px] font-semibold">Factuur {inv.number}</div>
          </div>
          <div className="tabular font-display text-[24px] font-bold">{formatEUR(due)}</div>
        </div>
        <div className="p-6">
          {step === 'method' && (
            <>
              <div className="mb-3 text-[13px] font-semibold text-ink-2">Kies je betaalmethode</div>
              <div className="space-y-2">
                {([['ideal', 'iDEAL', org.payments.methods.ideal], ['bancontact', 'Bancontact', org.payments.methods.bancontact], ['creditcard', 'Creditcard', org.payments.methods.creditcard]] as const).filter(([, , on]) => on).map(([k, label]) => (
                  <button key={k} onClick={() => { setMethod(k); setBank(null); }} className={cn('flex w-full items-center gap-3 rounded-2xl p-4 text-left ring-1 transition', method === k ? 'bg-brand-50/60 ring-2 ring-brand-400' : 'ring-line hover:bg-subtle')}>
                    <span className="grid h-8 w-12 place-items-center rounded-lg bg-surface text-[11px] font-bold ring-1 ring-line">{label === 'iDEAL' ? 'iD' : label.slice(0, 2)}</span>
                    <span className="flex-1 font-medium">{label}</span>
                    {method === k && <Check className="size-4 text-brand-600" />}
                  </button>
                ))}
              </div>
              {method === 'ideal' && (
                <div className="mt-5">
                  <div className="mb-2 text-[13px] font-semibold text-ink-2">Kies je bank</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {BANKS.map((b) => <button key={b} onClick={() => setBank(b)} className={cn('flex items-center justify-between rounded-xl px-3 py-2.5 text-[13.5px] ring-1 transition', bank === b ? 'bg-brand-50/60 font-medium ring-2 ring-brand-400' : 'ring-line hover:bg-subtle')}>{b}<ChevronRight className="size-3.5 text-faint" /></button>)}
                  </div>
                </div>
              )}
              <Button size="lg" className="mt-6 h-13 w-full" disabled={!method || (method === 'ideal' && !bank)} onClick={complete}><Lock /> Betaal {formatEUR(due)}</Button>
              <p className="mt-3 text-center text-[12px] text-faint">Demo-betaalomgeving: er wordt geen echt geld afgeschreven.</p>
            </>
          )}
          {step === 'processing' && (
            <div className="flex flex-col items-center py-12 text-center">
              <LoaderCircle className="size-9 animate-spin text-brand-500" />
              <div className="mt-4 font-semibold">Betaling wordt verwerkt…</div>
              <div className="mt-1 text-[13px] text-muted">{bank ? `Je bent bij ${bank}` : 'Een moment geduld'}</div>
            </div>
          )}
          {step === 'done' && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="grid size-16 animate-pop place-items-center rounded-full bg-success-500 text-white"><Check className="size-8" strokeWidth={3} /></div>
              <div className="mt-4 font-display text-[18px] font-semibold">Betaald</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
