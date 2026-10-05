import { cn } from '@/lib/utils';
import type { InvoiceStatus, QuoteStatus } from '@/lib/domain/status';
import { invoiceStatusLabel, quoteStatusLabel } from '@/lib/domain/status';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const tones: Record<Tone, string> = {
  neutral: 'bg-[#f1f1f4] text-ink-2 ring-[#e4e4ea]',
  muted: 'bg-subtle text-muted ring-line',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warning: 'bg-warning-50 text-warning-700 ring-warning-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
  info: 'bg-info-50 text-info-700 ring-info-100',
};

const dots: Record<Tone, string> = {
  neutral: 'bg-[#9a9aa6]',
  muted: 'bg-faint',
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
};

export function Badge({ tone = 'neutral', dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  );
}

export const invoiceStatusTone: Record<InvoiceStatus, Tone> = {
  draft: 'muted',
  sent: 'info',
  viewed: 'brand',
  open: 'neutral',
  paid: 'success',
  partial: 'warning',
  overdue: 'danger',
  credited: 'muted',
};

export function InvoiceStatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  return <Badge tone={invoiceStatusTone[status]} dot className={className}>{invoiceStatusLabel[status]}</Badge>;
}

const quoteTone: Record<QuoteStatus, Tone> = {
  draft: 'muted', sent: 'info', accepted: 'success', declined: 'danger', expired: 'warning', invoiced: 'brand',
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={quoteTone[status]} dot>{quoteStatusLabel[status]}</Badge>;
}
