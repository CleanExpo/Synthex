'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { cn } from '@/lib/utils';
import { ChevronDown, Plus, Minus } from 'lucide-react';

/**
 * Accordion Component
 * Collapsible content sections with glassmorphism design
 *
 * @task UNI-411 - Frontend Component Completeness
 */

// ============================================================================
// COMPONENTS
// ============================================================================

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> & {
    variant?: 'default' | 'glass' | 'bordered' | 'separated';
  }
>(({ className, variant = 'default', ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      variant === 'default' && 'border-b border-white/[0.08]',
      variant === 'glass' && 'glass rounded-lg mb-2 overflow-hidden',
      variant === 'bordered' && 'border border-white/[0.08] rounded-lg mb-2 overflow-hidden',
      variant === 'separated' && 'bg-white/[0.02] rounded-lg mb-2 overflow-hidden',
      className
    )}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    iconType?: 'chevron' | 'plus-minus';
    iconPosition?: 'left' | 'right';
  }
>(({ className, children, iconType = 'chevron', iconPosition = 'right', ...props }, ref) => {
  const Icon = iconType === 'chevron' ? ChevronDown : null;

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'flex flex-1 items-center justify-between py-4 px-4 font-medium text-white transition-all hover:bg-white/[0.02]',
          '[&[data-state=open]>svg]:rotate-180',
          iconType === 'plus-minus' && '[&[data-state=open]_.plus-icon]:hidden [&[data-state=closed]_.minus-icon]:hidden',
          iconPosition === 'left' && 'flex-row-reverse justify-end gap-4',
          className
        )}
        {...props}
      >
        {iconPosition === 'left' && iconType === 'chevron' && Icon && (
          <Icon className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200" />
        )}
        {iconPosition === 'left' && iconType === 'plus-minus' && (
          <>
            <Plus className="plus-icon h-4 w-4 shrink-0 text-slate-400" />
            <Minus className="minus-icon h-4 w-4 shrink-0 text-slate-400" />
          </>
        )}

        {children}

        {iconPosition === 'right' && iconType === 'chevron' && Icon && (
          <Icon className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200" />
        )}
        {iconPosition === 'right' && iconType === 'plus-minus' && (
          <>
            <Plus className="plus-icon h-4 w-4 shrink-0 text-slate-400" />
            <Minus className="minus-icon h-4 w-4 shrink-0 text-slate-400" />
          </>
        )}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm text-slate-300 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn('pb-4 px-4 pt-0', className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

// ============================================================================
// PRESET COMPONENTS
// ============================================================================

export interface AccordionItemData {
  id: string;
  title: string | React.ReactNode;
  content: string | React.ReactNode;
  disabled?: boolean;
}

export interface AccordionGroupProps {
  items: AccordionItemData[];
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  collapsible?: boolean;
  variant?: 'default' | 'glass' | 'bordered' | 'separated';
  iconType?: 'chevron' | 'plus-minus';
  iconPosition?: 'left' | 'right';
  className?: string;
}

export function AccordionGroup({
  items,
  type = 'single',
  defaultValue,
  collapsible = true,
  variant = 'default',
  iconType = 'chevron',
  iconPosition = 'right',
  className,
}: AccordionGroupProps) {
  return (
    <Accordion
      type={type as any}
      defaultValue={defaultValue as any}
      collapsible={type === 'single' ? collapsible : undefined}
      className={className}
    >
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id} disabled={item.disabled} variant={variant}>
          <AccordionTrigger iconType={iconType} iconPosition={iconPosition}>
            {item.title}
          </AccordionTrigger>
          <AccordionContent>{item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

// ============================================================================
// FAQ COMPONENT
// ============================================================================

export interface FAQItem {
  question: string;
  answer: string | React.ReactNode;
}

export interface FAQProps {
  items: FAQItem[];
  variant?: 'default' | 'glass' | 'bordered' | 'separated';
  className?: string;
}

export function FAQ({ items, variant = 'separated', className }: FAQProps) {
  return (
    <AccordionGroup
      items={items.map((item, index) => ({
        id: `faq-${index}`,
        title: item.question,
        content: item.answer,
      }))}
      type="single"
      collapsible
      variant={variant}
      className={className}
    />
  );
}

export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
};

export default AccordionGroup;
