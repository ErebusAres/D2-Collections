import type { BuildAdvisorComponentState, BuildAdvisorRecommendation, FireteamTrackedItem } from "@guardian-nexus/contracts";

const completeStates = new Set<BuildAdvisorComponentState>(["exact-owned", "strong-owned", "functional-owned", "owned-other-character"]);
const unavailableStates = new Set<BuildAdvisorComponentState>(["unavailable", "unknown"]);

export function parseTrackedBuilds(value?: string): FireteamTrackedItem[] {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTrackedBuild).slice(0, 8);
  } catch { return []; }
}

export function buildTrackingItem(recommendation: BuildAdvisorRecommendation, updatedAt = new Date().toISOString()): FireteamTrackedItem {
  const objectives = (recommendation.componentVerifications || []).filter((component) => component.required).map((component) => {
    const complete = completeStates.has(component.state);
    const progressAvailable = !unavailableStates.has(component.state);
    return {
      objectiveHash: component.id,
      name: component.name,
      progress: complete ? 1 : 0,
      completionValue: 1,
      percent: complete ? 100 : 0,
      complete,
      progressAvailable
    };
  });
  const routes = (recommendation.acquisitionPlans || []).flatMap((plan) => plan.routes.slice(0, 1));
  const steps = [...new Set(routes.flatMap((route) => route.steps))].slice(0, 8);
  const prerequisites = [...new Set(routes.flatMap((route) => route.prerequisites))].slice(0, 8);
  return {
    id: recommendation.templateId,
    definitionHash: recommendation.templateId,
    kind: "build",
    name: recommendation.name,
    description: recommendation.reason || `${recommendation.subclass} ${recommendation.classType} Build Advisor plan.`,
    icon: "",
    context: `Build Advisor · ${recommendation.subclass} · ${recommendation.status.replace(/-/g, " ")}`,
    trackedInDestiny: false,
    trackedInGuardianNexus: true,
    objectives,
    percent: Math.max(0, Math.min(100, Math.round(recommendation.readinessScore))),
    updatedAt,
    acquisitionGuide: routes.length ? {
      summary: recommendation.missingItems.length ? `Missing: ${recommendation.missingItems.join(", ")}` : "All required build components are accounted for.",
      steps,
      prerequisites
    } : undefined
  };
}

function isTrackedBuild(value: unknown): value is FireteamTrackedItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<FireteamTrackedItem>;
  return item.kind === "build" && typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.objectives)
    && typeof item.percent === "number" && item.trackedInDestiny === false && item.trackedInGuardianNexus === true;
}
