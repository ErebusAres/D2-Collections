import type { GuardianBuild } from "@guardian-nexus/contracts";

export function buildPlannerLink(build: Pick<GuardianBuild, "id" | "slug">): string {
  const templateId = build.id.startsWith("curated-") ? build.id.slice("curated-".length) : "";
  return templateId
    ? `/build-advisor?template=${encodeURIComponent(templateId)}`
    : `/build-advisor?build=${encodeURIComponent(build.slug)}`;
}
