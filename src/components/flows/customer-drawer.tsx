'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useUI } from '@/lib/store/ui';
import { useOrg, useStore } from '@/lib/store';
import { Drawer } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, TextField } from '@/components/ui/input';
import { SwitchRow } from '@/components/ui/switch';
import type { Customer } from '@/lib/types';

type Form = Omit<Customer, 'id' | 'organizationId' | 'createdAt'>;

const empty = (term: number): Form => ({
  companyName: '', contactName: '', email: '', phone: '', address: '', postalCode: '', city: '', country: 'Nederland', kvk: '',
  vatNumber: '', iban: '', paymentTermDays: term, defaultInvoiceText: '', remindersEnabled: true, tags: [],
});

export function CustomerDrawer() {
  const { open, id } = useUI((s) => s.customerDrawer);
  const setUI = useUI((s) => s.set);
  const org = useOrg();
  const existing = useStore((s) => s.customers.find((c) => c.id === id));
  const saveCustomer = useStore((s) => s.saveCustomer);
  const router = useRouter();
  const [form, setForm] = useState<Form>(empty(org.paymentTermDays));

  useEffect(() => {
    if (!open) return;
    setForm(existing ? { ...existing } : empty(org.paymentTermDays));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const close = () => setUI({ customerDrawer: { open: false } });
  const association = org.kind === 'association';

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && close()}
      title={existing ? 'Klant bewerken' : association ? 'Nieuwe relatie' : 'Nieuwe klant'}
      description={existing ? existing.companyName : 'Alleen een naam is verplicht. De rest kun je later aanvullen.'}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={close}>Annuleren</Button>
          <Button
            className="flex-1"
            disabled={!form.companyName.trim()}
            onClick={() => {
              const cid = saveCustomer({ ...form, id: existing?.id });
              close();
              toast.success(existing ? 'Klant bijgewerkt' : `${form.companyName} is toegevoegd`);
              if (!existing) router.push(`/klanten/${cid}`);
            }}
          >
            {existing ? 'Opslaan' : 'Klant toevoegen'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TextField label={association ? 'Naam' : 'Bedrijfsnaam'} value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} autoFocus placeholder={association ? 'Bijvoorbeeld: Femke de Boer' : 'Bijvoorbeeld: De Leo Media'} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Contactpersoon" value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
          <TextField label="Telefoon" value={form.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" />
        </div>
        <TextField label="E-mailadres" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} hint="Hier sturen we facturen en herinneringen naartoe." />
        <div className="space-y-3 rounded-2xl bg-subtle p-4 ring-1 ring-line">
          <TextField label="Adres" value={form.address} onChange={(e) => set({ address: e.target.value })} />
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <TextField label="Postcode" value={form.postalCode} onChange={(e) => set({ postalCode: e.target.value.toUpperCase() })} />
            <TextField label="Plaats" value={form.city} onChange={(e) => set({ city: e.target.value })} />
          </div>
          <TextField label="Land" value={form.country} onChange={(e) => set({ country: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="KvK-nummer" optional value={form.kvk} onChange={(e) => set({ kvk: e.target.value })} />
          <TextField label="Btw-nummer" optional value={form.vatNumber} onChange={(e) => set({ vatNumber: e.target.value.toUpperCase() })} />
        </div>
        <TextField label="IBAN klant" optional value={form.iban} onChange={(e) => set({ iban: e.target.value.toUpperCase() })} hint="Helpt om betalingen automatisch te herkennen." />
        <Field label="Standaard betaaltermijn">
          <Input type="number" min={0} suffix="dagen" value={form.paymentTermDays} onChange={(e) => set({ paymentTermDays: Number(e.target.value) })} />
        </Field>
        <Field label="Standaard factuurtekst" optional>
          <Textarea value={form.defaultInvoiceText} onChange={(e) => set({ defaultInvoiceText: e.target.value })} className="min-h-[72px]" placeholder="Bijvoorbeeld: Vermeld bij betaling uw projectnummer." />
        </Field>
        {association && (
          <Field label="Labels" hint="Gebruik labels als Lid of Sponsor om snel groepen te factureren.">
            <Input value={form.tags.join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="Lid, Sponsor" />
          </Field>
        )}
        <div className="rounded-2xl ring-1 ring-line px-4">
          <SwitchRow title="Automatische herinneringen" description="Stuur deze klant automatisch een herinnering als een factuur verloopt." checked={form.remindersEnabled} onCheckedChange={(v) => set({ remindersEnabled: v })} />
        </div>
      </div>
    </Drawer>
  );
}
