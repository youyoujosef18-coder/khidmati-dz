"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { useI18n } from "@/lib/i18n/client";

type ConfirmOptions = { title?: string; message: string; confirmLabel?: string; danger?: boolean };
const Ctx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

/** In-app confirmation dialog for destructive actions (keyboard & touch accessible). */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog open={Boolean(opts)} onOpenChange={(o) => !o && close(false)} title={opts?.title ?? t("common.confirmAction")}>
        <p className="text-sm text-text">{opts?.message}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => close(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant={opts?.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
            {opts?.confirmLabel ?? t("common.confirm")}
          </Button>
        </div>
      </Dialog>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
