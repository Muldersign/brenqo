import { cn } from '@/lib/utils';
import type { InvoiceStatus, QuoteStatus } from '@/lib/domain/status';
import { invoiceStatusLabel, quoteStatusLabel } from '@/lib/domain/status';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'solid' | 'outline';

const tones: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-2 ring-transparent',
  muted: 'bg-transparent text-muted ring-line',
  brand: 'bg-canvas text-ink ring-transparent',
  success: 'bg-ink-2 text-[#fafafa] ring-transparent',
  warning: 'bg-canvas text-ink ring-transparent',
  danger: 'bg-danger-50 text-danger-600 ring-danger-100',
  info: 'bg-canvas text-ink-2 ring-transparent',
  solid: 'bg-ink-2 text-[#fafafa] ring-transparent',
  outline: 'bg-transparent text-ink ring-line',
};

const dots: Record<Tone, string> = {
  neutral: 'bg-faint',
  muted: 'bg-faint',
  brand: 'bg-ink',
  success: 'bg-[#fafafa]',
  warning: 'bg-[#737373]',
  danger: 'bg-danger-500',
  info: 'bg-muted',
  solid: 'bg-[#fafafa]',
  outline: 'bg-faint',
};

export function Badge({ tone = 'neutral', dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[12px] font-medium ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  );
}

export const invoiceStatusTone: Record<InvoiceStatus, Tone> = {
  draft: 'outline',
  sent: 'neutral',
  viewed: 'neutral',
  open: 'neutral',
  paid: 'solid',
  partial: 'neutral',
  overdue: 'danger',
  credited: 'muted',
};

export function InvoiceStatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  return <Badge tone={invoiceStatusTone[status]} dot className={className}>{invoiceStatusLabel[status]}</Badge>;
}

const quoteTone: Record<QuoteStatus, Tone> = {
  draft: 'outline', sent: 'neutral', accepted: 'solid', declined: 'muted', expired: 'muted', invoiced: 'solid',
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={quoteTone[status]} dot>{quoteStatusLabel[status]}</Badge>;
}
