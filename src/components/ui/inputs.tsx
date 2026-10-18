import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const field =
  "block w-full rounded-md border border-border-strong bg-surface px-3.5 text-[0.95rem] text-text placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15 disabled:bg-bg disabled:text-muted aria-[invalid=true]:border-error aria-[invalid=true]:focus:ring-error/15";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(field, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(field, "py-2.5 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        field,
        "h-11 appearance-none bg-[length:16px] bg-[position:right_0.75rem_center] bg-no-repeat pe-9 rtl:bg-[position:left_0.75rem_center]",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23667085%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-border-strong accent-primary", className)}
      {...props}
    />
  );
}

export function Radio({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="radio" className={cn("h-5 w-5 shrink-0 cursor-pointer accent-primary", className)} {...props} />;
}
