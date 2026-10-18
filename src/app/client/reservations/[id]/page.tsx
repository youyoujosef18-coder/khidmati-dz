import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getBookingDetail } from "@/lib/services/bookings";
import { BookingDetailView } from "@/components/booking/booking-detail";
import { Receipt } from "@/components/booking/receipt";

export default async function ClientBookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("client");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getBookingDetail(user, id);
  if (!detail || detail.viewer !== "client") notFound();
  if (sp.recu && detail.booking.status === "completed") return <Receipt detail={detail} />;
  const banner = sp.confirmee ? "quote.accepted" : sp.envoyee ? "booking.fixedCreated" : undefined;
  return <BookingDetailView detail={detail} actor={user} basePath="/client/reservations" banner={banner} />;
}
