import "server-only";
import { unstable_rethrow } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { AppError } from "./errors";

export type FieldErrors = Record<string, { key: string; params?: Record<string, string | number> }>;

export interface ActionState<T = unknown> {
  ok: boolean;
  /** i18n key */
  message?: string;
  params?: Record<string, string | number>;
  fieldErrors?: FieldErrors;
  data?: T;
  /** increments so the client can react to repeated identical results */
  at?: number;
}

export class ValidationError extends Error {
  constructor(public fieldErrors: FieldErrors) {
    super("validation");
  }
}

function issueToKey(issue: z.core.$ZodIssue): { key: string; params?: Record<string, string | number> } {
  if (issue.message?.startsWith("validation.")) return { key: issue.message };
  switch (issue.code) {
    case "too_small": {
      const min = Number((issue as { minimum?: number | bigint }).minimum ?? 0);
      if ((issue as { origin?: string }).origin === "string")
        return min <= 1 ? { key: "validation.required" } : { key: "validation.tooShort", params: { min } };
      if ((issue as { origin?: string }).origin === "array") return { key: "validation.selectAtLeast", params: { min } };
      return { key: "validation.min", params: { min } };
    }
    case "too_big": {
      const max = Number((issue as { maximum?: number | bigint }).maximum ?? 0);
      if ((issue as { origin?: string }).origin === "string") return { key: "validation.tooLong", params: { max } };
      if ((issue as { origin?: string }).origin === "array") return { key: "validation.selectAtMost", params: { max } };
      return { key: "validation.max", params: { max } };
    }
    case "invalid_format":
      return (issue as { format?: string }).format === "email" ? { key: "validation.email" } : { key: "validation.format" };
    case "invalid_type":
      return { key: "validation.required" };
    case "invalid_value":
      return { key: "validation.choice" };
    default:
      return { key: "validation.invalid" };
  }
}

export function zodToFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_form";
    if (!out[path]) out[path] = issueToKey(issue);
  }
  return out;
}

/** Converts FormData into a plain object; repeated keys become arrays. */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    const value = typeof v === "string" ? v : v;
    if (k.endsWith("[]")) {
      const key = k.slice(0, -2);
      (obj[key] = (obj[key] as unknown[]) ?? []) as unknown[];
      (obj[key] as unknown[]).push(value);
    } else if (k in obj) {
      obj[k] = Array.isArray(obj[k]) ? [...(obj[k] as unknown[]), value] : [obj[k], value];
    } else {
      obj[k] = value;
    }
  }
  return obj;
}

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const res = schema.safeParse(input instanceof FormData ? formDataToObject(input) : input);
  if (!res.success) throw new ValidationError(zodToFieldErrors(res.error));
  return res.data;
}

/** Runs an action body and converts known errors into a serializable ActionState. */
export async function runAction<T>(
  fn: () => Promise<T | ActionState<T> | void>,
  successMessage = "common.saved",
): Promise<ActionState<T>> {
  try {
    const result = await fn();
    try {
      refresh(); // re-render the current route with fresh server data
    } catch {
      /* not inside a server action (tests) */
    }
    if (result && typeof result === "object" && "ok" in (result as object)) return { at: Date.now(), ...(result as ActionState<T>) };
    return { ok: true, message: successMessage, data: (result ?? undefined) as T | undefined, at: Date.now() };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ValidationError) {
      return { ok: false, message: "errors.validation", fieldErrors: err.fieldErrors, at: Date.now() };
    }
    if (err instanceof AppError) {
      return { ok: false, message: `errors.${err.code}`, params: err.params, at: Date.now() };
    }
    console.error("[action] unexpected error", err instanceof Error ? err.message : err);
    return { ok: false, message: "errors.unexpected", at: Date.now() };
  }
}
