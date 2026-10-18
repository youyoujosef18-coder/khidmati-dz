"use client";

import { useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ClientActionState } from "./action-form";

/** One-click action (e.g. "mark as read", "save to favorites"), no form fields. */
export function ActionButton({
  run,
  confirm,
  successMessage,
  children,
  ...props
}: {
  run: () => Promise<ClientActionState>;
  confirm?: string;
  successMessage?: string | false;
} & Omit<ButtonProps, "onClick">) {
  const [pending, start] = useTransition();
  const { t } = useI18n();
  const toast = useToast();
  const ask = useConfirm();
  return (
    <Button
      {...props}
      loading={pending}
      onClick={async () => {
        if (!navigator.onLine) return toast(t("errors.offline"), "error");
        if (confirm && !(await ask({ message: confirm, danger: true }))) return;
        start(async () => {
          const res = await run();
          if (!res) return; // redirected by the server
          if (!res.ok) toast(t(res.message ?? "errors.unexpected", res.params), "error");
          else if (successMessage !== false) toast(successMessage ?? t(res.message ?? "common.saved", res.params));
        });
      }}
    >
      {children}
    </Button>
  );
}
