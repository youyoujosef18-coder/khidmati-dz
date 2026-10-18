import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { listAddresses } from "@/lib/services/addresses";
import { getActiveWilayas } from "@/lib/services/discovery";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PriceDisplay } from "@/components/shared/display";
import { FixedBookingForm } from "@/components/forms/fixed-booking-form";

export default async function FixedBookingPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const user = await requireRole("client");
  const { service } = await searchParams;
  if (!service || !/^[0-9a-f-]{36}$/i.test(service)) notFound();
  const [row] = await db
    .select({ svc: schema.technicianServices, tp: schema.technicianProfiles })
    .from(schema.technicianServices)
    .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.technicianServices.technicianId))
    .where(
      and(
        eq(schema.technicianServices.id, service),
        eq(schema.technicianServices.approvalStatus, "approved"),
        eq(schema.technicianServices.isActive, true),
        eq(schema.technicianServices.pricingModel, "fixed"),
        eq(schema.technicianProfiles.verificationStatus, "approved"),
      ),
    );
  if (!row || row.tp.userId === user.id) notFound();
  const { t } = await getI18n();
  const [addresses, wilayas, weekly, settings] = await Promise.all([
    listAddresses(user.id),
    getActiveWilayas(),
    db.select().from(schema.technicianAvailability).where(and(eq(schema.technicianAvailability.technicianId, row.tp.id), eq(schema.technicianAvailability.isActive, true))).orderBy(asc(schema.technicianAvailability.weekday)),
    getSettings(),
  ]);
  return (
    <>
      <PageHeader title={t("booking.fixedTitle")} backHref={`/techniciens/${row.tp.slug}`} backLabel={row.tp.publicName} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="p-5 md:p-6">
          <FixedBookingForm serviceId={row.svc.id} addresses={addresses} wilayas={wilayas} />
        </Card>
        <aside className="space-y-4">
          <Card>
            <CardHeader title={t("booking.service")} as="h3" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Avatar fileId={row.tp.avatarFileId} name={row.tp.publicName} size={40} />
                <span className="font-medium">{row.tp.publicName}</span>
              </div>
              <p className="font-medium text-ink" dir="auto">{row.svc.title}</p>
              <PriceDisplay minor={row.svc.startingPriceMinor} model={row.svc.pricingModel} />
              <p className="text-muted">{t("profile.duration", { duration: t("common.minutes", { count: row.svc.estimatedDurationMinutes }) })}</p>
              <p className="text-xs text-muted">{t("booking.holdExpires", { date: `${settings.fixed_price_hold_hours} h` })}</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("profile.weeklyHours")} as="h3" />
            <CardBody>
              <ul className="space-y-1 text-sm">
                {weekly.map((w) => (
                  <li key={w.id} className="flex justify-between">
                    <span className="text-muted">{t(`enums.weekday.${w.weekday}`)}</span>
                    <span className="ltr-nums">{w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
