"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, parseInput, type ActionState } from "@/lib/action";
import { actionUser } from "@/lib/auth/guards";
import { rateLimitByIp } from "@/lib/rate-limit";
import { claimFirstAdmin } from "@/lib/services/bootstrap";

export async function claimFirstAdminAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  let go = false;
  const res = await runAction(async () => {
    const user = await actionUser();
    await rateLimitByIp("setup", 5, 3600);
    const { token } = parseInput(z.object({ token: z.string().trim().min(1, "validation.required").max(500) }), fd);
    await claimFirstAdmin(user, token);
    go = true;
  }, "setup.done");
  if (go) redirect("/admin");
  return res;
}
