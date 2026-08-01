import { describe, expect, it } from "vitest";
import { emptyFashionLook, importFashionLook, parseFashionLooks, portableFashionLook } from "./fashion";

describe("fashion workspace documents", () => {
  it("normalizes all five slots and rejects malformed saved data", () => {
    expect(parseFashionLooks("bad").looks).toEqual([]);
    const parsed = parseFashionLooks(JSON.stringify({ schemaVersion: 1, looks: [{ id: "one", name: "Void Regent", classType: "warlock", slots: [{ slot: "helmet", ornament: { name: "Crown", hash: "123" } }], createdAt: "2026-08-01T00:00:00Z" }] }));
    expect(parsed.looks[0]!.slots).toHaveLength(5);
    expect(parsed.looks[0]!.slots[0]!.ornament?.hash).toBe("123");
  });

  it("round-trips an account-neutral versioned look", () => {
    const look = emptyFashionLook("titan");
    look.name = "Iron Sentinel";
    look.slots[2]!.shader = { name: "Iron Countershade", hash: "456" };
    const portable = portableFashionLook(look);
    expect(portable.look).not.toHaveProperty("id");
    expect(portable.look).not.toHaveProperty("createdAt");
    const imported = importFashionLook(JSON.stringify(portable));
    expect(imported.name).toBe("Iron Sentinel");
    expect(imported.slots[2]!.shader?.name).toBe("Iron Countershade");
    expect(imported.id).not.toBe(look.id);
  });
});
