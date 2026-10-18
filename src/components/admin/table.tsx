import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  align?: "start" | "end";
}

/** Server-rendered, accessible data table (horizontal scroll on small screens). */
export function AdminDataTable<T>({ rows, columns, rowKey, empty }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; empty: string }) {
  if (!rows.length) return <p className="card px-4 py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-border bg-bg text-xs uppercase tracking-wide text-muted">
          <tr>
            {columns.map((c, i) => (
              <th key={i} scope="col" className={cn("px-4 py-3 font-medium", c.align === "end" ? "text-end" : "text-start")}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-bg/60">
              {columns.map((c, i) => (
                <td key={i} className={cn("px-4 py-3 align-top", c.align === "end" && "text-end", c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FilterBar({ children, action }: { children: React.ReactNode; action?: string }) {
  return (
    <form method="get" action={action} className="card mb-5 flex flex-wrap items-end gap-3 p-4">
      {children}
    </form>
  );
}
