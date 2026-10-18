import {
  AirVent,
  Droplets,
  Hammer,
  KeyRound,
  MonitorSmartphone,
  PaintRoller,
  Sparkles,
  WashingMachine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  droplets: Droplets,
  zap: Zap,
  "air-vent": AirVent,
  "washing-machine": WashingMachine,
  "paint-roller": PaintRoller,
  hammer: Hammer,
  "key-round": KeyRound,
  "monitor-smartphone": MonitorSmartphone,
  sparkles: Sparkles,
  wrench: Wrench,
};

export function CategoryIcon({ iconKey, className }: { iconKey: string; className?: string }) {
  const Icon = CATEGORY_ICONS[iconKey] ?? Wrench;
  return <Icon className={className} aria-hidden />;
}
