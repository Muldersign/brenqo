'use client';

import type { Customer, Organization } from '../types';
import type { DocumentData } from '@/components/documents/invoice-document';

export { invoiceToDocData as invoiceToDoc, quoteToDocData as quoteToDoc } from './doc-data';

/** Render the PDF in the browser (lazy-loaded, ~1 MB) and download it. */
export async function downloadPdf(org: Organization, customer: Customer | undefined, doc: DocumentData) {
  const [{ pdf }, { InvoicePdf }] = await Promise.all([import('@react-pdf/renderer'), import('./invoice-pdf')]);
  const blob = await pdf(<InvoicePdf org={org} customer={customer} doc={doc} />).toBlob();
  await saveFile(`${doc.kind === 'quote' ? 'Offerte' : doc.kind === 'credit' ? 'Creditfactuur' : 'Factuur'} ${doc.number || 'concept'} - ${org.name}.pdf`, blob);
}

interface DownloadsNamespace { save(req: { filename: string; data: Blob | string }): Promise<{ status: string }> }
type ClaudeHost = { use?: (name: 'downloads') => Promise<DownloadsNamespace | null> };

/**
 * Hand a generated file to the user. Inside a claude.ai Artifact viewer
 * plain downloads are blocked, so we go through its `downloads` capability;
 * everywhere else a normal browser download.
 */
export async function saveFile(filename: string, data: Blob) {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    const downloads = await host.use('downloads');
    if (downloads) {
      try {
        await downloads.save({ filename, data });
      } catch (e) {
        if ((e as { code?: string })?.code !== 'declined') throw e;
      }
      return;
    }
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
