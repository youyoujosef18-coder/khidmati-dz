import { requireRole } from "@/lib/auth/guards";
import { NotificationsPageView } from "@/components/account/account-pages";

export default async function Page({ searchParams }: { searchParams: Promise<{ filtre?: string; page?: string }> }) {
  return <NotificationsPageView user={await requireRole("client")} base="/client/notifications" sp={await searchParams} />;
}
