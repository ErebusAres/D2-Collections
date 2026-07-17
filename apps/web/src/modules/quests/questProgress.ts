import type { QuestObjective, QuestProgress, QuestStepProgress } from "@guardian-nexus/contracts";

export type QuestProgressMode = "live" | "requirements" | "route" | "instruction";

export interface QuestProgressPresentation {
  mode: QuestProgressMode;
  heading: string;
  value: string;
  percent: number;
  objectives: QuestObjective[];
  progressKnown: boolean;
  instruction: string;
}

export function currentQuestStep(quest: QuestProgress): QuestStepProgress | undefined {
  return quest.steps?.find((step) => step.status === "current");
}

export function questProgressPresentation(quest: QuestProgress): QuestProgressPresentation {
  const currentStep = currentQuestStep(quest);
  const stepNumber = quest.stepNumber || currentStep?.stepNumber;
  const stepCount = quest.stepCount || quest.steps?.length;
  const instruction = currentStep?.description || currentStep?.name || quest.currentStep || quest.description;

  if (quest.objectives.length) return {
    mode: "live", heading: "Live objectives", value: `${quest.percent}%`, percent: quest.percent,
    objectives: quest.objectives, progressKnown: true, instruction
  };

  const objectives = currentStep?.objectives || [];
  const routeKnown = Boolean(stepNumber && stepCount);
  const routePercent = routeKnown ? Math.round((Math.max(1, stepNumber!) - 1) / Math.max(1, stepCount!) * 100) : 0;
  const value = routeKnown ? `Step ${stepNumber}/${stepCount}` : "No numeric counter";

  if (objectives.length) return {
    mode: "requirements", heading: "Step requirements", value, percent: routePercent,
    objectives, progressKnown: false, instruction
  };

  return {
    mode: routeKnown ? "route" : "instruction", heading: routeKnown ? "Quest route" : "Current instruction",
    value, percent: routePercent, objectives: [], progressKnown: false, instruction
  };
}
