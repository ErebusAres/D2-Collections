window.D2_FIRETEAM_ACTIVITY_MAP = {
  version: 1,
  updatedAt: "2026-07-02",
  aliases: {
    prismatic: {
      label: "Prismatic unlocks",
      activity: "The Final Shape campaign and post-campaign quests",
      note: "Add exact quest or record hashes here when confirmed from Bungie definitions.",
      hashes: []
    },
    "arcane-needle": {
      label: "Arcane Needle",
      activity: "Warlock Strand aspect/ability cleanup",
      note: "Placeholder mapping for Strand kit completion tracking.",
      hashes: []
    },
    "weavers-call": {
      label: "Weaver's Call",
      activity: "Strand aspect unlock path",
      note: "Placeholder mapping; exact records/objectives should be added after manifest audit.",
      hashes: []
    },
    microcosm: {
      label: "Microcosm",
      activity: "Cooperative Focus missions",
      note: "Use this slot for Microcosm quest/objective hashes.",
      hashes: []
    },
    campaign: {
      label: "Campaign steps",
      activity: "Campaign mission progress",
      note: "Broad fallback until campaign quest hashes are mapped.",
      hashes: []
    },
    exotic: {
      label: "Exotic quest steps",
      activity: "Exotic missions and quest cleanup",
      note: "Broad fallback for exotic pursuit records/objectives.",
      hashes: []
    },
    dungeon: {
      label: "Dungeon unlocks",
      activity: "Dungeon access or exotic pursuit steps",
      note: "Placeholder for dungeon-related quest and triumph hashes.",
      hashes: []
    },
    raid: {
      label: "Raid unlocks",
      activity: "Raid access or exotic pursuit steps",
      note: "Placeholder for raid-related quest and triumph hashes.",
      hashes: []
    }
  },
  suggestions: [
    {
      id: "microcosm",
      label: "Microcosm",
      match: ["microcosm", "cooperative focus"],
      activity: "Run Cooperative Focus missions",
      priority: "Fireteam"
    },
    {
      id: "prismatic",
      label: "Prismatic cleanup",
      match: ["prismatic", "lost in the light", "found in the dark"],
      activity: "Check Pale Heart campaign and post-campaign quests",
      priority: "Buildcraft"
    },
    {
      id: "exotic",
      label: "Exotic quest step",
      match: ["exotic", "catalyst", "intrinsic"],
      activity: "Open the related exotic quest or mission",
      priority: "Collections"
    },
    {
      id: "campaign",
      label: "Campaign progress",
      match: ["campaign", "mission", "quest"],
      activity: "Continue the listed campaign or quest step",
      priority: "Progress"
    }
  ]
};
