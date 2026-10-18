import { requireRole } from "@/lib/auth/guards";
import { ConversationsPage } from "@/components/messaging/conversations-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("client");
  return <ConversationsPage user={user} side="client" base="/client/messages" selectedId={(await params).id} />;
}
