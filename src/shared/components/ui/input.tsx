import * as React from 'react';
import { cn } from '@shared/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-white/15 bg-white/5 px-3 py-1 text-sm text-white shadow-sm',
        'transition-colors placeholder:text-white/30',
        'focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
