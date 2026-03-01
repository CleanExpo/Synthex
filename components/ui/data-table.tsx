'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  MoreHorizontal,
} from '@/components/icons';
// Aliases for double chevrons
const ChevronsUpDown = ChevronDown;
const ChevronsLeft = ChevronLeft;
const ChevronsRight = ChevronRight;
import { Button } from './button';
import { Input } from './input';
import { Checkbox } from './checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

/**
 * DataTable Component
 * Full-featured data table with sorting, filtering, pagination, and selection
 *
 * @task UNI-411 - Frontend Component Completeness
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Column<T> {
  id: string;
  header: string | React.ReactNode;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  cell?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (rows: T[]) => void;
  onRowClick?: (row: T) => void;
  rowKey?: keyof T | ((row: T) => string);
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
  };
  sorting?: {
    column: string | null;
    direction: 'asc' | 'desc';
    onSort: (column: string, direction: 'asc' | 'desc') => void;
  };
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  emptyState?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'bordered';
  compact?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  actions?: (row: T) => React.ReactNode;
}

// ============================================================================
// TABLE COMPONENTS
// ============================================================================

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t bg-slate-900/50 font-medium [&>tr]:last:border-b-0',
      className
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-white/[0.06] transition-colors data-[state=selected]:bg-cyan-500/10',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-slate-400 [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-slate-400', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

// ============================================================================
// DATA TABLE
// ============================================================================

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  onRowClick,
  rowKey = 'id',
  pagination,
  sorting,
  search,
  emptyState,
  className,
  variant = 'default',
  compact = false,
  striped = false,
  hoverable = true,
  actions,
}: DataTableProps<T>) {
  const getRowKey = React.useCallback(
    (row: T, index: number): string => {
      if (typeof rowKey === 'function') return rowKey(row);
      return String(row[rowKey] ?? index);
    },
    [rowKey]
  );

  const isSelected = React.useCallback(
    (row: T): boolean => {
      const key = getRowKey(row, 0);
      return selectedRows.some((r, i) => getRowKey(r, i) === key);
    },
    [selectedRows, getRowKey]
  );

  const toggleRow = React.useCallback(
    (row: T) => {
      if (!onSelectionChange) return;
      const key = getRowKey(row, 0);
      const isCurrentlySelected = isSelected(row);

      if (isCurrentlySelected) {
        onSelectionChange(selectedRows.filter((r, i) => getRowKey(r, i) !== key));
      } else {
        onSelectionChange([...selectedRows, row]);
      }
    },
    [selectedRows, onSelectionChange, getRowKey, isSelected]
  );

  const toggleAll = React.useCallback(() => {
    if (!onSelectionChange) return;
    if (selectedRows.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...data]);
    }
  }, [data, selectedRows, onSelectionChange]);

  const getCellValue = (row: T, column: Column<T>): React.ReactNode => {
    if (column.cell) {
      return column.cell(row, 0);
    }
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return row[column.accessor] as React.ReactNode;
  };

  const handleSort = (columnId: string) => {
    if (!sorting) return;
    const newDirection =
      sorting.column === columnId && sorting.direction === 'asc' ? 'desc' : 'asc';
    sorting.onSort(columnId, newDirection);
  };

  const tableClasses = cn(
    'rounded-lg overflow-hidden',
    variant === 'glass' && 'glass',
    variant === 'bordered' && 'border border-white/[0.08]',
    className
  );

  const rowClasses = cn(
    hoverable && 'hover:bg-white/[0.02]',
    striped && 'odd:bg-white/[0.01]',
    onRowClick && 'cursor-pointer'
  );

  const cellPadding = compact ? 'p-2' : 'p-4';

  return (
    <div className={tableClasses}>
      {/* Search & Filters */}
      {search && (
        <div className="p-4 border-b border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder || 'Search...'}
              className="pl-10"
              aria-label="Search table"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="bg-white/[0.02] hover:bg-white/[0.02]">
            {selectable && (
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedRows.length === data.length && data.length > 0}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead
                key={column.id}
                style={{ width: column.width }}
                className={cn(
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                  column.sortable && 'cursor-pointer select-none'
                )}
                onClick={() => column.sortable && handleSort(column.id)}
                onKeyDown={(e) => {
                  if (column.sortable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleSort(column.id);
                  }
                }}
                tabIndex={column.sortable ? 0 : undefined}
                role={column.sortable ? 'button' : undefined}
                aria-sort={
                  column.sortable && sorting?.column === column.id
                    ? sorting.direction === 'asc' ? 'ascending' : 'descending'
                    : undefined
                }
                aria-label={column.sortable ? `Sort by ${typeof column.header === 'string' ? column.header : column.id}` : undefined}
              >
                <div
                  className={cn(
                    'flex items-center gap-2',
                    column.align === 'center' && 'justify-center',
                    column.align === 'right' && 'justify-end'
                  )}
                >
                  {column.header}
                  {column.sortable && sorting && (
                    <span className="text-slate-500">
                      {sorting.column === column.id ? (
                        sorting.direction === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4" />
                      )}
                    </span>
                  )}
                </div>
              </TableHead>
            ))}
            {actions && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={`loading-${index}`}>
                {selectable && (
                  <TableCell className={cellPadding}>
                    <div className="w-4 h-4 bg-white/[0.05] rounded animate-pulse" />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.id} className={cellPadding}>
                    <div className="h-4 bg-white/[0.05] rounded animate-pulse" />
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className={cellPadding}>
                    <div className="w-8 h-8 bg-white/[0.05] rounded animate-pulse" />
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            // Empty state
            <TableRow>
              <TableCell
                colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                className="h-48 text-center"
              >
                {emptyState || (
                  <div className="text-slate-400">
                    <p className="text-lg font-medium">No data</p>
                    <p className="text-sm">No records found.</p>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ) : (
            // Data rows
            data.map((row, rowIndex) => (
              <TableRow
                key={getRowKey(row, rowIndex)}
                className={rowClasses}
                data-state={isSelected(row) ? 'selected' : undefined}
                onClick={() => onRowClick?.(row)}
              >
                {selectable && (
                  <TableCell className={cellPadding}>
                    <Checkbox
                      checked={isSelected(row)}
                      onCheckedChange={() => toggleRow(row)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select row ${rowIndex + 1}`}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(
                      cellPadding,
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right'
                    )}
                  >
                    {getCellValue(row, column)}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className={cellPadding}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actions(row)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
          <div className="text-sm text-slate-400">
            Showing{' '}
            <span className="font-medium text-white">
              {(pagination.page - 1) * pagination.pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-medium text-white">
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>{' '}
            of{' '}
            <span className="font-medium text-white">{pagination.total}</span>{' '}
            results
          </div>

          <div className="flex items-center gap-2">
            {pagination.pageSizeOptions && pagination.onPageSizeChange && (
              <select
                value={pagination.pageSize}
                onChange={(e) => pagination.onPageSizeChange?.(Number(e.target.value))}
                className="h-8 rounded-md border border-white/[0.1] bg-transparent px-2 text-sm"
                aria-label="Rows per page"
              >
                {pagination.pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onPageChange(1)}
                disabled={pagination.page === 1}
                className="h-8 w-8 p-0"
                aria-label="Go to first page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="h-8 w-8 p-0"
                aria-label="Go to previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-3 text-sm text-slate-400">
                Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                className="h-8 w-8 p-0"
                aria-label="Go to next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  pagination.onPageChange(Math.ceil(pagination.total / pagination.pageSize))
                }
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                className="h-8 w-8 p-0"
                aria-label="Go to last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export table primitives for custom tables
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};

export default DataTable;
