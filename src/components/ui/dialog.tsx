'use client';

import { Dialog as RDialog } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({
  open, onOpenChange, title, description, children, footer, className, size = 'md', icon,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: React.ReactNode;
}) {
  const w = { sm: 'sm:max-w-[420px]', md: 'sm:max-w-[540px]', lg: 'sm:max-w-[720px]', xl: 'sm:max-w-[960px]' }[size];
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-[#17171c]/30 backdrop-blur-[3px] data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
        <RDialog.Content
          className={cn(
            'fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface shadow-pop outline-none',
            'inset-x-0 bottom-0 rounded-t-[24px] pb-safe sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px] sm:pb-0',
            'data-[state=open]:animate-[fade-in_0.25s_cubic-bezier(0.2,0.8,0.2,1)]',
            w,
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
          <div className="flex items-start gap-3.5 px-6 pb-2 pt-5 sm:pt-6">
            {icon && <div className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-ink [&_svg]:size-[18px]">{icon}</div>}
            <div className="min-w-0 flex-1">
              <RDialog.Title className="text-[18px] font-semibold tracking-[-0.02em] text-ink">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-1 text-[13.5px] leading-relaxed text-muted">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{typeof title === 'string' ? title : 'Venster'}</RDialog.Description>
              )}
            </div>
            <RDialog.Close className="-mr-2 -mt-1 grid size-9 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-ink" aria-label="Sluiten">
              <X className="size-[18px]" />
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export function Drawer({
  open, onOpenChange, title, description, children, footer, width = 480,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-[#17171c]/25 backdrop-blur-[2px]" />
        <RDialog.Content
          style={{ ['--w' as string]: `${width}px` }}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface shadow-pop outline-none sm:w-[var(--w)] sm:rounded-l-[24px] data-[state=open]:animate-[drawer-in_0.3s_cubic-bezier(0.2,0.8,0.2,1)]"
        >
          <div className="flex items-start gap-3 border-b border-line px-6 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <div className="min-w-0 flex-1">
              <RDialog.Title className="text-[18px] font-semibold tracking-[-0.02em]">{title}</RDialog.Title>
              <RDialog.Description className={description ? 'mt-1 text-[13.5px] text-muted' : 'sr-only'}>{description ?? 'Paneel'}</RDialog.Description>
            </div>
            <RDialog.Close className="-mr-2 grid size-9 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink" aria-label="Sluiten">
              <X className="size-[18px]" />
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex gap-2 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
