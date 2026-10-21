"use client";

import { StitchFrame } from "./StitchFrame";
import { stitchRedesignFor } from "@/lib/stitch-redesign";

export function StitchRedesignFrame({ path }: { path: string }) {
  const screen = stitchRedesignFor(path);
  if (!screen) return null;
  return <StitchFrame src={screen.src} title={`${screen.title} — Stitch`} />;
}
