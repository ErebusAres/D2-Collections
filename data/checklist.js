window.D2_COLLECTIONS_CHECKLIST = {
  users: {
    corey: { label: "Corey", short: "C" },
    matt: { label: "Matt", short: "M" }
  },

  // Edit only the exotics you want to mark true. Missing entries default to false.
  weapons: {
    "graviton-lance": {
      corey: { owned: true, catalyst: false, complete: false, equipped: false },
      matt:  { owned: false, catalyst: false, complete: false, equipped: false }
    },
    "sunshot": {
      corey: { owned: false, catalyst: false, complete: false, equipped: false },
      matt:  { owned: true, catalyst: false, complete: false, equipped: false }
    },
    "truth": {
      corey: { owned: false, catalyst: false, complete: false, equipped: false },
      matt:  { owned: false, catalyst: false, complete: false, equipped: false }
    },
    "euphony": {
      corey: { owned: false, catalyst: false, complete: false, equipped: false },
      matt:  { owned: false, catalyst: false, complete: false, equipped: false }
    }
  },

  armor: {
    warlock: {
      "rime-coat-raiment": {
        corey: { owned: false, equipped: false },
        matt:  { owned: false, equipped: false }
      },
      "getaway-artist": {
        corey: { owned: false, equipped: false },
        matt:  { owned: false, equipped: false }
      }
    },
    titan: {
      "wormgod-caress": {
        corey: { owned: false, equipped: false },
        matt:  { owned: true, equipped: false }
      },
      "hallowfire-heart": {
        corey: { owned: false, equipped: false },
        matt:  { owned: false, equipped: false }
      },
      "armamentarium": {
        corey: { owned: false, equipped: false },
        matt:  { owned: false, equipped: false }
      }
    }
  }
};
