import type { BuildArmorSlot, BuildGuardianClass, BuildNamedEntry, FashionLook, FashionLooksDocument, PortableFashionLookEnvelope } from "@guardian-nexus/contracts";

export const FASHION_SLOTS: Array<{ slot: BuildArmorSlot; label: string }> = [
  { slot: "helmet", label: "Helmet" }, { slot: "arms", label: "Arms" }, { slot: "chest", label: "Chest" },
  { slot: "legs", label: "Legs" }, { slot: "classItem", label: "Class item" }
];
export const EMPTY_FASHION_LOOKS: FashionLooksDocument = { schemaVersion: 1, looks: [] };

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const iso = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
const id = (prefix: string) => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function emptyFashionLook(classType: BuildGuardianClass = "hunter"): FashionLook {
  const now = new Date().toISOString();
  return { id: id("look"), name: "", classType, slots: FASHION_SLOTS.map(({ slot }) => ({ slot })), createdAt: now, updatedAt: now };
}

export function parseFashionLooks(value?: string): FashionLooksDocument {
  if (!value) return EMPTY_FASHION_LOOKS;
  try {
    const input = JSON.parse(value) as { schemaVersion?: unknown; looks?: unknown };
    if (input.schemaVersion !== 1 || !Array.isArray(input.looks)) return EMPTY_FASHION_LOOKS;
    return { schemaVersion: 1, looks: input.looks.slice(0, 20).map(normalizeLook).filter((look): look is FashionLook => Boolean(look)) };
  } catch { return EMPTY_FASHION_LOOKS; }
}

export function portableFashionLook(look: FashionLook): PortableFashionLookEnvelope {
  return { format: "guardian-nexus-fashion-look", version: 1, exportedAt: new Date().toISOString(), look: { name: look.name, classType: look.classType, note: look.note, slots: look.slots.map((slot) => ({ slot: slot.slot, ornament: slot.ornament, shader: slot.shader })) } };
}

export function importFashionLook(raw: string): FashionLook {
  if (new TextEncoder().encode(raw).length > 256_000) throw new Error("Fashion import exceeds the 256 KB limit.");
  let input: unknown;
  try { input = JSON.parse(raw); } catch { throw new Error("Fashion import is not valid JSON."); }
  if (!input || typeof input !== "object") throw new Error("Fashion import is invalid.");
  const envelope = input as Partial<PortableFashionLookEnvelope>;
  if (envelope.format !== "guardian-nexus-fashion-look" || envelope.version !== 1) throw new Error("Fashion import uses an unsupported format or version.");
  const normalized = normalizeLook({ ...envelope.look, id: id("look"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  if (!normalized) throw new Error("Fashion import does not contain a valid named look.");
  return normalized;
}

function normalizeLook(value: unknown): FashionLook | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const name = text(row.name, 80);
  if (!name) return null;
  const classType: BuildGuardianClass = row.classType === "titan" || row.classType === "warlock" ? row.classType : "hunter";
  const rawSlots = Array.isArray(row.slots) ? row.slots : [];
  const slots = FASHION_SLOTS.map(({ slot }) => {
    const source = rawSlots.find((entry) => entry && typeof entry === "object" && (entry as { slot?: unknown }).slot === slot) as Record<string, unknown> | undefined;
    return { slot, ornament: namedEntry(source?.ornament), shader: namedEntry(source?.shader) };
  });
  const createdAt = iso(row.createdAt) || new Date(0).toISOString();
  return { id: text(row.id, 80) || id("look"), name, classType, slots, note: text(row.note, 600) || undefined, createdAt, updatedAt: iso(row.updatedAt) || createdAt };
}

function namedEntry(value: unknown): BuildNamedEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const name = text(row.name, 160);
  if (!name) return undefined;
  return { name, hash: /^\d+$/.test(text(row.hash, 24)) ? text(row.hash, 24) : undefined, icon: safeIcon(row.icon), itemType: text(row.itemType, 80) || undefined, rarity: text(row.rarity, 40) || undefined };
}

function safeIcon(value: unknown): string | undefined {
  const candidate = text(value, 500);
  if (!candidate) return undefined;
  try { const url = new URL(candidate, "https://www.bungie.net"); return url.protocol === "https:" ? candidate : undefined; } catch { return undefined; }
}
