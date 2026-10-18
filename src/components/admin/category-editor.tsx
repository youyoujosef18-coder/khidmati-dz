"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { Input, Textarea, Checkbox, Select } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon, CATEGORY_ICONS } from "@/components/ui/icons";
import { saveCategoryAction } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";

export interface CategoryRow {
  id: string;
  slug: string;
  nameFr: string;
  nameAr: string;
  descriptionFr: string | null;
  descriptionAr: string | null;
  examplesFr: string[];
  examplesAr: string[];
  iconKey: string;
  isActive: boolean;
  sortOrder: number;
  techCount: number;
}

function CategoryForm({ initial, onDone }: { initial?: CategoryRow; onDone: () => void }) {
  const { t } = useI18n();
  return (
    <ActionForm action={saveCategoryAction as FormAction} onSuccess={onDone} className="space-y-4">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="slug" label={t("admin.slug")}>{(p) => <Input {...p} defaultValue={initial?.slug} required pattern="[a-z0-9-]{2,40}" dir="ltr" />}</Field>
        <Field name="iconKey" label={t("admin.icon")}>
          {(p) => (
            <Select {...p} defaultValue={initial?.iconKey ?? "wrench"}>
              {Object.keys(CATEGORY_ICONS).map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
          )}
        </Field>
        <Field name="nameFr" label={t("admin.nameFr")}>{(p) => <Input {...p} defaultValue={initial?.nameFr} required />}</Field>
        <Field name="nameAr" label={t("admin.nameAr")}>{(p) => <Input {...p} defaultValue={initial?.nameAr} required dir="rtl" lang="ar" />}</Field>
        <Field name="descriptionFr" label={t("admin.descriptionFr")}>{(p) => <Textarea {...p} rows={2} defaultValue={initial?.descriptionFr ?? ""} />}</Field>
        <Field name="descriptionAr" label={t("admin.descriptionAr")}>{(p) => <Textarea {...p} rows={2} defaultValue={initial?.descriptionAr ?? ""} dir="rtl" lang="ar" />}</Field>
        <Field name="examplesFr" label={t("admin.examplesFr")}>{(p) => <Textarea {...p} rows={4} defaultValue={initial?.examplesFr.join("\n")} />}</Field>
        <Field name="examplesAr" label={t("admin.examplesAr")}>{(p) => <Textarea {...p} rows={4} defaultValue={initial?.examplesAr.join("\n")} dir="rtl" lang="ar" />}</Field>
        <Field name="sortOrder" label={t("admin.sortOrder")}>{(p) => <Input {...p} type="number" min={0} defaultValue={initial?.sortOrder ?? 100} />}</Field>
        <label className="flex items-center gap-2 self-end pb-3 text-sm"><Checkbox name="isActive" value="on" defaultChecked={initial?.isActive ?? true} /> {t("admin.active")}</label>
      </div>
      <SubmitButton className="w-full">{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}

export function CategoryEditor({ rows }: { rows: CategoryRow[] }) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<CategoryRow | "new" | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> {t("admin.newCategory")}</Button>
      </div>
      <ul className="card divide-y divide-border">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center gap-4 px-4 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary-50 text-primary"><CategoryIcon iconKey={c.iconKey} className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{locale === "ar-DZ" ? c.nameAr : c.nameFr} <span className="text-xs text-muted">/{c.slug}</span></p>
              <p className="text-xs text-muted">{c.nameFr} · <span lang="ar">{c.nameAr}</span> · {t("pages.techCount", { count: c.techCount })}</p>
            </div>
            <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? t("admin.active") : t("admin.inactive")}</Badge>
            <Button variant="ghost" size="icon" aria-label={t("common.edit")} onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={t("admin.categoryForm")} className="sm:max-w-2xl">
        {editing !== null && <CategoryForm initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}
