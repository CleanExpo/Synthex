'use client';

import { useState, useCallback, useMemo } from 'react';
import { notify } from '@/lib/notifications';

interface UseMultiSelectOptions<T> {
  items: T[];
  keyField: keyof T;
  onSelectionChange?: (selected: T[]) => void;
  maxSelection?: number;
}

export function useMultiSelect<T>({
  items,
  keyField,
  onSelectionChange,
  maxSelection
}: UseMultiSelectOptions<T>) {
  const [selectedKeys, setSelectedKeys] = useState<Set<any>>(new Set());
  
  // Get selected items
  const selectedItems = useMemo(() => {
    return items.filter(item => selectedKeys.has(item[keyField]));
  }, [items, selectedKeys, keyField]);
  
  // Toggle single item selection
  const toggleSelection = useCallback((item: T) => {
    const key = item[keyField];
    const newSelection = new Set(selectedKeys);
    
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      if (maxSelection && newSelection.size >= maxSelection) {
        notify.error(`Maximum ${maxSelection} items can be selected`);
        return;
      }
      newSelection.add(key);
    }
    
    setSelectedKeys(newSelection);
    if (onSelectionChange) {
      const selected = items.filter(i => newSelection.has(i[keyField]));
      onSelectionChange(selected);
    }
  }, [selectedKeys, items, keyField, maxSelection, onSelectionChange]);
  
  // Select all items
  const selectAll = useCallback(() => {
    const allKeys = new Set(items.map(item => item[keyField]));
    
    if (maxSelection && allKeys.size > maxSelection) {
      notify.error(`Maximum ${maxSelection} items can be selected`);
      return;
    }
    
    setSelectedKeys(allKeys);
    if (onSelectionChange) {
      onSelectionChange(items);
    }
  }, [items, keyField, maxSelection, onSelectionChange]);
  
  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  }, [onSelectionChange]);
  
  // Select range (shift+click functionality)
  const selectRange = useCallback((startItem: T, endItem: T) => {
    const startIndex = items.findIndex(i => i[keyField] === startItem[keyField]);
    const endIndex = items.findIndex(i => i[keyField] === endItem[keyField]);
    
    if (startIndex === -1 || endIndex === -1) return;
    
    const [from, to] = startIndex < endIndex 
      ? [startIndex, endIndex] 
      : [endIndex, startIndex];
    
    const rangeItems = items.slice(from, to + 1);
    const rangeKeys = new Set(rangeItems.map(item => item[keyField]));
    
    if (maxSelection && rangeKeys.size > maxSelection) {
      notify.error(`Maximum ${maxSelection} items can be selected`);
      return;
    }
    
    setSelectedKeys(rangeKeys);
    if (onSelectionChange) {
      onSelectionChange(rangeItems);
    }
  }, [items, keyField, maxSelection, onSelectionChange]);
  
  // Check if item is selected
  const isSelected = useCallback((item: T) => {
    return selectedKeys.has(item[keyField]);
  }, [selectedKeys, keyField]);
  
  // Bulk actions
  const performBulkAction = useCallback(async (
    action: (items: T[]) => Promise<void>,
    actionName: string
  ) => {
    if (selectedItems.length === 0) {
      notify.error('No items selected');
      return;
    }
    
    try {
      await action(selectedItems);
      notify.success(`${actionName} completed for ${selectedItems.length} items`);
      clearSelection();
    } catch (error) {
      notify.error(`${actionName} failed`);
      console.error(error);
    }
  }, [selectedItems, clearSelection]);
  
  return {
    selectedItems,
    selectedCount: selectedKeys.size,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    selectRange,
    performBulkAction,
    hasSelection: selectedKeys.size > 0,
    isAllSelected: selectedKeys.size === items.length && items.length > 0
  };
}

// Bulk Actions Menu Component
interface BulkActionsMenuProps<T> {
  selectedItems: T[];
  onDelete?: (items: T[]) => Promise<void>;
  onArchive?: (items: T[]) => Promise<void>;
  onExport?: (items: T[]) => Promise<void>;
  onDuplicate?: (items: T[]) => Promise<void>;
  onMove?: (items: T[], destination: string) => Promise<void>;
  customActions?: Array<{
    label: string;
    icon: React.ReactNode;
    action: (items: T[]) => Promise<void>;
    destructive?: boolean;
  }>;
}

export function BulkActionsMenu<T>({
  selectedItems,
  onDelete,
  onArchive,
  onExport,
  onDuplicate,
  onMove,
  customActions = []
}: BulkActionsMenuProps<T>) {
  const count = selectedItems.length;
  
  if (count === 0) return null;
  
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="glass-card px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
        <span className="text-sm text-gray-300">
          {count} {count === 1 ? 'item' : 'items'} selected
        </span>
        
        <div className="h-6 w-px bg-white/20" />
        
        <div className="flex items-center gap-2">
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(selectedItems)}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Duplicate"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          
          {onArchive && (
            <button
              onClick={() => onArchive(selectedItems)}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Archive"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>
          )}
          
          {onExport && (
            <button
              onClick={() => onExport(selectedItems)}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Export"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}
          
          {customActions.map((action, index) => (
            <button
              key={index}
              onClick={() => action.action(selectedItems)}
              className={`p-2 rounded-lg transition-colors ${
                action.destructive 
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' 
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title={action.label}
            >
              {action.icon}
            </button>
          ))}
          
          {onDelete && (
            <>
              <div className="h-6 w-px bg-white/20" />
              <button
                onClick={() => onDelete(selectedItems)}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
        
        <div className="h-6 w-px bg-white/20" />
        
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('clearSelection'))}
          className="text-sm text-gray-400 hover:text-white"
        >
          Clear
        </button>
      </div>
    </div>
  );
}