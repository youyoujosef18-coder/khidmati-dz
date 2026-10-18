import Link from "next/link";
import { Check, CircleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { getCompleteness, getTechnicianForUser, getTechnicianWorkspace } from "@/lib/services/technicians";
import { getActiveCategories, getActiveWilayas } from "@/lib/services/discovery";
import { areasValue, availabilityValue, profileValue, servicesValue } from "@/lib/services/tech-forms";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/display";
import { OnboardingAreas, OnboardingAvailability, OnboardingProfile } from "@/components/tech/onboarding-client";
import { ServicesEditor } from "@/components/tech/services-editor";
import { DocumentsManager } from "@/components/tech/documents-manager";
import { SubmitApplication } from "@/components/tech/submit-application";
import { StartOnboarding } from "@/components/tech/start-onboarding";
import { cn } from "@/lib/utils";

const STEPS = ["stepProfile", "stepAreas", "stepServices", "stepAvailability", "stepDocuments", "stepReview"] as const;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const tp = await getTechnicianForUser(user.id);
  if (!tp) return <StartOnboarding />;
  const { t, pick } = await getI18n();
  const step = Math.min(6, Math.max(1, Number((await searchParams).etape) || 1));
  const [ws, completeness, categories, wilayas] = await Promise.all([getTechnicianWorkspace(tp), getCompleteness(tp), getActiveCategories(), getActiveWilayas()]);
  const myCategories = ws.categories.map((c) => ({ id: c.categoryId, name: pick(c, "name") }));
  const canEdit = !["submitted", "under_review"].includes(tp.verificationStatus);

  return (
    <>
      <PageHeader title={t("tech.onboardingTitle")} description={t("tech.onboardingSubtitle")} actions={<StatusBadge kind="verification" status={tp.verificationStatus} />} />
      <nav aria-label={t("tech.onboardingTitle")} className="mb-6 overflow-x-auto">
        <ol className="flex min-w-max gap-2">
          {STEPS.map((k, i) => (
            <li key={k}>
              <Link
                href={`/technicien/inscription?etape=${i + 1}`}
                aria-current={step === i + 1 ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                  step === i + 1 ? "border-primary bg-primary text-white" : "border-border bg-surface text-muted hover:text-ink",
                )}
              >
                <span className="ltr-nums">{i + 1}</span> {t(`tech.${k}`)}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      {!canEdit && <Notice tone="info" className="mb-5">{t("status.verification.under_review")} — {t("tech.submitBody")}</Notice>}
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader title={t(`tech.${STEPS[step - 1]}`)} />
          <CardBody className="p-5 md:p-6">
            {step === 1 && <OnboardingProfile initial={profileValue(tp)} />}
            {step === 2 && <OnboardingAreas categories={categories.map((c) => ({ id: c.id, nameFr: c.nameFr, nameAr: c.nameAr }))} wilayas={wilayas} initial={areasValue(tp, ws)} />}
            {step === 3 && (
              <>
                {myCategories.length ? (
                  <ServicesEditor services={servicesValue(ws)} categories={myCategories} approved={false} />
                ) : (
                  <Notice tone="warning">{t("tech.missing.category")}</Notice>
                )}
                <div className="mt-6 flex justify-end">
                  <ButtonLink href="/technicien/inscription?etape=4">{t("common.next")}</ButtonLink>
                </div>
              </>
            )}
            {step === 4 && <OnboardingAvailability initial={availabilityValue(tp, ws)} />}
            {step === 5 && (
              <>
                <DocumentsManager locked={false} documents={ws.documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))} />
                <div className="mt-6 flex justify-end">
                  <ButtonLink href="/technicien/inscription?etape=6">{t("common.next")}</ButtonLink>
                </div>
              </>
            )}
            {step === 6 && (
              <SubmitApplication
                slug={tp.slug}
                missing={completeness.missing.map((m) => t(`tech.missing.${m}`))}
                canSubmit={canEdit && completeness.missing.length === 0}
                resubmit={["rejected", "additional_information_required", "expired"].includes(tp.verificationStatus)}
              />
            )}
          </CardBody>
        </Card>
        <aside>
          <Card>
            <CardHeader title={t("tech.profileCompleteness", { percent: completeness.percent })} as="h3" />
            <CardBody>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completeness.percent}%` }} />
              </div>
              <ul className="space-y-2 text-sm">
                {["photo", "bio", "category", "zones", "services", "availability", "phone", "identity"].map((k) => {
                  const missing = completeness.missing.includes(k);
                  return (
                    <li key={k} className={cn("flex items-center gap-2", missing ? "text-warning" : "text-success")}>
                      {missing ? <CircleAlert className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                      <span className="text-text">{t(`tech.missing.${k}`)}</span>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
