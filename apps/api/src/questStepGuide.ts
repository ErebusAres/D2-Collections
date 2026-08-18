import type { QuestObjective, QuestStepGuide } from "@guardian-nexus/contracts";

interface GuideInput {
  questName: string;
  stepName: string;
  description: string;
  activityName?: string;
  objectives: QuestObjective[];
}

export function questStepGuide(input: GuideInput): QuestStepGuide | undefined {
  const text = [input.stepName, input.description, ...input.objectives.map((objective) => objective.name)].join(" ").replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  const lower = text.toLocaleLowerCase();
  const steps: string[] = [];
  const tips: string[] = [];
  const warnings: string[] = [];

  const weapon = weaponRequirement(text);
  const element = firstMatch(text, ["Arc", "Solar", "Void", "Stasis", "Strand", "Kinetic"]);
  const ability = firstMatch(text, ["grenade", "melee", "Super", "ability"]);
  const requiresFinalBlows = /final blows?|defeat|kills?/.test(lower);
  const requiresPrecision = /precision/.test(lower);
  const requiresGuardians = /guardians?|crucible/.test(lower);

  if (requiresFinalBlows) {
    const target = requiresGuardians ? "the required Crucible playlist" : input.activityName || "a repeatable activity with dense groups of enemies";
    const method = weapon ? `${weapon} final blows` : element ? `${element} final blows` : ability ? `${ability} final blows` : "the listed final blows";
    steps.push(`Equip a loadout that can consistently secure ${method}.`);
    steps.push(`Run ${target} and prioritize weak enemies that you can finish yourself.`);
    if (!requiresGuardians) tips.push("Enemy-dense encounters are faster than activities with long traversal or dialogue sections.");
    if (weapon) tips.push(`Carry ammo-finder, reserve, or scavenger support if the required ${weapon} does not use Primary ammo.`);
    if (element) tips.push(`Use a matching ${element} subclass and weapons so weapon and ability kills can advance compatible objectives together.`);
    if (ability) tips.push(`Build into ${ability} regeneration and use rally banners or activity flags whenever they are available.`);
    if (requiresPrecision) tips.push("Aim at red-bar enemies with clear critical spots; explosive or damage-over-time effects can steal the required precision final blow.");
    warnings.push("Assists normally do not count when the objective specifically says final blows; confirm the counter moves after the first few kills.");
  } else if (/complete|completion|finish|activity|activities|matches|strikes?|nightfalls?|lost sectors?|missions?/.test(lower)) {
    const destination = input.activityName || namedActivity(text) || "the activity named by the objective";
    steps.push(`Launch ${destination} from its Director node or quest marker.`);
    steps.push("Finish the full activity and remain until the completion rewards and progress notification appear.");
    tips.push("Use the shortest eligible difficulty unless the objective explicitly requires a higher tier, score, or modifier.");
    warnings.push("Leaving after the boss dies can miss credit when completion is awarded at the results screen.");
  } else if (/collect|obtain|acquire|gather|retrieve|find|search/.test(lower)) {
    steps.push(`Track ${input.questName} in Destiny so its destination and interaction markers are visible.`);
    steps.push("Open the objective details before launching an activity and confirm whether the item comes from enemies, a chest, or a direct interaction.");
    tips.push("If drops stop appearing, return to orbit and verify that the quest is on the character currently being played and that inventory space is available.");
  } else if (/speak|talk|visit|meet|return to|report to|commune|interact/.test(lower)) {
    steps.push("Track the quest in Destiny, open the Director, and follow the highlighted destination or vendor marker.");
    steps.push("After the conversation or interaction, wait for the quest-step update before leaving the destination.");
    warnings.push("A marker can be inside a social-space submenu or campaign node rather than on the destination map itself.");
  } else {
    return undefined;
  }

  return {
    coverage: "objective-specific",
    summary: summaryFor(input, weapon, element, ability),
    steps: unique(steps),
    tips: unique(tips),
    warnings: unique(warnings),
    secrets: []
  };
}

function summaryFor(input: GuideInput, weapon?: string, element?: string, ability?: string): string {
  if (weapon) return `Efficient route for the ${weapon} requirement in ${input.stepName}.`;
  if (element) return `Loadout and activity advice for the ${element} requirement in ${input.stepName}.`;
  if (ability) return `Ability-uptime advice for the ${ability} requirement in ${input.stepName}.`;
  return `Actionable route for ${input.stepName}.`;
}

function weaponRequirement(text: string): string | undefined {
  return firstMatch(text, ["Auto Rifle", "Pulse Rifle", "Scout Rifle", "Hand Cannon", "Sidearm", "Submachine Gun", "Bow", "Shotgun", "Fusion Rifle", "Sniper Rifle", "Trace Rifle", "Glaive", "Grenade Launcher", "Rocket Launcher", "Machine Gun", "Linear Fusion Rifle", "Sword"]);
}

function namedActivity(text: string): string | undefined {
  return firstMatch(text, ["Vanguard Ops", "Crucible", "Gambit", "Nightfall", "Lost Sector"]);
}

function firstMatch(text: string, values: string[]): string | undefined {
  const lower = text.toLocaleLowerCase();
  return values.find((value) => lower.includes(value.toLocaleLowerCase()));
}

function unique(values: string[]): string[] { return [...new Set(values.filter(Boolean))]; }
