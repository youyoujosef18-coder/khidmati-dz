import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { AdminDataTable } from "@/components/admin/table";
import { Stars, StatusBadge } from "@/components/shared/display";
import { ReasonDialogButton } from "@/components/admin/forms";
import type { FormAction } from "@/components/forms/action-form";
import { moderateReviewAction } from "@/app/actions/admin";

export default async function ReviewsModeration() {
  await requirePermission("reviews.moderate");
  const { t, date } = await getI18n();
  const rows = await db
    .select({ r: schema.reviews, tech: schema.technicianProfiles.publicName, client: schema.profiles.fullName })
    .from(schema.reviews)
    .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.reviews.technicianId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.reviews.clientId))
    .orderBy(desc(schema.reviews.createdAt))
    .limit(100);
  return (
    <>
      <PageHeader title={t("admin.reviewsModeration")} />
      <Notice tone="neutral" className="mb-5">{t("admin.moderationPolicy")}</Notice>
      <AdminDataTable
        rows={rows}
        rowKey={(x) => x.r.id}
        empty={t("states.emptyTitle")}
        columns={[
          { header: t("booking.rating"), cell: (x) => <Stars value={x.r.rating} /> },
          { header: t("booking.comment"), cell: (x) => <span className="line-clamp-3 max-w-md" dir="auto">{x.r.comment ?? "—"}</span> },
          { header: t("booking.technician"), cell: (x) => x.tech },
          { header: t("booking.client"), cell: (x) => x.client },
          { header: t("common.date"), cell: (x) => date(x.r.createdAt) },
          { header: t("common.status"), cell: (x) => <><StatusBadge kind="moderation" status={x.r.moderationStatus} />{x.r.moderationReason && <p className="mt-1 text-xs text-muted">{x.r.moderationReason}</p>}</> },
          {
            header: "",
            cell: (x) => (
              <ReasonDialogButton
                action={moderateReviewAction as FormAction}
                hidden={{ reviewId: x.r.id, status: x.r.moderationStatus === "published" ? "hidden" : "published" }}
                label={x.r.moderationStatus === "published" ? t("admin.hide") : t("admin.publish")}
                danger={x.r.moderationStatus === "published"}
              />
            ),
          },
        ]}
      />
    </>
  );
}
