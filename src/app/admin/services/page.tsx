import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PriceDisplay, StatusBadge } from "@/components/shared/display";
import { InlineActionForm, ReasonDialogButton } from "@/components/admin/forms";
import { ActionButton } from "@/components/forms/simple-action-button";
import type { FormAction } from "@/components/forms/action-form";
import { moderatePortfolioAction, moderateServiceAction } from "@/app/actions/admin";

export default async function ServicesModeration() {
  await requirePermission("services.moderate");
  const { t, pick } = await getI18n();
  const [pending, portfolio] = await Promise.all([
    db
      .select({ s: schema.technicianServices, tp: schema.technicianProfiles, cat: schema.serviceCategories })
      .from(schema.technicianServices)
      .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.technicianServices.technicianId))
      .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.technicianServices.categoryId))
      .where(eq(schema.technicianServices.approvalStatus, "pending"))
      .orderBy(asc(schema.technicianServices.updatedAt))
      .limit(100),
    db
      .select({ p: schema.portfolioItems, name: schema.technicianProfiles.publicName })
      .from(schema.portfolioItems)
      .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.portfolioItems.technicianId))
      .orderBy(desc(schema.portfolioItems.createdAt))
      .limit(48),
  ]);
  return (
    <>
      <PageHeader title={t("admin.nav.services")} />
      <Card className="mb-6">
        <CardHeader title={t("admin.servicesQueue")} />
        {pending.length ? (
          <ul className="divide-y divide-border">
            {pending.map(({ s, tp, cat }) => (
              <li key={s.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink" dir="auto">{s.title} <StatusBadge kind="verification" status={tp.verificationStatus} /></p>
                  <p className="text-sm text-muted"><Link href={`/admin/verification/${tp.id}`} className="text-primary underline">{tp.publicName}</Link> · {pick(cat, "name")} · <PriceDisplay minor={s.startingPriceMinor} model={s.pricingModel} /></p>
                  {s.description && <p className="mt-1 text-sm" dir="auto">{s.description}</p>}
                </div>
                <div className="flex gap-2">
                  <InlineActionForm action={moderateServiceAction as FormAction} hidden={{ serviceId: s.id, status: "approved" }} submitLabel={t("admin.approve")} />
                  <ReasonDialogButton action={moderateServiceAction as FormAction} hidden={{ serviceId: s.id, status: "rejected" }} label={t("admin.reject")} danger />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <CardBody><EmptyState title={t("states.emptyTitle")} /></CardBody>
        )}
      </Card>
      <Card>
        <CardHeader title={t("admin.portfolioModeration")} />
        <CardBody>
          {portfolio.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
              {portfolio.map(({ p, name }) => (
                <li key={p.id} className="overflow-hidden rounded-md border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/${p.fileId}`} alt={p.caption ?? ""} className="aspect-square w-full object-cover" loading="lazy" />
                  <div className="space-y-1 p-2 text-xs">
                    <p className="truncate font-medium">{name}</p>
                    <StatusBadge kind="moderation" status={p.moderationStatus} />
                    <ActionButton size="sm" variant="ghost" run={moderatePortfolioAction.bind(null, p.id, p.moderationStatus === "published" ? "hidden" : "published")}>
                      {p.moderationStatus === "published" ? t("admin.hide") : t("admin.publish")}
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t("states.emptyTitle")} />
          )}
        </CardBody>
      </Card>
    </>
  );
}
