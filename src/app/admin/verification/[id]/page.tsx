import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { getI18n } from "@/lib/i18n/server";
import { getCompleteness, getTechnicianWorkspace } from "@/lib/services/technicians";
import { allowedTransitionsFor } from "@/lib/services/verification-helpers";
import { formatPhone } from "@/lib/phone";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Notice } from "@/components/ui/states";
import { PriceDisplay, StatusBadge, DateTime } from "@/components/shared/display";
import { DecisionForm } from "@/components/admin/decision-form";

export default async function VerificationDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission("verification.review");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [tp] = await db.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.id, id));
  if (!tp) notFound();
  const { t, pick, dateTime } = await getI18n();
  const [ws, completeness, [account]] = await Promise.all([
    getTechnicianWorkspace(tp),
    getCompleteness(tp),
    db.select({ phone: schema.users.phone, email: schema.users.email, status: schema.profiles.accountStatus, createdAt: schema.users.createdAt })
      .from(schema.users).innerJoin(schema.profiles, eq(schema.profiles.id, schema.users.id)).where(eq(schema.users.id, tp.userId)),
  ]);
  const canDocs = hasPermission(staff.roles, "verification.documents.read");
  const allowed = tp.userId === staff.id ? [] : allowedTransitionsFor(tp.verificationStatus);
  return (
    <>
      <PageHeader backHref="/admin/verification" backLabel={t("admin.nav.verification")} title={tp.publicName} description={<StatusBadge kind="verification" status={tp.verificationStatus} />} />
      {completeness.missing.length > 0 && <Notice tone="warning" className="mb-5">{t("errors.profile_incomplete", { missing: completeness.missing.map((m) => t(`tech.missing.${m}`)).join(", ") })}</Notice>}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardBody className="flex flex-col gap-4 sm:flex-row">
              <Avatar fileId={tp.avatarFileId} name={tp.publicName} size={88} />
              <dl className="grid flex-1 gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted">{t("tech.legalName")}</dt><dd className="font-medium">{tp.legalName}</dd></div>
                <div><dt className="text-muted">{t("tech.experienceYears")}</dt><dd className="ltr-nums">{tp.experienceYears}</dd></div>
                <div><dt className="text-muted">{t("auth.phone")}</dt><dd className="ltr-nums">{account?.phone ? formatPhone(account.phone) : "—"}</dd></div>
                <div><dt className="text-muted">{t("auth.email")}</dt><dd className="ltr-nums">{account?.email ?? "—"}</dd></div>
                <div><dt className="text-muted">{t("admin.accountStatus")}</dt><dd>{account && <StatusBadge kind="account" status={account.status} />}</dd></div>
                <div><dt className="text-muted">{t("tech.workingLanguages")}</dt><dd>{tp.workingLanguages.map((l) => t(`enums.language.${l}`)).join(", ")}</dd></div>
              </dl>
            </CardBody>
            <CardBody className="border-t border-border">
              <p className="whitespace-pre-line text-sm" dir="auto">{tp.bio || "—"}</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("admin.documents")} description={t("admin.documentAccessLogged")} />
            <CardBody>
              {!canDocs ? (
                <Notice tone="warning">{t("errors.forbidden")}</Notice>
              ) : ws.documents.length ? (
                <ul className="divide-y divide-border text-sm">
                  {ws.documents.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <FileText className="h-4 w-4 text-muted" aria-hidden />
                      <span className="font-medium">{t(`enums.documentType.${d.documentType}`)}</span>
                      <StatusBadge kind="approval" status={d.reviewStatus} />
                      <span className="text-xs text-muted"><DateTime value={d.createdAt} /></span>
                      <a href={`/api/files/${d.fileId}`} target="_blank" rel="noopener" className="ms-auto text-primary underline">{t("admin.viewDocument")}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t("tech.documentsEmpty")}</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={`${t("profile.services")} · ${t("profile.areas")}`} />
            <CardBody className="space-y-4 text-sm">
              <ul className="space-y-2">
                {ws.services.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span dir="auto">{s.title}</span>
                    <span className="flex items-center gap-2"><PriceDisplay minor={s.startingPriceMinor} model={s.pricingModel} /><StatusBadge kind="approval" status={s.approvalStatus} /></span>
                  </li>
                ))}
              </ul>
              <p className="text-muted">
                {ws.areas.map((a) => `${pick(a, "wilaya")}${a.communeFr ? ` / ${pick(a, "commune")}` : ""}`).join(" · ") || "—"}
              </p>
              <p className="text-muted">{t("profile.travelRadius", { km: tp.travelRadiusKm })}</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("tech.verificationHistory")} />
            <ul className="divide-y divide-border text-sm">
              {ws.history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                  <span className="flex items-center gap-2"><StatusBadge kind="verification" status={h.newStatus} /> {h.reason && <span className="text-muted">{h.reason}</span>}</span>
                  <span className="text-xs text-muted">{dateTime(h.createdAt)}</span>
                </li>
              ))}
              {!ws.history.length && <li className="px-5 py-3 text-muted">{t("tech.noHistory")}</li>}
            </ul>
          </Card>
        </div>
        <aside>
          <Card className="xl:sticky xl:top-20">
            <CardHeader title={t("common.actions")} as="h3" />
            <CardBody>
              {allowed.length ? (
                <DecisionForm
                  technicianId={tp.id}
                  allowed={allowed}
                  categories={ws.categories.map((c) => ({ id: c.categoryId, name: pick(c, "name"), status: c.approvalStatus, isPrimary: c.isPrimary }))}
                />
              ) : (
                <p className="text-sm text-muted">{t("errors.invalid_transition")}</p>
              )}
              {tp.verificationStatus === "approved" && (
                <Link href={`/techniciens/${tp.slug}`} className="mt-4 block text-sm text-primary underline">{t("tech.previewPublic")}</Link>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
