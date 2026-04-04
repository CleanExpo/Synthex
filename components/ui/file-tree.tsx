'use client';

import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── Types ────────────────────────────────────────────────────────────────────

export type TreeViewElement = {
  id: string;
  name: string;
  isSelectable?: boolean;
  children?: TreeViewElement[];
};

type TreeContextProps = {
  selectedId: string | undefined;
  expandedItems: string[] | undefined;
  indicator: boolean;
  handleExpand: (id: string) => void;
  selectItem: (id: string) => void;
  setExpandedItems?: React.Dispatch<React.SetStateAction<string[] | undefined>>;
  openIcon?: React.ReactNode;
  closeIcon?: React.ReactNode;
  direction: 'rtl' | 'ltr';
};

const TreeContext = createContext<TreeContextProps | null>(null);

const useTree = () => {
  const context = useContext(TreeContext);
  if (!context) throw new Error('useTree must be used within a TreeProvider');
  return context;
};

// ── Tree root ─────────────────────────────────────────────────────────────────

type Direction = 'rtl' | 'ltr' | undefined;

type TreeViewProps = {
  initialSelectedId?: string;
  indicator?: boolean;
  elements?: TreeViewElement[];
  initialExpandedItems?: string[];
  openIcon?: React.ReactNode;
  closeIcon?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const Tree = forwardRef<HTMLDivElement, TreeViewProps>(
  (
    {
      className,
      elements,
      initialSelectedId,
      initialExpandedItems,
      children,
      indicator = true,
      openIcon,
      closeIcon,
      dir,
      ...props
    },
    ref
  ) => {
    const [selectedId, setSelectedId] = useState<string | undefined>(
      initialSelectedId
    );
    const [expandedItems, setExpandedItems] = useState<string[] | undefined>(
      initialExpandedItems
    );

    const selectItem = useCallback((id: string) => setSelectedId(id), []);

    const handleExpand = useCallback((id: string) => {
      setExpandedItems(prev => {
        if (prev?.includes(id)) return prev.filter(item => item !== id);
        return [...(prev ?? []), id];
      });
    }, []);

    const expandSpecificTargetedElements = useCallback(
      (elements?: TreeViewElement[], selectId?: string) => {
        if (!elements || !selectId) return;
        const findParent = (
          current: TreeViewElement,
          currentPath: string[] = []
        ) => {
          const isSelectable = current.isSelectable ?? true;
          const newPath = [...currentPath, current.id];
          if (current.id === selectId) {
            if (isSelectable) {
              setExpandedItems(prev => [...(prev ?? []), ...newPath]);
            } else {
              if (newPath.includes(current.id)) {
                newPath.pop();
                setExpandedItems(prev => [...(prev ?? []), ...newPath]);
              }
            }
            return;
          }
          if (isSelectable && current.children && current.children.length > 0) {
            current.children.forEach(child => findParent(child, newPath));
          }
        };
        elements.forEach(element => findParent(element));
      },
      []
    );

    useEffect(() => {
      if (initialSelectedId) {
        expandSpecificTargetedElements(elements, initialSelectedId);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSelectedId, elements]);

    const direction = dir === 'rtl' ? 'rtl' : 'ltr';

    return (
      <TreeContext.Provider
        value={{
          selectedId,
          expandedItems,
          handleExpand,
          selectItem,
          setExpandedItems,
          indicator,
          openIcon,
          closeIcon,
          direction,
        }}
      >
        <div className={cn('size-full', className)}>
          <ScrollArea
            ref={ref}
            className="h-full relative px-2"
            dir={dir as Direction}
          >
            <AccordionPrimitive.Root
              {...props}
              type="multiple"
              defaultValue={expandedItems}
              value={expandedItems}
              className="flex flex-col gap-1"
              onValueChange={value =>
                setExpandedItems(prev => [...(prev ?? []), value[0]])
              }
              dir={dir as Direction}
            >
              {children}
            </AccordionPrimitive.Root>
          </ScrollArea>
        </div>
      </TreeContext.Provider>
    );
  }
);
Tree.displayName = 'Tree';

// ── Tree indicator ────────────────────────────────────────────────────────────

const TreeIndicator = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { direction } = useTree();
  return (
    <div
      dir={direction}
      ref={ref}
      className={cn(
        'h-full w-px bg-white/[0.06] absolute left-1.5 rtl:right-1.5 py-3 rounded-md hover:bg-orange-500/20 duration-300 ease-in-out',
        className
      )}
      {...props}
    />
  );
});
TreeIndicator.displayName = 'TreeIndicator';

// ── Folder ────────────────────────────────────────────────────────────────────

type FolderProps = {
  expandedItems?: string[];
  element: string;
  isSelectable?: boolean;
  isSelect?: boolean;
} & React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> &
  React.HTMLAttributes<HTMLDivElement>;

