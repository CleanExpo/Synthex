'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, ChevronRight, Circle } from '@/components/icons';
import { cn } from '@/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const dropdownMenuContentVariants = cva(
  'z-50 min-w-[8rem] overflow-hidden rounded-md p-1 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
  {
    variants: {
      variant: {
        default: 'border bg-popover text-popover-foreground',
        // Premium Glassmorphism variants
        glass:
          'bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
        'glass-solid':
          'bg-slate-900/95 backdrop-blur-xl border border-white/[0.08] text-white shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        'glass-primary':
          'bg-violet-500/10 backdrop-blur-xl border border-violet-500/20 text-white shadow-[0_8px_32px_rgba(139,92,246,0.15)]',
        'glass-secondary':
          'bg-cyan-500/10 backdrop-blur-xl border border-cyan-500/20 text-white shadow-[0_8px_32px_rgba(6,182,212,0.15)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const dropdownMenuItemVariants = cva(
  'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  {
    variants: {
      variant: {
        default: 'focus:bg-accent focus:text-accent-foreground',
        glass: 'focus:bg-white/[0.08] text-white/90 focus:text-white',
        'glass-primary': 'focus:bg-violet-500/20 text-white/90 focus:text-white',
        'glass-secondary': 'focus:bg-cyan-500/20 text-white/90 focus:text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// Context for passing variant down to items
const DropdownMenuVariantContext = React.createContext<{
  variant?: VariantProps<typeof dropdownMenuContentVariants>['variant'];
}>({});

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => {
  const { variant } = React.useContext(DropdownMenuVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        isGlass
          ? 'focus:bg-white/[0.08] data-[state=open]:bg-white/[0.08] text-white/90'
          : 'focus:bg-accent data-[state=open]:bg-accent',
        inset && 'pl-8',
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
});
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent> &
    VariantProps<typeof dropdownMenuContentVariants>
>(({ className, variant, ...props }, ref) => {
  const context = React.useContext(DropdownMenuVariantContext);
  const resolvedVariant = variant ?? context.variant ?? 'default';

  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(dropdownMenuContentVariants({ variant: resolvedVariant, className }))}
      {...props}
    />
  );
});
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

export interface DropdownMenuContentProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>,
    VariantProps<typeof dropdownMenuContentVariants> {}

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  DropdownMenuContentProps
>(({ className, sideOffset = 4, variant, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuVariantContext.Provider value={{ variant }}>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(dropdownMenuContentVariants({ variant, className }))}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuVariantContext.Provider>
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => {
  const { variant } = React.useContext(DropdownMenuVariantContext);
  const itemVariant = variant === 'glass-primary'
    ? 'glass-primary'
    : variant === 'glass-secondary'
    ? 'glass-secondary'
    : variant && variant !== 'default'
    ? 'glass'
    : 'default';

  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        dropdownMenuItemVariants({ variant: itemVariant }),
        inset && 'pl-8',
        className
      )}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => {
  const { variant } = React.useContext(DropdownMenuVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        isGlass
          ? 'focus:bg-white/[0.08] text-white/90 focus:text-white'
          : 'focus:bg-accent focus:text-accent-foreground',
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className={cn('h-4 w-4', isGlass && 'text-white')} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
});
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => {
  const { variant } = React.useContext(DropdownMenuVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        isGlass
          ? 'focus:bg-white/[0.08] text-white/90 focus:text-white'
          : 'focus:bg-accent focus:text-accent-foreground',
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className={cn('h-2 w-2 fill-current', isGlass && 'text-white')} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
});
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => {
  const { variant } = React.useContext(DropdownMenuVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        'px-2 py-1.5 text-sm font-semibold',
        isGlass && 'text-white/70',
        inset && 'pl-8',
        className
      )}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(DropdownMenuVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn(
        '-mx-1 my-1 h-px',
        isGlass ? 'bg-white/[0.08]' : 'bg-muted',
        className
      )}
      {...props}
    />
  );
});
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  const { variant } = React.useContext(DropdownMenuVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <span
      className={cn(
        'ml-auto text-xs tracking-widest',
        isGlass ? 'text-white/40' : 'opacity-60',
        className
      )}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  dropdownMenuContentVariants,
  dropdownMenuItemVariants,
};
