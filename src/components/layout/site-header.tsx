import { getCurrentUser } from "@/lib/auth/session";
import { homeForRoles, isStaff } from "@/lib/auth/permissions";
import { unreadNotificationCount } from "@/lib/services/support";
import { HeaderClient } from "./header-client";

export async function SiteHeader() {
  const user = await getCurrentUser().catch(() => null);
  const unread = user ? await unreadNotificationCount(user.id).catch(() => 0) : 0;
  return (
    <HeaderClient
      user={
        user
          ? {
              name: user.displayName,
              avatarFileId: user.avatarFileId,
              home: homeForRoles(user.roles),
              isClient: user.roles.includes("client"),
              isTech: user.roles.includes("technician"),
              isStaff: isStaff(user.roles),
              notificationsHref: user.roles.includes("technician") && !user.roles.includes("client") ? "/technicien/notifications" : "/client/notifications",
            }
          : null
      }
      unread={unread}
    />
  );
}
