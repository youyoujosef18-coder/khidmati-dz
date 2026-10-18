"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/inputs";
import { useI18n } from "@/lib/i18n/client";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pe-12" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute end-1 top-1/2 grid h-9 w-10 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-ink/5"
        aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
        aria-pressed={show}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
