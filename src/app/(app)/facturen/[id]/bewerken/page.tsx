'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FileX } from 'lucide-react';
import { useStore } from '@/lib/store';
import { DocumentEditor } from '@/components/documents/document-editor';
import { EmptyState } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const inv = useStore((s) => s.invoices.find((x) => x.id === id && x.organizationId === s.activeOrgId));
  if (!inv) return <EmptyState icon={<FileX />} title="Factuur niet gevonden" action={<Button asChild><Link href="/facturen">Naar facturen</Link></Button>} />;
  if (inv.state !== 'draft') {
    return (
      <EmptyState
        icon={<FileX />}
        title="Deze factuur is al verstuurd"
        description="Een verstuurde factuur pas je niet meer aan. Maak een creditfactuur en stuur een nieuwe, dan blijft je administratie kloppen."
        action={<Button asChild><Link href={`/facturen/${inv.id}`}>Terug naar factuur</Link></Button>}
      />
    );
  }
  return <DocumentEditor mode="invoice" initial={{ id: inv.id, customerId: inv.customerId, issueDate: inv.issueDate, dueDate: inv.dueDate, reference: inv.reference, lines: inv.lines, note: inv.note, number: inv.number }} />;
}
