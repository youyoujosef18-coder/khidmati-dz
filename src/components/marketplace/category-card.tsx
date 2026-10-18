import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryIcon } from "@/components/ui/icons";

export function ServiceCategoryCard({
  href,
  iconKey,
  name,
  description,
  countLabel,
}: {
  href: string;
  iconKey: string;
  name: string;
  description?: string | null;
  countLabel: string;
}) {
  return (
    <Link href={href} className="card group flex items-start gap-4 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-raised">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
        <CategoryIcon iconKey={iconKey} className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold text-ink">{name}</span>
          <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
        </span>
        {description && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{description}</span>}
        <span className="mt-2 block text-xs font-medium text-primary">{countLabel}</span>
      </span>
    </Link>
  );
}
