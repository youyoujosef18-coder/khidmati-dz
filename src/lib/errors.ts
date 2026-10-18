/** Business error whose `code` is an i18n key under `errors.` */
export class AppError extends Error {
  constructor(
    public code: string,
    public status: number = 400,
    public params?: Record<string, string | number>,
  ) {
    super(code);
    this.name = "AppError";
  }
}

export const forbidden = () => new AppError("forbidden", 403);
export const notFound = () => new AppError("not_found", 404);

/** Postgres error helpers */
export function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}
export function pgConstraint(err: unknown): string | undefined {
  const e = err as { constraint_name?: string; cause?: { constraint_name?: string } };
  return e?.constraint_name ?? e?.cause?.constraint_name;
}
