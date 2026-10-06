import { forwardRef } from 'react';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';
import { LoaderCircle } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success' | 'soft';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-[#fafafa] hover:bg-[#262626] active:bg-black',
  secondary: 'bg-canvas text-ink hover:bg-[#ebebeb]',
  outline: 'bg-transparent text-ink border border-line hover:bg-subtle',
  ghost: 'text-ink hover:bg-canvas',
  soft: 'bg-canvas text-ink hover:bg-[#ebebeb]',
  danger: 'bg-danger-600 text-white hover:bg-danger-700',
  success: 'bg-ink text-[#fafafa] hover:bg-[#262626] active:bg-black',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-full',
  md: 'h-9 px-4 text-[14px] gap-2 rounded-full',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-full',
  icon: 'h-9 w-9 rounded-full',
  'icon-sm': 'h-8 w-8 rounded-full',
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
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150',
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
