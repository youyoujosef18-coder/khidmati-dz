import { requireTechContext } from "@/lib/services/tech-context";
import { SettingsPageView } from "@/components/account/account-pages";

export default async function Page() {
  const { user } = await requireTechContext();
  return <SettingsPageView user={user} />;
}
