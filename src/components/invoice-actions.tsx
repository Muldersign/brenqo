'use client';

import { useRouter } from 'next/navigation';
import { Ellipsis, Eye, Send, Download, CircleCheck, FileX, Copy, BellRing, Link2, Pencil, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { useStore, type InvoiceRow } from '@/lib/store';
import { useUI } from '@/lib/store/ui';
import { downloadPdf, invoiceToDoc } from '@/lib/pdf/download';
import { publicUrl } from '@/lib/services/email';
import { cn } from '@/lib/utils';

export function useInvoiceCommands() {
  const router = useRouter();
  const setUI = useUI((s) => s.set);
  const createCreditNote = useStore((s) => s.createCreditNote);
  const duplicateInvoice = useStore((s) => s.duplicateInvoice);
  const deleteInvoices = useStore((s) => s.deleteInvoices);
  return {
    view: (id: string) => router.push(`/facturen/${id}`),
    send: (id: string) => setUI({ sendInvoiceId: id }),
    markPaid: (id: string) => setUI({ markPaidId: id }),
    remind: (id: string) => setUI({ reminderId: id }),
    download: async (row: InvoiceRow) => {
      const s = useStore.getState();
      const org = s.organizations.find((o) => o.id === row.inv.organizationId)!;
      const t = toast.loading('PDF wordt gemaakt…');
      try {
        await downloadPdf(org, row.customer, invoiceToDoc(row.inv));
        toast.success('PDF gedownload', { id: t });
      } catch (e) {
        console.error(e);
        toast.error('PDF maken lukte niet', { id: t });
      }
    },
    credit: (id: string) => {
      const cid = createCreditNote(id);
      const num = useStore.getState().invoices.find((x) => x.id === cid)?.number;
      toast.success(`Creditfactuur ${num} is gemaakt`, { description: 'De oorspronkelijke factuur staat nu op gecrediteerd.' });
      router.push(`/facturen/${cid}`);
    },
    duplicate: (id: string) => {
      const nid = duplicateInvoice(id);
      toast.success('Kopie gemaakt als concept');
      router.push(`/facturen/${nid}/bewerken`);
    },
    copyLink: (token: string) => {
      navigator.clipboard?.writeText(publicUrl(`/f/${token}`));
      toast.success('Link gekopieerd', { description: 'Je klant kan de factuur hiermee bekijken en betalen.' });
    },
    remove: (id: string) => {
      if (deleteInvoices([id])) toast.success('Concept verwijderd');
    },
    edit: (id: string) => router.push(`/facturen/${id}/bewerken`),
  };
}

export function InvoiceRowMenu({ row, className }: { row: InvoiceRow; className?: string }) {
  const c = useInvoiceCommands();
  const { inv, status } = row;
  const draft = status === 'draft';
  const open = ['sent', 'viewed', 'open', 'partial', 'overdue'].includes(status);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button onClick={(e) => e.stopPropagation()} className={cn('grid size-8 place-items-center rounded-lg text-muted transition hover:bg-black/5 hover:text-ink', className)} aria-label="Acties">
          <Ellipsis className="size-[18px]" />
        </button>
      </MenuTrigger>
      <MenuContent onClick={(e) => e.stopPropagation()}>
        <MenuItem icon={<Eye />} onSelect={() => c.view(inv.id)}>Bekijk</MenuItem>
        {draft && <MenuItem icon={<Pencil />} onSelect={() => c.edit(inv.id)}>Bewerken</MenuItem>}
        <MenuItem icon={<Send />} onSelect={() => c.send(inv.id)}>{inv.sentAt ? 'Verstuur opnieuw' : 'Versturen'}</MenuItem>
        <MenuItem icon={<Download />} onSelect={() => c.download(row)}>Download PDF</MenuItem>
        {!draft && <MenuItem icon={<Link2 />} onSelect={() => c.copyLink(inv.publicToken)}>Kopieer betaallink</MenuItem>}
        {open && <MenuItem icon={<CircleCheck />} onSelect={() => c.markPaid(inv.id)}>Markeer betaald</MenuItem>}
        {status === 'overdue' && <MenuItem icon={<BellRing />} onSelect={() => c.remind(inv.id)}>Herinnering sturen</MenuItem>}
        <MenuSeparator />
        <MenuItem icon={<Copy />} onSelect={() => c.duplicate(inv.id)}>Dupliceren</MenuItem>
        {!draft && inv.kind === 'invoice' && status !== 'credited' && <MenuItem icon={<FileX />} onSelect={() => c.credit(inv.id)}>Maak creditfactuur</MenuItem>}
        {draft && <MenuItem icon={<Trash />} danger onSelect={() => c.remove(inv.id)}>Verwijder concept</MenuItem>}
      </MenuContent>
    </Menu>
  );
}
