'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

const EXIT_DELAY = 0.3;

interface DropdownMenuContextType {
  isOpen: boolean;
  activeValue: string | null;
  setActiveValue: (value: string | null) => void;
  scheduleReset: () => void;
  clearReset: () => void;
}
const DropdownMenuContext = React.createContext<DropdownMenuContextType>({
  isOpen: false,
  activeValue: null,
  setActiveValue: () => {},
  scheduleReset: () => {},
  clearReset: () => {},
});

const useDropdownMenu = (): DropdownMenuContextType => {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error('useDropdownMenu must be used within a DropdownMenu');
  }
  return context;
};

type DropdownMenuProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Root
>;
const DropdownMenu: React.FC<DropdownMenuProps> = ({ children, ...props }) => {
  const [isOpen, setIsOpen] = React.useState(
    props?.open ?? props?.defaultOpen ?? false
  );
  const [activeValue, setActiveValueState] = React.useState<string | null>(
    null
  );
  const exitTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const scheduleReset = React.useCallback(() => {
    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    exitTimeoutRef.current = setTimeout(() => {
      setActiveValueState(null);
      exitTimeoutRef.current = null;
    }, EXIT_DELAY * 1000);
  }, []);

  const clearReset = React.useCallback(() => {
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, []);

  const setActiveValue = (val: string | null) => {
    clearReset();
    setActiveValueState(val);
  };

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      setIsOpen(open);
      props.onOpenChange?.(open);
    },
    [props]
  );

  return (
    <DropdownMenuPrimitive.Root {...props} onOpenChange={handleOpenChange}>
      <DropdownMenuContext.Provider
        value={{
          isOpen,
          activeValue,
          setActiveValue,
          scheduleReset,
          clearReset,
        }}
      >
        {children}
      </DropdownMenuContext.Provider>
    </DropdownMenuPrimitive.Root>
  );
};

type DropdownMenuTriggerProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Trigger
>;
const DropdownMenuTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  DropdownMenuTriggerProps
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Trigger ref={ref} className={className} {...props} />
));
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

type DropdownMenuSubTriggerProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.SubTrigger
> & { inset?: boolean };
const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  DropdownMenuSubTriggerProps
>(({ className, children, inset, disabled, asChild, ...props }, ref) => {
  const { activeValue, setActiveValue, scheduleReset, clearReset } =
    useDropdownMenu();
  const id = React.useId();
  // SYN-906: same Slot/Children.only trap as DropdownMenuItem. The wrapper-
  // span pattern + ChevronRight indicator means SubTrigger renders 3+
  // children, so asChild → Slot would crash immediately. Strip the prop
  // and warn in dev.
  if (process.env.NODE_ENV !== 'production' && asChild) {
    console.error(
      '[DropdownMenuSubTrigger] asChild is not supported on this component ' +
        '(would crash with React.Children.only). Ignoring the prop. See SYN-906.'
    );
  }
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className="relative"
      {...props}
      disabled={disabled}
      onMouseEnter={e => {
        clearReset();
        setActiveValue(id);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={e => {
        scheduleReset();
        props.onMouseLeave?.(e);
      }}
    >
      {activeValue === id && !disabled && (
        <span className="absolute inset-0 h-full w-full bg-white/[0.05] rounded-sm" />
      )}
      <span
        data-disabled={disabled}
        className={cn(
          'relative z-[1] flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-white/70 outline-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
          inset && 'pl-8',
          className
        )}
      >
        {children}
        <ChevronRight className="ml-auto" />
      </span>
    </DropdownMenuPrimitive.SubTrigger>
  );
});
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

type DropdownMenuSubContentProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.SubContent
>;
const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  DropdownMenuSubContentProps
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[8rem] overflow-hidden rounded-sm border-[0.5px] border-white/[0.08] bg-[#050505] p-1 text-white shadow-lg shadow-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

type DropdownMenuContentProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
>;
const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  DropdownMenuContentProps
>(({ className, children, sideOffset = 4, ...props }, ref) => {
  const { isOpen } = useDropdownMenu();
  return (
    <>
      {isOpen && (
        <DropdownMenuPrimitive.Portal forceMount>
          <DropdownMenuPrimitive.Content
            ref={ref}
            sideOffset={sideOffset}
            className={cn(
              'z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-sm border-[0.5px] border-white/[0.08] bg-[#050505] p-1 text-white shadow-lg shadow-black/40',
              className
            )}
            {...props}
          >
            {children}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      )}
    </>
  );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

type DropdownMenuItemProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
> & { inset?: boolean };
const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(({ className, children, inset, disabled, asChild, ...props }, ref) => {
  const { activeValue, setActiveValue, scheduleReset, clearReset } =
    useDropdownMenu();
  const id = React.useId();

  // SYN-906: when the caller passes `asChild`, Radix's Primitive.Item uses
  // Slot internally and calls React.Children.only on its direct children.
  // The wrapper-span pattern below renders TWO children whenever
  // `activeValue === id` (i.e., on hover), which crashes Slot with the
  // generic "expected to receive a single React element child" error.
  //
  // The crash reproduced live on synthex.social/dashboard via the
  // BusinessSwitcher dropdown's "Add business" item, which uses asChild to
  // make a <Link> the actual interactive element.
  //
  // Fix: in asChild mode, skip the highlight overlay + wrapper span and
  // pass children straight through. The caller's className already contains
  // the hover styling, so the visual hover state still works (via
  // Tailwind's `hover:` selectors on the Link itself); only the absolute-
  // inset highlight overlay is omitted, which is acceptable for asChild
  // call sites — those are typically Link/anchor items where the hover
  // visual is owned by the slotted child.
  if (asChild) {
    return (
      <DropdownMenuPrimitive.Item
        asChild
        ref={ref}
        {...props}
        disabled={disabled}
        onMouseEnter={e => {
          clearReset();
          setActiveValue(id);
          props.onMouseEnter?.(e);
        }}
        onMouseLeave={e => {
          scheduleReset();
          props.onMouseLeave?.(e);
        }}
      >
        {React.isValidElement(children)
          ? React.cloneElement(
              children as React.ReactElement<{ className?: string }>,
              {
                className: cn(
                  'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-white/70 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                  inset && 'pl-8',
                  className,
                  (children as React.ReactElement<{ className?: string }>).props
                    ?.className
                ),
              }
            )
          : children}
      </DropdownMenuPrimitive.Item>
    );
  }

  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className="relative"
      {...props}
      disabled={disabled}
      onMouseEnter={e => {
        clearReset();
        setActiveValue(id);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={e => {
        scheduleReset();
        props.onMouseLeave?.(e);
      }}
    >
      {activeValue === id && !disabled && (
        <span className="absolute inset-0 h-full w-full bg-white/[0.05] rounded-sm" />
      )}
      <span
        data-disabled={disabled}
        className={cn(
          'relative z-[1] flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-white/70 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
          inset && 'pl-8',
          className
        )}
      >
        {children}
      </span>
    </DropdownMenuPrimitive.Item>
  );
});
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

type DropdownMenuCheckboxItemProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.CheckboxItem
>;
const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  DropdownMenuCheckboxItemProps
>(({ className, children, checked, disabled, asChild, ...props }, ref) => {
  const { activeValue, setActiveValue, scheduleReset, clearReset } =
    useDropdownMenu();
  const id = React.useId();
  // SYN-906: same Slot/Children.only trap as DropdownMenuItem. The shadcn
  // wrapper renders an indicator + wrapper-span pattern that is incompatible
  // with the asChild → Slot path. We don't currently have a caller using
  // asChild here, so the simplest safe behaviour is to ignore it (extracted
  // from props above so it never reaches the Primitive) and warn loudly in
  // dev. If a future caller genuinely needs asChild on a CheckboxItem, the
  // Item-style cloneElement path can be ported here — but it must also
  // preserve the Indicator's checkmark, so it's deliberately not done now.
  if (process.env.NODE_ENV !== 'production' && asChild) {
    console.error(
      '[DropdownMenuCheckboxItem] asChild is not supported on this component ' +
        '(would crash with React.Children.only on hover). Ignoring the prop. ' +
        'See SYN-906.'
    );
  }
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      className="relative"
      {...props}
      checked={checked}
      disabled={disabled}
      onMouseEnter={e => {
        clearReset();
        setActiveValue(id);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={e => {
        scheduleReset();
        props.onMouseLeave?.(e);
      }}
    >
      {activeValue === id && !disabled && (
        <span className="absolute inset-0 h-full w-full bg-white/[0.05] rounded-sm" />
      )}
      <span
        data-disabled={disabled}
        className={cn(
          'relative z-[1] flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-white/70 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          className
        )}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <Check className="h-4 w-4" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </span>
    </DropdownMenuPrimitive.CheckboxItem>
  );
});
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

type DropdownMenuRadioItemProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.RadioItem
>;
const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  DropdownMenuRadioItemProps
>(({ className, children, disabled, asChild, ...props }, ref) => {
  const { activeValue, setActiveValue, scheduleReset, clearReset } =
    useDropdownMenu();
  const id = React.useId();
  // SYN-906: same trap as DropdownMenuCheckboxItem above. asChild is
  // extracted from props (so it never reaches the Primitive) and a dev-
  // only warning surfaces a clear message if a caller tries to use it.
  if (process.env.NODE_ENV !== 'production' && asChild) {
    console.error(
      '[DropdownMenuRadioItem] asChild is not supported on this component ' +
        '(would crash with React.Children.only on hover). Ignoring the prop. ' +
        'See SYN-906.'
    );
  }
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className="relative"
      {...props}
      disabled={disabled}
      onMouseEnter={e => {
        clearReset();
        setActiveValue(id);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={e => {
        scheduleReset();
        props.onMouseLeave?.(e);
      }}
    >
      {activeValue === id && !disabled && (
        <span className="absolute inset-0 h-full w-full bg-white/[0.05] rounded-sm" />
      )}
      <span
        data-disabled={disabled}
        className={cn(
          'relative z-[1] flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-white/70 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          className
        )}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <Circle className="h-2 w-2 fill-current" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </span>
    </DropdownMenuPrimitive.RadioItem>
  );
});
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

type DropdownMenuLabelProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Label
> & { inset?: boolean };
const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  DropdownMenuLabelProps
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-xs font-semibold text-white/40',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

type DropdownMenuSeparatorProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Separator
>;
const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  DropdownMenuSeparatorProps
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-white/[0.06]', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

type DropdownMenuShortcutProps = React.HTMLAttributes<HTMLSpanElement>;
const DropdownMenuShortcut = React.forwardRef<
  HTMLSpanElement,
  DropdownMenuShortcutProps
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn('ml-auto text-xs tracking-widest text-white/40', className)}
    {...props}
  />
));
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
};
