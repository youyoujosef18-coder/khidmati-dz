import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, ROLES, STAFF_ROLES } from "@/lib/auth/permissions";
import { getI18n } from "@/lib/i18n/server";
import { getUserDetail } from "@/lib/services/admin";
import { formatPhone } from "@/lib/phone";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { StatusBadge } from "@/components/shared/display";
import { ActionButton } from "@/components/forms/simple-action-button";
import { InlineActionForm, ReasonDialogButton } from "@/components/admin/forms";
import type { FormAction } from "@/components/forms/action-form";
import { processDeletionAction, revokeSessionsAction, roleAction, setAccountStatusAction } from "@/app/actions/admin";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission("users.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const u = await getUserDetail(id);
  if (!u) notFound();
  const { t, dateTime } = await getI18n();
  const canSuspend = hasPermission(staff.roles, "users.suspend") && staff.id !== id;
  const canRoles = hasPermission(staff.roles, "users.roles") && staff.id !== id;
  const status = u.profile.accountStatus;
  return (
    <>
      <PageHeader backHref="/admin/utilisateurs" backLabel={t("admin.nav.users")} title={u.profile.fullName} description={<StatusBadge kind="account" status={status} />} />
      {u.profile.statusReason && <Notice tone="warning" className="mb-5">{u.profile.statusReason}</Notice>}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("admin.userDetail")} />
            <CardBody>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted">{t("auth.email")}</dt><dd className="ltr-nums">{u.user.email ?? "—"} {u.user.emailVerifiedAt && "✓"}</dd></div>
                <div><dt className="text-muted">{t("auth.phone")}</dt><dd className="ltr-nums">{u.user.phone ? formatPhone(u.user.phone) : "—"} {u.user.phoneVerifiedAt && "✓"}</dd></div>
                <div><dt className="text-muted">{t("common.createdAt")}</dt><dd>{dateTime(u.user.createdAt)}</dd></div>
                <div><dt className="text-muted">{t("account.sessions")}</dt><dd className="ltr-nums">{u.activeSessions}</dd></div>
                <div><dt className="text-muted">{t("client.nav.bookings")}</dt><dd className="ltr-nums">{u.bookingsCount}</dd></div>
                {u.tech && (
                  <div>
                    <dt className="text-muted">{t("enums.role.technician")}</dt>
                    <dd><Link href={`/admin/verification/${u.tech.id}`} className="text-primary underline">{u.tech.publicName}</Link> <StatusBadge kind="verification" status={u.tech.verificationStatus} /></dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("admin.accountHistory")} />
            <ul className="divide-y divide-border text-sm">
              {u.audit.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
                  <span><code className="rounded bg-bg px-1.5 py-0.5 text-xs">{a.action}</code> {a.reason && <span className="text-muted">— {a.reason}</span>}</span>
                  <span className="text-xs text-muted">{dateTime(a.createdAt)}</span>
                </li>
              ))}
              {!u.audit.length && <li className="px-5 py-4 text-muted">{t("states.emptyTitle")}</li>}
            </ul>
          </Card>
          {u.reports.length > 0 && (
            <Card>
              <CardHeader title={t("admin.nav.reports")} />
              <ul className="divide-y divide-border text-sm">
                {u.reports.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 px-5 py-2.5">
                    <span>{t(`enums.reportReason.${r.reason}`)} {r.description && <span className="text-muted">— {r.description}</span>}</span>
                    <StatusBadge kind="report" status={r.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <aside className="space-y-4">
          {canSuspend && (
            <Card>
              <CardHeader title={t("common.actions")} as="h3" />
              <CardBody className="flex flex-wrap gap-2">
                {status === "active" && <ReasonDialogButton action={setAccountStatusAction as FormAction} hidden={{ userId: id, status: "suspended" }} label={t("admin.suspend")} danger />}
                {status === "suspended" && <ReasonDialogButton action={setAccountStatusAction as FormAction} hidden={{ userId: id, status: "active" }} label={t("admin.reactivate")} />}
                <ActionButton variant="outline" size="sm" run={revokeSessionsAction.bind(null, id)}>{t("admin.revokeSessions")}</ActionButton>
                {status === "deletion_requested" && hasPermission(staff.roles, "users.deletion") && (
                  <ActionButton variant="danger" size="sm" run={processDeletionAction.bind(null, id)} confirm={t("common.irreversible")}>{t("admin.processDeletion")}</ActionButton>
                )}
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title={t("admin.roles")} as="h3" />
            <CardBody className="space-y-2 text-sm">
              {ROLES.map((r) => {
                const has = u.roles.includes(r);
                const manageable = canRoles && STAFF_ROLES.includes(r);
                return (
                  <div key={r} className="flex items-center justify-between gap-2">
                    <span className={has ? "font-medium text-ink" : "text-muted"}>{t(`enums.role.${r}`)} {has && "✓"}</span>
                    {manageable && (
                      <InlineActionForm
                        action={roleAction as FormAction}
                        hidden={{ userId: id, role: r, op: has ? "revoke" : "grant" }}
                        submitLabel={has ? t("admin.revokeRole") : t("admin.grantRole")}
                        variant={has ? "ghost" : "outline"}
                        confirm={t("common.areYouSure")}
                      />
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
