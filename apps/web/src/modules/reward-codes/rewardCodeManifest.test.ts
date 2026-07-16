import { describe, expect, it } from "vitest";
import { rewardCodeManifestItems } from "./rewardCodeManifest";

describe("reward code preview manifest", () => {
  it("returns exact mapped rewards with usable Bungie image URLs", () => {
    const manifest = {
      version: "test",
      generatedAt: "2026-07-16T00:00:00Z",
      definitions: {
        "ABC-123-XYZ": {
          reward: "Example bundle",
          items: [
            { itemHash: "1", collectibleHash: "2", name: "Example Emblem", icon: "/common/example.jpg", itemType: "Emblem" },
            { itemHash: "3", collectibleHash: "4", name: "Example Shader", icon: "/common/shader.jpg", itemType: "Shader" }
          ]
        }
      }
    };

    expect(rewardCodeManifestItems(manifest, "ABC-123-XYZ")).toEqual([
      { itemHash: "1", collectibleHash: "2", name: "Example Emblem", icon: "https://www.bungie.net/common/example.jpg", itemType: "Emblem" },
      { itemHash: "3", collectibleHash: "4", name: "Example Shader", icon: "https://www.bungie.net/common/shader.jpg", itemType: "Shader" }
    ]);
    expect(rewardCodeManifestItems(manifest, "NOT-MAPPED")).toEqual([]);
  });
});
