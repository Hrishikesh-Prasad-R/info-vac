"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowUpDown, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExtractedField } from "@/types/api";

const col = createColumnHelper<ExtractedField>();

const columns = [
  col.accessor("category", {
    header: "Category",
    cell: (info) => (
      <span className="text-xs uppercase font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--kobie-font-heading)' }}>
        {info.getValue()?.replace(/_/g, " ")}
      </span>
    ),
    size: 140,
  }),
  col.accessor("field_name", {
    header: "Field",
    cell: (info) => (
      <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{info.getValue()}</span>
    ),
    size: 180,
  }),
  col.accessor("field_value", {
    header: "Value",
    cell: (info) => {
      const val = info.getValue();
      const row = info.row.original;
      if (!val || row.is_null) {
        return (
          <span className="text-xs italic" style={{ color: 'rgba(255,255,255,0.3)' }}>null</span>
        );
      }
      return (
        <span className="text-xs line-clamp-2" style={{ color: 'rgba(255,255,255,0.7)' }}>{val}</span>
      );
    },
    size: 240,
  }),
  col.accessor("confidence", {
    header: "Confidence",
    cell: (info) => {
      const val = info.getValue();
      if (val == null)
        return <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;
      const pct = Math.round(val * 100);
      const color =
        pct >= 70
          ? '#10b981'
          : pct >= 40
          ? '#fbbf24'
          : '#ef4444';
      return (
        <span className="text-xs font-mono font-bold" style={{ color }}>{pct}%</span>
      );
    },
    size: 90,
  }),
  col.accessor("gate_passed", {
    header: "Gate",
    cell: (info) => {
      const passed = info.getValue();
      if (passed == null)
        return <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;
      return passed ? (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px]" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
          Pass
        </span>
      ) : (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px]" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          Fail
        </span>
      );
    },
    size: 70,
  }),
  col.accessor("contradiction_flag", {
    header: "",
    cell: (info) =>
      info.getValue() ? (
        <span title="Contradiction detected">
          <AlertTriangle size={13} strokeWidth={1.5} className="text-red-500" />
        </span>
      ) : null,
    size: 36,
  }),
];

interface FieldsGridProps {
  fields: ExtractedField[];
  externalFilter?: string;
  hideFilterInput?: boolean;
}

export function FieldsGrid({ fields, externalFilter = "", hideFilterInput = false }: FieldsGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [localFilter, setLocalFilter] = useState("");

  const globalFilter = hideFilterInput ? externalFilter : localFilter;

  const table = useReactTable({
    data: fields,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: hideFilterInput ? undefined : setLocalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
        No extracted fields available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!hideFilterInput && (
        <Input
          placeholder="Filter fields…"
          value={localFilter}
          onChange={(e) => setLocalFilter(e.target.value)}
          className="h-8 text-xs max-w-xs"
        />
      )}

      <ScrollArea className="h-[480px] rounded-[8px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <Table>
          <TableHeader className="sticky top-0 z-10" style={{ backgroundColor: 'rgba(5,28,44,0.96)' }}>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-b hover:bg-transparent" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize(), color: 'rgba(255,255,255,0.45)' }}
                    className="text-[10px] uppercase font-bold py-2.5 px-3 cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <ArrowUpDown size={10} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row, idx) => (
              <TableRow
                key={row.id}
                className="last:border-0 transition-colors"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(253,127,79,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)')}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="py-2.5 px-3 align-top"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <p className="text-[10px] text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Showing {table.getFilteredRowModel().rows.length} of {fields.length} parameters
      </p>
    </div>
  );
}
