import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { getI18n } from "@/lib/i18n/server";
import { getBookingDetail } from "@/lib/services/bookings";
import { TERMINAL_BOOKING_STATUSES, type BookingStatus } from "@/lib/domain/state-machines";
import { BookingDetailView } from "@/components/booking/booking-detail";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ReasonDialogButton } from "@/components/admin/forms";
import type { FormAction } from "@/components/forms/action-form";
import { staffCancelBookingAction } from "@/app/actions/admin";

export default async function AdminBookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission("bookings.read_all");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getBookingDetail(staff, id);
  if (!detail) notFound();
  const { t } = await getI18n();
  const status = detail.booking.status as BookingStatus;
  const canIntervene = hasPermission(staff.roles, "bookings.intervene") && !TERMINAL_BOOKING_STATUSES.includes(status) && status !== "disputed";
  return (
    <>
      <Card className="mb-6">
        <CardHeader title={t("admin.intervene")} />
        <CardBody className="flex flex-wrap gap-2">
          {canIntervene && (
            <ReasonDialogButton action={staffCancelBookingAction as FormAction} hidden={{ bookingId: id }} label={t("admin.forceCancel")} danger />
          )}
          {detail.dispute && <ButtonLink href={`/admin/litiges/${detail.dispute.id}`} variant="outline" size="sm">{t("booking.viewDispute")}</ButtonLink>}
        </CardBody>
      </Card>
      <BookingDetailView detail={detail} actor={staff} basePath="/admin/reservations" />
    </>
  );
}
