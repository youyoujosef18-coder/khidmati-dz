import { requireRole } from "@/lib/auth/guards";
import { ProfilePageView } from "@/components/account/account-pages";

export default async function Page() {
  return <ProfilePageView user={await requireRole("client")} />;
}
