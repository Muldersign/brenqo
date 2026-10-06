'use client';

import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/lib/store/ui';
import { useStore } from '@/lib/store';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmailComposer } from './email-composer';
import { fillTemplate } from '@/lib/domain/template';
import { formatDocNumber } from '@/lib/domain/numbering';
import { invoiceTotal } from '@/lib/domain/calc';
import { formatEUR } from '@/lib/domain/money';
import { formatDateLong } from '@/lib/domain/dates';
import { sendInvoiceNow } from '@/lib/services/send';

export function SendInvoiceModal() {
  const id = useUI((s) => s.sendInvoiceId);
  const setUI = useUI((s) => s.set);
  const inv = useStore((s) => s.invoices.find((x) => x.id === id));
  const org = useStore((s) => s.organizations.find((o) => o.id === inv?.organizationId));
  const customer = useStore((s) => s.customers.find((c) => c.id === inv?.customerId));
  const [mail, setMail] = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);

  const number = inv ? inv.number || (org ? formatDocNumber(org.invoicePrefix, org.nextInvoiceNumber) : '') : '';
  const resend = !!inv?.sentAt;

  useEffect(() => {
    if (!inv || !org) return;
    const vars = {
      naam: customer?.contactName || customer?.companyName || '',
      factuurnummer: number,
      bedrag: formatEUR(invoiceTotal(inv)),
      bedrijf: org.name,
      vervaldatum: formatDateLong(inv.dueDate),
    };
    setMail({ to: customer?.email ?? '', subject: fillTemplate(org.invoiceEmailSubject, vars), body: fillTemplate(org.invoiceEmailBody, vars) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!inv || !org) return null;

  async function send() {
    if (!inv || !org) return;
    if (!/\S+@\S+\.\S+/.test(mail.to)) {
      toast.error('Vul een geldig e-mailadres in');
      return;
    }
    setSending(true);
    const result = await sendInvoiceNow(inv.id, mail);
    setSending(false);
    if (!result.delivered) {
      toast.error('Versturen lukte niet', { description: result.error ?? 'Probeer het zo nog eens.' });
      return;
    }
    setUI({ sendInvoiceId: null });
    toast.success(`Factuur ${result.number} is verstuurd`, {
      description: `Naar ${mail.to}${result.demo ? ' (demo: e-mail staat in het verzendlog)' : ''}. We laten het weten zodra hij bekeken of betaald is.`,
    });
  }

  return (
    <Modal
      open={!!id}
      onOpenChange={(o) => !o && setUI({ sendInvoiceId: null })}
      title={resend ? `Factuur ${number} opnieuw versturen` : `Factuur ${number} versturen`}
      description={`${customer?.companyName} · ${formatEUR(invoiceTotal(inv))}`}
      icon={<Send />}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => setUI({ sendInvoiceId: null })}>Annuleren</Button>
          <Button onClick={send} loading={sending}><Send /> {resend ? 'Opnieuw versturen' : 'Factuur versturen'}</Button>
        </>
      }
    >
      <EmailComposer
        {...mail}
        onChange={(p) => setMail((m) => ({ ...m, ...p }))}
        attachment={`Factuur ${number}.pdf`}
        buttonLabel={org.payments.payButtonInEmail ? `Betaal ${formatEUR(invoiceTotal(inv))}` : 'Bekijk factuur'}
        accent={org.accentColor}
      />
    </Modal>
  );
}
