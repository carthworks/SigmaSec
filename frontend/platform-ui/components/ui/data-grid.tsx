"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { cn } from "@/lib/utils";
import { AlertCircle, Search, SlidersHorizontal } from "lucide-react";

interface DataGridProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  error?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  storageKey?: string;
  emptyState?: {
    icon?: React.ReactNode;
    title: string;
    description?: string;
  };
  className?: string;
}

export function DataGrid<TData, TValue>({
  columns,
  data,
  isLoading = false,
  error = null,
  onRowClick,
  defaultPageSize = 15,
  pageSizeOptions = [10, 15, 25, 50, 100],
  globalFilter = "",
  onGlobalFilterChange,
  storageKey,
  emptyState = {
    icon: <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />,
    title: "No records found",
    description: "Try adjusting your filters or search terms.",
  },
  className = "",
}: DataGridProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });

  // Restore column preferences from localStorage
  React.useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(`datagrid_cols_${storageKey}`);
      if (saved) {
        try {
          setColumnVisibility(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, [storageKey]);

  const handleColumnVisibilityChange = (updater: any) => {
    setColumnVisibility((old) => {
      const next = typeof updater === "function" ? updater(old) : updater;
      if (storageKey && typeof window !== "undefined") {
        localStorage.setItem(`datagrid_cols_${storageKey}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    onGlobalFilterChange: onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={cn("w-full overflow-hidden border border-border/80 rounded-xl bg-card/60 backdrop-blur-sm shadow-sm", className)}>
      {/* Optional Top Toolbar with Column Visibility Toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/10">
        <div className="text-[11px] font-semibold text-muted-foreground">
          Total Records: <strong className="text-foreground font-bold">{data.length}</strong>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              className="h-7 text-[11px] font-medium border-border/80 hover:bg-muted/80 cursor-pointer gap-1.5"
            >
              <SlidersHorizontal className="h-3 w-3" />
              Customize Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Toggle Columns
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize text-xs cursor-pointer"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id.replace(/_/g, " ")}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-border/60">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-3 px-4",
                        header.column.getCanSort() && "cursor-pointer select-none"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="divide-y divide-border/40 text-xs">
            {isLoading ? (
              Array.from({ length: Math.min(5, defaultPageSize) }).map((_, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-transparent">
                  {columns.map((col, colIndex) => (
                    <TableCell key={colIndex} className="py-3 px-4">
                      <Skeleton className="h-4 w-full max-w-[140px] opacity-70" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-destructive"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-sm font-semibold">Failed to load table data</p>
                    <div className="text-xs text-muted-foreground">{error}</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => onRowClick && onRowClick(row.original)}
                  className={cn(
                    "hover:bg-muted/20 transition-colors border-b border-border/40",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3 px-4">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="py-14 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    {emptyState.icon}
                    <p className="text-sm font-semibold text-foreground">
                      {emptyState.title}
                    </p>
                    {emptyState.description && (
                      <p className="text-xs text-muted-foreground max-w-sm">
                        {emptyState.description}
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && !error && data.length > 0 && (
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </div>
  );
}
