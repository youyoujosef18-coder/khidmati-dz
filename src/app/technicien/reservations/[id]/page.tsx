import { notFound } from "next/navigation";
import { requireTechContext } from "@/lib/services/tech-context";
import { getBookingDetail } from "@/lib/services/bookings";
import { BookingDetailView } from "@/components/booking/booking-detail";
import { Receipt } from "@/components/booking/receipt";

export default async function TechBookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ recu?: string }> }) {
  const { user } = await requireTechContext();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getBookingDetail(user, id);
  if (!detail || detail.viewer !== "technician") notFound();
  if ((await searchParams).recu && detail.booking.status === "completed") return <Receipt detail={detail} />;
  return <BookingDetailView detail={detail} actor={user} basePath="/technicien/reservations" />;
}
