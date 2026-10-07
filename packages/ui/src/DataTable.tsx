import { Select } from './Select';
import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { TableSkeletonRows } from './Skeleton';
import { cn } from './utils';

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
  enableExport?: boolean;
  exportFileName?: string;
  searchPlaceholder?: string;
  className?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no records matching your query or filters.',
  onEmptyAction,
  emptyActionLabel,
  enableExport = true,
  exportFileName = 'export-data',
  searchPlaceholder = 'Search records...',
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const exportToCsv = () => {
    const visibleColumns = table
      .getAllLeafColumns()
      .filter((col) => col.getIsVisible() && col.id !== 'actions');
    const headers = visibleColumns.map((col) => {
      const headerDef = col.columnDef.header;
      return typeof headerDef === 'string' ? headerDef : col.id;
    });

    const rows = table.getPrePaginationRowModel().rows.map((row) =>
      visibleColumns
        .map((col) => {
          const val = row.getValue(col.id);
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    );

    const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${exportFileName}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={cn('w-full space-y-3', className)}>
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full text-xs rounded-md border border-border bg-surface pl-9 pr-3 py-1.5 text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Column Visibility Menu */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={() => setIsColumnMenuOpen((prev) => !prev)}
              aria-expanded={isColumnMenuOpen}
              aria-label="Toggle column visibility"
            >
              Columns
            </Button>
            {isColumnMenuOpen && (
              <div className="absolute right-0 mt-1 w-44 rounded-md border border-border bg-surface-raised p-2 shadow-lg z-20 space-y-1">
                <p className="text-[11px] font-semibold text-muted px-1 mb-1">
                  Toggle Columns
                </p>
                {table
                  .getAllLeafColumns()
                  .filter((col) => col.id !== 'actions')
                  .map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 text-xs text-text hover:bg-surface-subtle px-1 py-1 rounded cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        className="rounded border-border text-brand focus:ring-ring"
                      />
                      <span className="capitalize">{column.id}</span>
                    </label>
                  ))}
              </div>
            )}
          </div>

          {/* CSV Export */}
          {enableExport && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={exportToCsv}
              aria-label="Export table data as CSV"
            >
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-md border border-border bg-surface overflow-x-auto shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-surface-subtle border-b border-border text-muted font-semibold uppercase tracking-wider text-[11px]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className="px-3.5 py-2.5 select-none"
                      aria-sort={
                        isSorted === 'asc'
                          ? 'ascending'
                          : isSorted === 'desc'
                          ? 'descending'
                          : 'none'
                      }
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex items-center gap-1.5',
                            canSort ? 'cursor-pointer hover:text-text' : ''
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className="text-muted">
                              {isSorted === 'asc' ? (
                                <ArrowUp className="w-3 h-3 text-brand" aria-hidden="true" />
                              ) : isSorted === 'desc' ? (
                                <ArrowDown className="w-3 h-3 text-brand" aria-hidden="true" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" aria-hidden="true" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <TableSkeletonRows rows={5} cols={columns.length} />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    onAction={onEmptyAction}
                    actionLabel={emptyActionLabel}
                  />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-surface-subtle transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3.5 py-2.5 text-text">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && table.getRowModel().rows.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span>Showing</span>
            <span className="font-semibold text-text tabular-nums">
              {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            </span>
            <span>to</span>
            <span className="font-semibold text-text tabular-nums">
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}
            </span>
            <span>of</span>
            <span className="font-semibold text-text tabular-nums">
              {table.getFilteredRowModel().rows.length}
            </span>
            <span>entries</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span>Rows:</span>
              <Select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                aria-label="Select rows per page"
                className="text-xs rounded border border-border bg-surface px-2 py-1 text-text focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
                className="p-1 px-2"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
              <span className="tabular-nums px-2 font-medium">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
                className="p-1 px-2"
              >
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
