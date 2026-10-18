import { requireTechContext } from "@/lib/services/tech-context";
import { NotificationsPageView } from "@/components/account/account-pages";

export default async function Page({ searchParams }: { searchParams: Promise<{ filtre?: string; page?: string }> }) {
  const { user } = await requireTechContext();
  return <NotificationsPageView user={user} base="/technicien/notifications" sp={await searchParams} />;
}
