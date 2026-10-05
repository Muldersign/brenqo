import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full rounded-[12px] border border-line-strong bg-surface px-3.5 text-ink placeholder:text-faint shadow-[0_1px_1px_rgba(0,0,0,0.02)] transition outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-subtle disabled:text-muted';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string }>(
  function Input({ className, prefix, suffix, ...props }, ref) {
    if (prefix || suffix) {
      return (
        <div className={cn('relative flex items-center', className)}>
          {prefix && <span className="pointer-events-none absolute left-3.5 text-muted">{prefix}</span>}
          <input ref={ref} className={cn(base, 'h-10', prefix && 'pl-8', suffix && 'pr-12')} {...props} />
          {suffix && <span className="pointer-events-none absolute right-3.5 text-[13px] text-muted">{suffix}</span>}
        </div>
      );
    }
    return <input ref={ref} className={cn(base, 'h-10', className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(base, 'min-h-[96px] py-2.5 leading-relaxed', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <select ref={ref} className={cn(base, 'h-10 appearance-none pr-9')} {...props}>
        {children}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" viewBox="0 0 16 16" fill="none">
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});

export function Field({
  label, hint, children, className, htmlFor, optional,
}: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string; htmlFor?: string; optional?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label} {optional && <span className="font-normal text-faint">(optioneel)</span>}
      </label>
      {children}
      {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
    </div>
  );
}

/** Field that wires up its own id. */
export function TextField({
  label, hint, optional, className, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: React.ReactNode; optional?: boolean; prefix?: string; suffix?: string }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className} optional={optional}>
      <Input id={id} {...props} />
    </Field>
  );
}
