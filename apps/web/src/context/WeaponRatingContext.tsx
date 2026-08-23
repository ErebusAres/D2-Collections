import { createContext, useContext, type ReactNode } from "react";
import type { WeaponRatingDatabase, WeaponRatingSourceId } from "../modules/loot/weaponEvaluator";

function parseWeaponRatingSource(value?: string): WeaponRatingSourceId {
  return value === "choosy-voltron" || value === "just-another-team" ? value : "voltron";
}

interface WeaponRatingContextValue {
  sourceId: WeaponRatingSourceId;
  database?: WeaponRatingDatabase;
  loading: boolean;
  setSource: (source: WeaponRatingSourceId) => void;
}

const WeaponRatingContext = createContext<WeaponRatingContextValue>({ sourceId: "voltron", loading: false, setSource: () => undefined });

export function WeaponRatingProvider({ value, onChange, children }: { value?: string; onChange: (source: WeaponRatingSourceId) => void; children: ReactNode }) {
  const sourceId = parseWeaponRatingSource(value);
  return <WeaponRatingContext.Provider value={{ sourceId, loading: false, setSource: onChange }}>{children}</WeaponRatingContext.Provider>;
}

export function useWeaponRatings(): WeaponRatingContextValue {
  return useContext(WeaponRatingContext);
}
