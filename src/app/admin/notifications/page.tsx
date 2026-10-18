import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { listDeliveries } from "@/lib/services/admin";
import { channelStatus } from "@/lib/notify/adapters";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminDataTable } from "@/components/admin/table";
import { StatusBadge } from "@/components/shared/display";
import { ActionButton } from "@/components/forms/simple-action-button";
import { TemplatesForm } from "@/components/admin/templates-form";
import { retryDeliveriesAction } from "@/app/actions/admin";

const TYPES = [
  "verification_approved", "verification_rejected", "verification_info_required", "new_job_request", "quote_received", "quote_accepted",
  "booking_requested", "booking_confirmed", "booking_cancelled", "appointment_changed", "appointment_reminder", "completion_requested", "job_completed",
];

export default async function AdminNotifications() {
  await requirePermission("notifications.manage");
  const { t, dateTime } = await getI18n();
  const [deliveries, settings] = await Promise.all([listDeliveries(), getSettings()]);
  const ch = channelStatus();
  return (
    <>
      <PageHeader title={t("admin.nav.notifications")} />
      <Card className="mb-6">
        <CardHeader title={t("admin.channels")} action={<ActionButton size="sm" variant="outline" run={retryDeliveriesAction}>{t("admin.retryFailed")}</ActionButton>} />
        <CardBody className="grid gap-3 sm:grid-cols-4">
          {(["in_app", "email", "sms", "push"] as const).map((c) => (
            <div key={c} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{t(`enums.channel.${c}`)}</p>
              {c === "in_app" ? <Badge tone="success">{t("admin.channelConfigured", { provider: "database" })}</Badge> : ch[c] ? <Badge tone="success">{t("admin.channelConfigured", { provider: ch[c]! })}</Badge> : <Badge>{t("admin.channelNotConfigured")}</Badge>}
            </div>
          ))}
        </CardBody>
      </Card>
      <h2 className="mb-3 font-semibold text-ink">{t("admin.deliveries")}</h2>
      <AdminDataTable
        rows={deliveries}
        rowKey={(d) => d.delivery.id}
        empty={t("states.emptyTitle")}
        columns={[
          { header: t("common.date"), cell: (d) => dateTime(d.delivery.createdAt) },
          { header: t("admin.typeCol"), cell: (d) => <code className="text-xs">{d.type}</code> },
          { header: t("admin.channelCol"), cell: (d) => t(`enums.channel.${d.delivery.channel}`) },
          { header: t("common.status"), cell: (d) => <StatusBadge kind="delivery" status={d.delivery.deliveryStatus} /> },
          { header: t("admin.attempts"), cell: (d) => <span className="ltr-nums">{d.delivery.attemptCount}</span> },
          { header: "", cell: (d) => <span className="text-xs text-error">{d.delivery.lastError}</span> },
        ]}
      />
      <Card className="mt-6">
        <CardHeader title={t("admin.templates")} description={t("admin.templatesHint")} />
        <CardBody>
          <TemplatesForm types={TYPES} overrides={settings.notification_overrides} />
        </CardBody>
      </Card>
    </>
  );
}
