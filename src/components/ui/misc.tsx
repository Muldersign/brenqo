'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useInView } from 'motion/react';
import { Tooltip as RTooltip, Checkbox as RCheckbox } from 'radix-ui';
import { Check, Minus, Search } from 'lucide-react';
import { cn, initials as toInitials } from '@/lib/utils';
import { formatEUR } from '@/lib/domain/money';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function EmptyState({
  icon, title, description, action, className, compact,
}: { icon: React.ReactNode; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-6 py-10' : 'px-6 py-16 sm:py-20', className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 -m-3 rounded-[28px] bg-gradient-to-b from-brand-100/70 to-transparent blur-md" />
        <div className="relative grid size-16 place-items-center rounded-[20px] border border-line bg-surface text-brand-600 shadow-raised [&_svg]:size-7">
          {icon}
        </div>
      </div>
      <h3 className="font-display text-[17px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const avatarColors = [
  'from-[#8c7ff8] to-[#5b4bf5]', 'from-[#34d399] to-[#0f8a4b]', 'from-[#fbbf24] to-[#d97706]', 'from-[#60a5fa] to-[#1d58c4]',
  'from-[#f472b6] to-[#be185d]', 'from-[#a78bfa] to-[#6d28d9]', 'from-[#2dd4bf] to-[#0f766e]', 'from-[#fb923c] to-[#c2410c]',
];

export function Avatar({ name, size = 36, className, src }: { name: string; size?: number; className?: string; src?: string }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn('shrink-0 rounded-[30%] object-cover', className)} style={{ width: size, height: size }} />;
  }
  return (
    <div
      className={cn('grid shrink-0 place-items-center rounded-[30%] bg-gradient-to-br font-display font-semibold text-white', avatarColors[hash % avatarColors.length], className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      aria-hidden
    >
      {toInitials(name)}
    </div>
  );
}

/** Counts up to `value` the first time it scrolls into view. */
export function AnimatedNumber({ value, format = (n) => formatEUR(n, { round: true }), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(value);
  const first = useRef(true);
  useEffect(() => {
    if (!inView) return;
    const from = first.current ? 0 : display;
    first.current = false;
    const controls = animate(from, value, { duration: 0.9, ease: [0.2, 0.8, 0.2, 1], onUpdate: setDisplay });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView]);
  return <span ref={ref} className={cn('tabular', className)}>{format(display)}</span>;
}

export function Segmented<T extends string>({
  value, onChange, options, className, size = 'md',
}: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; count?: number }[]; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[12px] bg-[#ededf2] p-1 scrollbar-none', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-[9px] font-medium transition-all',
              size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
              active ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)]' : 'text-muted hover:text-ink-2',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn('tabular rounded-full px-1.5 text-[11px]', active ? 'bg-brand-50 text-brand-700' : 'bg-black/[0.05] text-muted')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PageHeader({
  title, description, actions, eyebrow, className,
}: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-[13px] font-medium text-muted">{eyebrow}</div>}
        <h1 className="font-display text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 text-[14.5px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Progress({ value, className, tone = 'brand' }: { value: number; className?: string; tone?: 'brand' | 'success' | 'warning' | 'danger' }) {
  const color = { brand: 'bg-brand-500', success: 'bg-success-500', warning: 'bg-warning-500', danger: 'bg-danger-500' }[tone];
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[#ececf1]', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RTooltip.Provider delayDuration={250}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content side={side} sideOffset={6} className="z-[60] rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-medium text-white shadow-pop">
            {content}
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}

export function Checkbox({ checked, onCheckedChange, className, ...rest }: { checked: boolean | 'indeterminate'; onCheckedChange: (v: boolean) => void; className?: string; 'aria-label'?: string }) {
  return (
    <RCheckbox.Root
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'grid size-[18px] shrink-0 place-items-center rounded-[6px] border border-line-strong bg-surface transition',
        'data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600 data-[state=indeterminate]:border-brand-600 data-[state=indeterminate]:bg-brand-600',
        className,
      )}
      {...rest}
    >
      <RCheckbox.Indicator className="text-white">
        {checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );
}

export function SearchField({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[12px] border border-line-strong bg-surface pl-9 pr-3 text-ink shadow-[0_1px_1px_rgba(0,0,0,0.02)] outline-none transition placeholder:text-faint focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
      />
    </div>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-surface px-1 font-sans text-[11px] font-medium text-muted', className)}>{children}</kbd>;
}

export function IconTile({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'; className?: string }) {
  const t = {
    neutral: 'bg-subtle text-ink-2 ring-line',
    brand: 'bg-brand-50 text-brand-600 ring-brand-100',
    success: 'bg-success-50 text-success-600 ring-success-100',
    warning: 'bg-warning-50 text-warning-600 ring-warning-100',
    danger: 'bg-danger-50 text-danger-600 ring-danger-100',
    info: 'bg-info-50 text-info-700 ring-info-100',
  }[tone];
  return <div className={cn('grid size-9 shrink-0 place-items-center rounded-[11px] ring-1 ring-inset [&_svg]:size-[18px]', t, className)}>{children}</div>;
}

export function Amount({ value, className, sign, colored }: { value: number; className?: string; sign?: boolean; colored?: boolean }) {
  return (
    <span className={cn('tabular whitespace-nowrap', colored && value > 0 && 'text-success-600', colored && value < 0 && 'text-ink', className)}>
      {formatEUR(value, { sign })}
    </span>
  );
}
