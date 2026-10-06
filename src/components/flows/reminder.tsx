'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/lib/store/ui';
import { useStore } from '@/lib/store';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmailComposer } from './email-composer';
import { fillTemplate } from '@/lib/domain/template';
import { amountDue } from '@/lib/domain/calc';
import { formatEUR } from '@/lib/domain/money';
import { formatDateLong } from '@/lib/domain/dates';
import { sendReminderNow } from '@/lib/services/send';

export function ReminderModal() {
  const id = useUI((s) => s.reminderId);
  const setUI = useUI((s) => s.set);
  const inv = useStore((s) => s.invoices.find((x) => x.id === id));
  const org = useStore((s) => s.organizations.find((o) => o.id === inv?.organizationId));
  const customer = useStore((s) => s.customers.find((c) => c.id === inv?.customerId));
  const [mail, setMail] = useState({ to: '', subject: '', body: '' });

  const sentIds = new Set(inv?.remindersSent.map((r) => r.stepId));
  const step = org?.reminders.steps.find((s) => !sentIds.has(s.id)) ?? org?.reminders.steps.at(-1);

  useEffect(() => {
    if (!inv || !org || !step) return;
    const vars = { naam: customer?.contactName || customer?.companyName || '', factuurnummer: inv.number, bedrag: formatEUR(amountDue(inv)), bedrijf: org.name, vervaldatum: formatDateLong(inv.dueDate) };
    setMail({ to: customer?.email ?? '', subject: fillTemplate(step.subject, vars), body: fillTemplate(step.body, vars) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!inv || !org || !step) return null;

  return (
    <Modal
      open={!!id}
      onOpenChange={(o) => !o && setUI({ reminderId: null })}
      title={`${step.label} sturen`}
      description={`Factuur ${inv.number} · ${customer?.companyName} · nog open ${formatEUR(amountDue(inv))}`}
      icon={<BellRing />}
      footer={
        <>
          <Button variant="outline" onClick={() => setUI({ reminderId: null })}>Annuleren</Button>
          <Button onClick={async () => {
            const result = await sendReminderNow(inv.id, mail);
            if (!result.delivered) { toast.error('Versturen lukte niet', { description: result.error }); return; }
            setUI({ reminderId: null });
            toast.success('Herinnering verstuurd', { description: `${customer?.companyName} ontvangt een mail met betaallink.` });
          }}><BellRing /> Herinnering versturen</Button>
        </>
      }
    >
      <EmailComposer {...mail} onChange={(p) => setMail((m) => ({ ...m, ...p }))} attachment={`Factuur ${inv.number}.pdf`} buttonLabel="Betaal factuur" accent={org.accentColor} />
    </Modal>
  );
}
