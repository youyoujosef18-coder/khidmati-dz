"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { AddressForm, type AddressValue } from "@/components/forms/address-form";
import { ActionButton } from "@/components/forms/simple-action-button";
import { archiveAddressAction } from "@/app/actions/client";
import { useI18n } from "@/lib/i18n/client";
import type { WilayaOption } from "@/components/marketplace/location-picker";

type Row = AddressValue & { communeFr: string; communeAr: string; wilayaFr: string; wilayaAr: string };

export function AddressManager({ addresses, wilayas }: { addresses: Row[]; wilayas: WilayaOption[] }) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<Row | null | "new">(null);
  const ar = locale === "ar-DZ";
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden /> {t("client.addAddress")}
        </Button>
      </div>
      {addresses.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                  <div>
                    <p className="font-medium text-ink">
                      {a.label} {a.isDefault && <Badge tone="primary" className="ms-1">{t("client.defaultBadge")}</Badge>}
                    </p>
                    <p className="text-sm text-muted">{a.addressLine}{a.neighborhood ? `, ${a.neighborhood}` : ""}</p>
                    <p className="text-sm text-muted">{ar ? a.communeAr : a.communeFr}, {ar ? a.wilayaAr : a.wilayaFr}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={t("common.edit")} onClick={() => setEditing(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ActionButton variant="ghost" size="icon" aria-label={t("common.delete")} run={() => archiveAddressAction(a.id)} confirm={t("common.areYouSure")}>
                    <Trash2 className="h-4 w-4 text-error" />
                  </ActionButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<MapPin className="h-6 w-6" />} title={t("client.addressesEmpty")} />
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? t("client.addAddress") : t("common.edit")}>
        {editing !== null && <AddressForm wilayas={wilayas} initial={editing === "new" ? undefined : editing} onSaved={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}
