import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { getDisputeForUser } from "@/lib/services/disputes";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { StatusBadge } from "@/components/shared/display";
import { DisputeThread } from "@/components/booking/dispute-thread";
import { ActionButton } from "@/components/forms/simple-action-button";
import { ReasonDialogButton } from "@/components/admin/forms";
import { ResolveDisputeForm } from "@/components/admin/resolve-dispute";
import type { FormAction } from "@/components/forms/action-form";
import { assignDisputeAction, requestDisputeInfoAction } from "@/app/actions/admin";

export default async function DisputeDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission("disputes.handle");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getDisputeForUser(staff, id);
  if (!d) notFound();
  const { t, dateTime } = await getI18n();
  const [assignee] = d.dispute.assignedTo ? await db.select({ name: schema.profiles.fullName }).from(schema.profiles).where(eq(schema.profiles.id, d.dispute.assignedTo)) : [];
  const open = !["resolved", "closed"].includes(d.dispute.status);
  return (
    <>
      <PageHeader backHref="/admin/litiges" backLabel={t("admin.disputesQueue")} title={t("dispute.title", { ref: d.dispute.reference })} description={<StatusBadge kind="dispute" status={d.dispute.status} />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title={t(`enums.disputeCategory.${d.dispute.category}`)} description={dateTime(d.dispute.createdAt)} />
          <CardBody>
            <p className="mb-5 whitespace-pre-line text-sm" dir="auto">{d.dispute.description}</p>
            {d.dispute.resolution && <Notice tone="success" title={t("dispute.resolution")} className="mb-5">{d.dispute.resolution}</Notice>}
            <DisputeThread disputeId={d.dispute.id} isStaff closed={!open} evidence={d.evidence.map((e) => e.fileId)} messages={d.messages.map((m) => ({ ...m, mine: m.authorId === staff.id }))} />
          </CardBody>
        </Card>
        <aside className="space-y-4">
          <Card>
            <CardHeader title={t("booking.title", { ref: d.booking.reference })} as="h3" />
            <CardBody className="space-y-2 text-sm">
              <p dir="auto">{d.booking.title}</p>
              <p>{t("booking.client")} : {d.clientName}</p>
              <p>{t("booking.technician")} : {d.techName}</p>
              <p className="text-muted">{t("dispute.previousStatus")} : {t(`status.booking.${d.dispute.previousBookingStatus}`)}</p>
              <Link href={`/admin/reservations/${d.booking.id}`} className="text-primary underline">{t("common.details")}</Link>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={assignee ? t("dispute.assigned", { name: assignee.name }) : t("dispute.unassigned")} as="h3" />
            <CardBody className="flex flex-wrap gap-2">
              {open && d.dispute.assignedTo !== staff.id && <ActionButton size="sm" variant="outline" run={assignDisputeAction.bind(null, id, staff.id)}>{t("dispute.assign")}</ActionButton>}
              {open && ["open", "under_review"].includes(d.dispute.status) && (
                <ReasonDialogButton action={requestDisputeInfoAction as FormAction} hidden={{ disputeId: id }} label={t("dispute.requestInfo")} reasonName="message" reasonLabel={t("common.description")} />
              )}
            </CardBody>
          </Card>
          {open && (
            <Card>
              <CardHeader title={t("dispute.resolve")} as="h3" />
              <CardBody><ResolveDisputeForm disputeId={id} /></CardBody>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
