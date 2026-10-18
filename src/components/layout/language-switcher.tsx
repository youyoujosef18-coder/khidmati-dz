"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/app/actions/locale";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Switches language in place: client state (including form inputs) is preserved by router.refresh(). */
export function LanguageSwitcher({ className, compact }: { className?: string; compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = locale === "fr-DZ" ? "ar-DZ" : "fr-DZ";
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await setLocaleAction(next);
          router.refresh();
        })
      }
      disabled={pending}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-text hover:bg-ink/5 disabled:opacity-60",
        className,
      )}
      aria-label={`${t("common.language")}: ${next === "ar-DZ" ? "العربية" : "Français"}`}
      lang={next === "ar-DZ" ? "ar" : "fr"}
    >
      <Languages className="h-4 w-4" aria-hidden />
      {!compact && <span>{next === "ar-DZ" ? "العربية" : "Français"}</span>}
      {compact && <span>{next === "ar-DZ" ? "ع" : "FR"}</span>}
    </button>
  );
}
