"use client";

/** Maps crop icon names stored in the database to lucide-react components. */
import {
  Apple,
  Carrot,
  Citrus,
  Leaf,
  Sprout,
  Waves,
  Wheat,
  type LucideIcon,
} from "lucide-react";

const CROP_ICONS: Record<string, LucideIcon> = {
  Sprout,
  Wheat,
  Leaf,
  Waves,
  Apple,
  Carrot,
  Citrus,
};

export function CropIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = CROP_ICONS[name] ?? Sprout;
  return <Icon className={className} aria-hidden />;
}
