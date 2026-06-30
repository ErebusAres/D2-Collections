(() => {
  const bungie = path => path.startsWith("http") ? path : `https://www.bungie.net${path}`;
  const dim = filename => `assets/dim-icons/${filename}`;

  window.D2_COLLECTIONS_UI_ICONS = {
    game: {
      exoticCipher: bungie("/common/destiny2_content/icons/9970631fe1052642c268132dfc30e16b.jpg"),
      exoticEngram: bungie("/common/destiny2_content/icons/3e6a698e1a8a5fb446fdcbf1e63c5269.png"),
      strangeCoin: bungie("/common/destiny2_content/icons/1fa5806bb6ec16b5f8cdeb4b36d4bb01.jpg"),
      ascendantShard: bungie("/common/destiny2_content/icons/0271d214fc3ec91b3def799a4b286b46.jpg"),
      enhancementPrism: bungie("/common/destiny2_content/icons/dea2a35badf7466d4c2c2697ce6e8d87.jpg")
    },
    dim: {
      must: dim("dim_thumb_up.svg"),
      easy: dim("dim_check_circle.svg"),
      final: dim("dim_masterwork_hammer.svg"),
      confidence: dim("dim_exclamation_triangle.svg"),
      fallback: dim("dim_bookmark.svg"),
      sync: dim("dim_sync.svg"),
      difficultyEasy: `${dim("difficulty_easy.svg")}?v=d2-difficulty-emblems`,
      difficultyNormal: `${dim("difficulty_normal.svg")}?v=d2-difficulty-emblems`,
      difficultyDifficult: `${dim("difficulty_difficult.svg")}?v=d2-difficulty-emblems`,
      difficultyImpossible: `${dim("difficulty_impossible.svg")}?v=d2-difficulty-emblems`
    }
  };
})();
