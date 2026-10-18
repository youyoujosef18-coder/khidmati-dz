import { requireRole } from "@/lib/auth/guards";
import { SettingsPageView } from "@/components/account/account-pages";

export default async function Page() {
  return <SettingsPageView user={await requireRole("client")} />;
}
