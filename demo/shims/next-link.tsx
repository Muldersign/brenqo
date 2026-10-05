import { forwardRef } from 'react';
import { navigate } from './router';

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; scroll?: boolean; replace?: boolean };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch: _p, scroll, replace, onClick, ...rest }, ref) {
  return (
    <a
      ref={ref}
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        navigate(href, { scroll, replace });
      }}
    />
  );
});

export default Link;
