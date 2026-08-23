import { useEffect, useState } from "react";
import { useWeaponRatings } from "../../context/WeaponRatingContext";
import { loadWeaponRatings, type WeaponRatingDatabase } from "./weaponEvaluator";

export function useResolvedWeaponRatings() {
  const context = useWeaponRatings();
  const [database, setDatabase] = useState<WeaponRatingDatabase>();
  useEffect(() => {
    let cancelled = false;
    setDatabase(undefined);
    void loadWeaponRatings(context.sourceId).then((loaded) => { if (!cancelled) setDatabase(loaded); });
    return () => { cancelled = true; };
  }, [context.sourceId]);
  return { ...context, database, loading: !database };
}
