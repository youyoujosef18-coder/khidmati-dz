import { requireTechContext } from "@/lib/services/tech-context";
import { ConversationsPage } from "@/components/messaging/conversations-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireTechContext();
  return <ConversationsPage user={user} side="technician" base="/technicien/messages" selectedId={(await params).id} />;
}
