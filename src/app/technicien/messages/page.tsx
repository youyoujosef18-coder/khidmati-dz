import { requireTechContext } from "@/lib/services/tech-context";
import { ConversationsPage } from "@/components/messaging/conversations-page";

export default async function Page() {
  const { user } = await requireTechContext();
  return <ConversationsPage user={user} side="technician" base="/technicien/messages" />;
}
