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
import { documentTotals } from '@/lib/domain/calc';
import { formatEUR } from '@/lib/domain/money';
import { sendQuoteNow } from '@/lib/services/send';

export function SendQuoteModal() {
  const id = useUI((s) => s.sendQuoteId);
  const setUI = useUI((s) => s.set);
  const quote = useStore((s) => s.quotes.find((x) => x.id === id));
  const org = useStore((s) => s.organizations.find((o) => o.id === quote?.organizationId));
  const customer = useStore((s) => s.customers.find((c) => c.id === quote?.customerId));
  const [mail, setMail] = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!quote || !org) return;
    const vars = { naam: customer?.contactName || customer?.companyName || '', offertenummer: quote.number, bedrag: formatEUR(documentTotals(quote.lines).total), bedrijf: org.name };
    setMail({ to: customer?.email ?? '', subject: fillTemplate(org.quoteEmailSubject, vars), body: fillTemplate(org.quoteEmailBody, vars) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!quote || !org) return null;

  return (
    <Modal
      open={!!id}
      onOpenChange={(o) => !o && setUI({ sendQuoteId: null })}
      title={`Offerte ${quote.number} versturen`}
      description={`${customer?.companyName} · ${formatEUR(documentTotals(quote.lines).total)}`}
      icon={<Send />}
      footer={
        <>
          <Button variant="outline" onClick={() => setUI({ sendQuoteId: null })}>Annuleren</Button>
          <Button
            loading={sending}
            onClick={async () => {
              setSending(true);
              const result = await sendQuoteNow(quote.id, mail);
              setSending(false);
              if (!result.delivered) { toast.error('Versturen lukte niet', { description: result.error }); return; }
              setUI({ sendQuoteId: null });
              toast.success(`Offerte ${quote.number} is verstuurd`, { description: 'Je krijgt een melding zodra de klant reageert.' });
            }}
          >
            <Send /> Offerte versturen
          </Button>
        </>
      }
    >
      <EmailComposer {...mail} onChange={(p) => setMail((m) => ({ ...m, ...p }))} attachment={`Offerte ${quote.number}.pdf`} buttonLabel="Bekijk en accepteer" accent={org.accentColor} />
    </Modal>
  );
}
