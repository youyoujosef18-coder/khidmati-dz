"use client";

import Link from "next/link";
import { MapPin, Siren } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PriceDisplay, RatingDisplay, VerificationBadge } from "@/components/shared/display";
import { useI18n } from "@/lib/i18n/client";
import type { TechnicianCard as Card } from "@/lib/services/discovery";

export function TechnicianCard({ tech }: { tech: Card }) {
  const { t, locale } = useI18n();
  const ar = locale === "ar-DZ";
  const category = ar ? tech.categoryAr : tech.categoryFr;
  const place = [ar ? tech.communeAr : tech.communeFr, ar ? tech.wilayaAr : tech.wilayaFr].filter(Boolean).join(", ");
  return (
    <article className="card group flex flex-col p-4 transition-shadow hover:shadow-raised">
      <div className="flex items-start gap-3">
        <Avatar fileId={tech.avatarFileId} name={tech.publicName} size={56} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-ink">
            <Link href={`/techniciens/${tech.slug}`} className="hover:text-primary">
              {tech.publicName}
            </Link>
          </h3>
          <VerificationBadge approved />
          {category && <p className="mt-0.5 truncate text-sm text-muted">{category}</p>}
        </div>
      </div>
      <div className="mb-4 mt-4 space-y-2 text-sm">
        {place && (
          <p className="flex items-center gap-1.5 text-muted">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">{place}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <RatingDisplay rating={tech.rating} count={tech.reviewCount} />
          {tech.experienceYears > 0 && <span className="text-muted">· {t("discovery.experience", { count: tech.experienceYears })}</span>}
        </div>
        {tech.emergencyAvailable && (
          <p className="inline-flex items-center gap-1 text-xs font-medium text-warning">
            <Siren className="h-3.5 w-3.5" aria-hidden /> {t("profile.emergency")}
          </p>
        )}
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-3">
        <PriceDisplay minor={tech.minPriceMinor} model={tech.minPriceModel} className="text-sm" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={`/techniciens/${tech.slug}`} className="inline-flex h-10 items-center justify-center rounded-md border border-border-strong text-sm font-medium hover:bg-bg">
          {t("discovery.viewProfile")}
        </Link>
        <Link
          href={`/client/demandes/nouvelle?technicien=${tech.slug}`}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary text-sm font-medium text-white hover:bg-primary-hover"
        >
          {t("discovery.requestQuote")}
        </Link>
      </div>
    </article>
  );
}
