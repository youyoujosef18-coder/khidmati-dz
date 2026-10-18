import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser, type CurrentUser } from "./session";
import { hasPermission, type Permission, type Role } from "./permissions";
import { AppError } from "@/lib/errors";

async function currentPath() {
  const h = await headers();
  return h.get("x-pathname") ?? "/";
}

/** For pages: redirect to login when unauthenticated. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(await currentPath())}`);
  return user;
}

/** For pages: require one of the roles or show the unauthorized page. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.some((r) => user.roles.includes(r))) redirect("/non-autorise");
  return user;
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user.roles, permission)) redirect("/non-autorise");
  return user;
}

/** For server actions / route handlers: throw instead of redirecting. */
export async function actionUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("unauthenticated", 401);
  return user;
}
export async function actionRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await actionUser();
  if (!roles.some((r) => user.roles.includes(r))) throw new AppError("forbidden", 403);
  return user;
}
export async function actionPermission(permission: Permission): Promise<CurrentUser> {
  const user = await actionUser();
  if (!hasPermission(user.roles, permission)) throw new AppError("forbidden", 403);
  return user;
}
