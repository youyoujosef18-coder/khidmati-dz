"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { LocationPicker, type WilayaOption } from "./location-picker";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export function WelcomeLocation({ wilayas }: { wilayas: WilayaOption[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [loc, setLoc] = useState({ wilaya: "", commune: "" });
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <LocationPicker wilayas={wilayas} anyLabel onChange={setLoc} />
      </div>
      <Button
        size="lg"
        className="w-full"
        onClick={() => {
          const p = new URLSearchParams();
          if (loc.wilaya) p.set("wilaya", loc.wilaya);
          if (loc.commune) p.set("commune", loc.commune);
          router.push(`/techniciens${p.size ? `?${p}` : ""}`);
        }}
      >
        <Search className="h-4 w-4" aria-hidden /> {t("auth.welcomeDiscover")}
      </Button>
    </div>
  );
}
