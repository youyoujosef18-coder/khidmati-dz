"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ClientActionState {
  ok: boolean;
  message?: string;
  params?: Record<string, string | number>;
  fieldErrors?: Record<string, { key: string; params?: Record<string, string | number> }>;
  data?: unknown;
  at?: number;
}
export type FormAction = (prev: ClientActionState | null, fd: FormData) => Promise<ClientActionState>;

const FormCtx = createContext<{ state: ClientActionState | null; pending: boolean; formId: string }>({
  state: null,
  pending: false,
  formId: "",
});
export const useFormCtx = () => useContext(FormCtx);

/**
 * Accessible form wrapper around a server action:
 * - prevents double submission (pending state)
 * - keeps user input on recoverable errors (no automatic reset)
 * - refuses to submit while offline
 * - shows inline field errors + a form-level summary, and a toast on success
 */
export function ActionForm({
  action,
  children,
  className,
  successToast = true,
  resetOnSuccess = false,
  onSuccess,
  redirectTo,
  confirmMessage,
  ...rest
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  successToast?: boolean | string;
  resetOnSuccess?: boolean;
  onSuccess?: (state: ClientActionState) => void;
  redirectTo?: string;
  confirmMessage?: string;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit">) {
  const { t } = useI18n();
  const toast = useToast();
  // The success toast is raised from the action itself (not from an effect), because a
  // successful action refreshes the page and may replace this form before effects run.
  const [state, dispatch, pending] = useActionState(async (prev: ClientActionState | null, fd: FormData) => {
    const res = await action(prev, fd);
    if (res?.ok && successToast) toast(typeof successToast === "string" ? successToast : t(res.message ?? "common.saved", res.params));
    return res;
  }, null);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const formId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const ask = useConfirm();

  useEffect(() => {
    if (!state?.at) return;
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
      if (redirectTo) router.push(redirectTo);
    } else {
      summaryRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.at]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation(); // forms rendered in portals (dialogs) must not submit their parent form
    if (pending) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast(t("errors.offline"), "error");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name) fd.set(submitter.name, submitter.value);
    if (confirmMessage && !(await ask({ message: confirmMessage, danger: true }))) return;
    startTransition(() => dispatch(fd));
  }

  const showSummary = state && !state.ok && state.message;
  return (
    <FormCtx.Provider value={{ state, pending, formId }}>
      <form ref={ref} onSubmit={onSubmit} noValidate {...rest}>
        {showSummary && (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            className="mb-4 flex gap-2 rounded-md border border-error/25 bg-error-50 px-3.5 py-3 text-sm text-error outline-none"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="text-text">{t(state.message!, state.params)}</span>
          </div>
        )}
        {/* Layout classes apply to the fieldset so spacing utilities target the real fields */}
        <fieldset disabled={pending} className={cn("m-0 min-w-0 border-0 p-0", className)}>
          {children}
        </fieldset>
      </form>
    </FormCtx.Provider>
  );
}

export function SubmitButton({ children, className, ...props }: ButtonProps) {
  const { pending } = useFormCtx();
  return (
    <Button type="submit" loading={pending} className={className} {...props}>
      {children}
    </Button>
  );
}

/** Label + control + hint + inline error, wired with aria attributes. */
export function Field({
  name,
  label,
  hint,
  required,
  children,
  className,
  optionalLabel,
}: {
  name: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
  children: (p: { id: string; name: string; "aria-invalid"?: boolean; "aria-describedby"?: string; required?: boolean }) => React.ReactNode;
  className?: string;
  optionalLabel?: boolean;
}) {
  const { state, formId } = useFormCtx();
  const { t } = useI18n();
  const id = `${formId}-${name}`;
  const err = state?.fieldErrors?.[name];
  const describedBy = [hint ? `${id}-hint` : null, err ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
          {optionalLabel && <span className="ms-1 font-normal text-muted">({t("common.optional")})</span>}
        </label>
      )}
      {children({ id, name, "aria-invalid": err ? true : undefined, "aria-describedby": describedBy, required })}
      {hint && !err && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {err && (
        <p id={`${id}-err`} className="text-xs font-medium text-error">
          {t(err.key, err.params)}
        </p>
      )}
    </div>
  );
}

export function FieldError({ name }: { name: string }) {
  const { state } = useFormCtx();
  const { t } = useI18n();
  const err = state?.fieldErrors?.[name];
  if (!err) return null;
  return <p className="text-xs font-medium text-error">{t(err.key, err.params)}</p>;
}
