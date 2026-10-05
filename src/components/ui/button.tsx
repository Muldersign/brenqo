import { forwardRef } from 'react';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';
import { LoaderCircle } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success' | 'soft';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-brand hover:bg-brand-700 active:bg-brand-800 [background-image:linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0))]',
  secondary: 'bg-ink text-white hover:bg-ink-2 shadow-[0_1px_2px_rgba(0,0,0,0.2)]',
  outline: 'bg-surface text-ink border border-line-strong hover:bg-subtle hover:border-faint shadow-card',
  ghost: 'text-ink-2 hover:bg-black/[0.04] hover:text-ink',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  danger: 'bg-danger-600 text-white hover:bg-danger-700',
  success: 'bg-success-600 text-white hover:bg-success-700 shadow-[0_8px_20px_-8px_rgba(15,138,75,0.6)]',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-10 px-4 text-[14px] gap-2 rounded-[var(--radius-btn)]',
  lg: 'h-12 px-5 text-[15px] gap-2.5 rounded-[14px]',
  icon: 'h-10 w-10 rounded-[var(--radius-btn)]',
  'icon-sm': 'h-8 w-8 rounded-[10px]',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', asChild, loading, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium tracking-[-0.01em] transition-all duration-150',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {asChild ? children : (
        <>
          {loading && <LoaderCircle className="animate-spin" />}
          {children}
        </>
      )}
    </Comp>
  );
});
