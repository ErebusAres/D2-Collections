import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { CollectionPage } from "./pages/CollectionPage";
import { DevPage } from "./pages/DevPage";
import { FireteamPage } from "./pages/FireteamPage";
import { GearPage } from "./pages/GearPage";
import { MatrixPage } from "./pages/MatrixPage";
import { QuestsPage } from "./pages/QuestsPage";
import { QuestDetailPage } from "./pages/QuestDetailPage";
import { RewardsPage } from "./pages/RewardsPage";
import { XurPage } from "./pages/XurPage";

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/collection" replace />} />
        <Route path="collection" element={<CollectionPage />} />
        <Route path="xur" element={<XurPage />} />
        <Route path="quests" element={<QuestsPage />} />
        <Route path="quests/:questId" element={<QuestDetailPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="fireteam" element={<FireteamPage />} />
        <Route path="matrix" element={<MatrixPage />} />
        <Route path="gear" element={<GearPage />} />
        <Route path="dev" element={<DevPage />} />
        <Route path="*" element={<Navigate to="/collection" replace />} />
      </Route>
    </Routes>
  );
}