export const Folder = forwardRef<HTMLDivElement, FolderProps>(
  (
    {
      className,
      element,
      value,
      isSelectable = true,
      isSelect,
      children,
      ...props
    },
    ref
  ) => {
    const {
      direction,
      handleExpand,
      expandedItems,
      indicator,
      setExpandedItems,
      openIcon,
      closeIcon,
    } = useTree();

    return (
      <AccordionPrimitive.Item
        {...props}
        value={value as string}
        className="relative overflow-hidden h-full"
      >
        <AccordionPrimitive.Trigger
          className={cn(
            'flex items-center gap-1.5 text-sm rounded-sm px-1 py-0.5 w-full text-left',
            isSelect && isSelectable && 'bg-orange-500/[0.06]',
            isSelectable
              ? 'cursor-pointer text-white/60 hover:text-white'
              : 'cursor-not-allowed opacity-50 text-white/50',
            className
          )}
          disabled={!isSelectable}
          onClick={() => handleExpand(value as string)}
        >
          {expandedItems?.includes(value as string)
            ? (openIcon ?? (
                <FolderOpenIcon className="size-4 text-orange-400/70 shrink-0" />
              ))
            : (closeIcon ?? (
                <FolderIcon className="size-4 text-white/40 shrink-0" />
              ))}
          <span>{element}</span>
        </AccordionPrimitive.Trigger>
        <AccordionPrimitive.Content className="text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down relative overflow-hidden h-full">
          {element && indicator && <TreeIndicator aria-hidden="true" />}
          <AccordionPrimitive.Root
            dir={direction}
            type="multiple"
            className="flex flex-col gap-1 py-1 ml-5 rtl:mr-5"
            defaultValue={expandedItems}
            value={expandedItems}
            onValueChange={value => {
              setExpandedItems?.(prev => [...(prev ?? []), value[0]]);
            }}
          >
            {children}
          </AccordionPrimitive.Root>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    );
  }
);
Folder.displayName = 'Folder';

// ── File ──────────────────────────────────────────────────────────────────────

export const File = forwardRef<
  HTMLButtonElement,
  {
    value: string;
    handleSelect?: (id: string) => void;
    isSelectable?: boolean;
    isSelect?: boolean;
    fileIcon?: React.ReactNode;
  } & React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(
  (
    {
      value,
      className,
      handleSelect,
      isSelectable = true,
      isSelect,
      fileIcon,
      children,
      ...props
    },
    ref
  ) => {
    const { direction, selectedId, selectItem } = useTree();
    const isSelected = isSelect ?? selectedId === value;

    return (
      <AccordionPrimitive.Item value={value} className="relative">
        <AccordionPrimitive.Trigger
          ref={ref}
          {...props}
          dir={direction}
          disabled={!isSelectable}
          aria-label="File"
          className={cn(
            'flex items-center gap-1.5 cursor-pointer text-sm pr-1 rtl:pl-1 rtl:pr-0 rounded-sm px-1 py-0.5 w-full text-left duration-200 ease-in-out',
            isSelected && isSelectable && 'bg-orange-500/[0.06] text-white',
            !isSelected &&
              isSelectable &&
              'text-white/60 hover:text-white hover:bg-white/[0.02]',
            !isSelectable && 'opacity-50 cursor-not-allowed text-white/50',
            className
          )}
          onClick={() => selectItem(value)}
        >
          {fileIcon ?? <FileIcon className="size-4 text-white/40 shrink-0" />}
          {children}
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Item>
    );
  }
);
File.displayName = 'File';

// ── Collapse button ───────────────────────────────────────────────────────────

export const CollapseButton = forwardRef<
  HTMLButtonElement,
  {
    elements: TreeViewElement[];
    expandAll?: boolean;
  } & React.HTMLAttributes<HTMLButtonElement>
>(({ className, elements, expandAll = false, children, ...props }, ref) => {
  const { expandedItems, setExpandedItems } = useTree();

  const expandAllTree = useCallback((elements: TreeViewElement[]) => {
    const expandTree = (element: TreeViewElement) => {
      const isSelectable = element.isSelectable ?? true;
      if (isSelectable && element.children && element.children.length > 0) {
        setExpandedItems?.(prev => [...(prev ?? []), element.id]);
        element.children.forEach(expandTree);
      }
    };
    elements.forEach(expandTree);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeAll = useCallback(() => {
    setExpandedItems?.([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (expandAll) expandAllTree(elements);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandAll]);

  return (
    <Button
      variant="ghost"
      className={cn(
        'h-8 w-fit p-1 absolute bottom-1 right-2 text-white/40 hover:text-white hover:bg-white/[0.04] rounded-sm text-xs',
        className
      )}
      onClick={
        expandedItems && expandedItems.length > 0
          ? closeAll
          : () => expandAllTree(elements)
      }
      ref={ref}
      {...props}
    >
      {children}
      <span className="sr-only">Toggle</span>
    </Button>
  );
});
CollapseButton.displayName = 'CollapseButton';
