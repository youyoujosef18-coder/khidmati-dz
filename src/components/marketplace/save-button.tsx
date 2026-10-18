"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleSavedAction } from "@/app/actions/client";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function SaveTechnicianButton({ technicianId, initial, loggedIn }: { technicianId: string; initial: boolean; loggedIn: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  if (!loggedIn) {
    return (
      <a href="/connexion" className="inline-flex h-11 items-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-bg">
        <Heart className="h-4 w-4" aria-hidden /> {t("profile.save")}
      </a>
    );
  }
  return (
    <Button
      variant="outline"
      loading={pending}
      aria-pressed={saved}
      onClick={() =>
        start(async () => {
          const res = await toggleSavedAction(technicianId);
          if (!res.ok) return toast(t(res.message ?? "errors.unexpected"), "error");
          setSaved(Boolean((res.data as { saved: boolean } | undefined)?.saved));
        })
      }
    >
      <Heart className={cn("h-4 w-4", saved && "fill-error text-error")} aria-hidden />
      {saved ? t("profile.saved") : t("profile.save")}
    </Button>
  );
}
