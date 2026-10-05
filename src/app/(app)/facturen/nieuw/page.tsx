'use client';

import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { DocumentEditor } from '@/components/documents/document-editor';
import { uid } from '@/lib/utils';

export default function NewInvoicePage() {
  const params = useSearchParams();
  const customerId = params.get('klant') ?? '';
  const productId = params.get('product');
  const product = useStore((s) => s.products.find((p) => p.id === productId));
  return (
    <DocumentEditor
      mode="invoice"
      initial={{
        customerId,
        ...(product ? { lines: [{ id: uid('ln'), description: product.name, quantity: 1, unit: product.unit, unitPrice: product.price, vatRate: product.vatRate, discountPct: 0, productId: product.id }] } : {}),
      }}
    />
  );
}
