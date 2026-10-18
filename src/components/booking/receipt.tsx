import { getI18n } from "@/lib/i18n/server";
import type { getBookingDetail } from "@/lib/services/bookings";
import { LogoMark } from "@/components/layout/logo";
import { PrintButton } from "./print-button";

type Detail = NonNullable<Awaited<ReturnType<typeof getBookingDetail>>>;

/** Printable completion summary (explicitly not a tax invoice). */
export async function Receipt({ detail }: { detail: Detail }) {
  const { t, dateTime, money, pick } = await getI18n();
  const b = detail.booking;
  const q = detail.quote;
  const lines: [string, number][] = q
    ? ([
        [t("quote.labor"), q.laborMinor],
        [t("quote.materials"), q.materialsMinor],
        [t("quote.travel"), q.travelMinor],
        [t("quote.other"), q.otherChargesMinor],
        [t("quote.tax"), q.taxMinor],
        [t("quote.discount"), -q.discountMinor],
      ] as [string, number][]).filter(([, v]) => v !== 0)
    : [[b.title, b.agreedTotalMinor]];
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end no-print">
        <PrintButton />
      </div>
      <article className="card p-8 print:border-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <LogoMark size={40} />
            <div>
              <p className="font-bold text-ink">{t("common.appName")}</p>
              <p className="text-xs text-muted">{t("booking.receiptTitle")}</p>
            </div>
          </div>
          <div className="text-end text-sm">
            <p className="font-semibold ltr-nums">{b.reference}</p>
            {b.completedAt && <p className="text-muted">{dateTime(b.completedAt)}</p>}
          </div>
        </header>
        <dl className="grid gap-3 py-5 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">{t("booking.service")}</dt><dd className="font-medium" dir="auto">{b.title}</dd></div>
          <div><dt className="text-muted">{t("booking.appointment")}</dt><dd>{dateTime(b.scheduledStartAt)}</dd></div>
          <div><dt className="text-muted">{t("booking.technician")}</dt><dd>{detail.techName}</dd></div>
          <div><dt className="text-muted">{t("booking.client")}</dt><dd>{detail.clientName}</dd></div>
          <div><dt className="text-muted">{t("booking.address")}</dt><dd>{pick(detail, "commune")}, {pick(detail, "wilaya")}</dd></div>
          <div><dt className="text-muted">{t("booking.payment")}</dt><dd>{t("booking.paymentCash")} — {t(`status.payment.${b.paymentStatus}`)}</dd></div>
        </dl>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border border-y border-border">
            {lines.map(([l, v]) => (
              <tr key={l}><td className="py-2">{l}</td><td className="py-2 text-end ltr-nums">{money(v)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold"><td className="py-3">{t("quote.total")}</td><td className="py-3 text-end ltr-nums">{money(b.agreedTotalMinor)}</td></tr>
          </tfoot>
        </table>
        <p className="mt-6 text-xs text-muted">{t("booking.receiptNote")}</p>
      </article>
    </div>
  );
}
