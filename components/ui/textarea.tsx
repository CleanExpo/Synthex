import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  'flex min-h-[80px] w-full rounded-md px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
  {
    variants: {
      variant: {
        default:
          'border border-input bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus-visible:ring-violet-500/50',
        // Premium Glassmorphism variants
        glass:
          'bg-white/[0.03] backdrop-blur-md border border-white/[0.08] text-white placeholder:text-white/40 focus:bg-white/[0.06] focus:border-white/[0.15] focus:ring-2 focus:ring-white/[0.1]',
        'glass-solid':
          'bg-slate-900/80 backdrop-blur-md border border-white/[0.08] text-white placeholder:text-white/40 focus:bg-slate-900/90 focus:border-white/[0.15] focus:ring-2 focus:ring-white/[0.1]',
        'glass-primary':
          'bg-violet-500/10 backdrop-blur-md border border-violet-500/20 text-white placeholder:text-violet-200/40 focus:bg-violet-500/15 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20',
        'glass-secondary':
          'bg-cyan-500/10 backdrop-blur-md border border-cyan-500/20 text-white placeholder:text-cyan-200/40 focus:bg-cyan-500/15 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20',
      },
      resize: {
        none: 'resize-none',
        vertical: 'resize-y',
        horizontal: 'resize-x',
        both: 'resize',
      },
    },
    defaultVariants: {
      variant: 'default',
      resize: 'vertical',
    },
  }
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, resize, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ variant, resize, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };
