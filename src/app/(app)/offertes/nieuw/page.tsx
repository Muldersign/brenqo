'use client';

import { useSearchParams } from 'next/navigation';
import { DocumentEditor } from '@/components/documents/document-editor';

export default function NewQuotePage() {
  const params = useSearchParams();
  return <DocumentEditor mode="quote" initial={{ customerId: params.get('klant') ?? '' }} />;
}
