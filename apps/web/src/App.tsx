import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Shell } from "./components/layout/Shell";
import { CollectionPage } from "./pages/CollectionPage";
import { DevPage } from "./pages/DevPage";
import { FireteamPage } from "./pages/FireteamPage";
import { GearPage } from "./pages/GearPage";
import { MatrixPage } from "./pages/MatrixPage";
import { MailboxPage } from "./pages/MailboxPage";
import { LoadoutsPage } from "./pages/LoadoutsPage";
import { QuestsPage } from "./pages/QuestsPage";
import { QuestDetailPage } from "./pages/QuestDetailPage";
import { RewardsPage } from "./pages/RewardsPage";
import { RewardCodesPage } from "./pages/RewardCodesPage";
import { XurPage } from "./pages/XurPage";

const BuildsPage = lazy(() => import("./pages/BuildsPage").then((module) => ({ default: module.BuildsPage })));
const BuildDetailPage = lazy(() => import("./pages/BuildDetailPage").then((module) => ({ default: module.BuildDetailPage })));
const BuildEditorPage = lazy(() => import("./pages/BuildEditorPage").then((module) => ({ default: module.BuildEditorPage })));

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
        <Route path="codes" element={<RewardCodesPage />} />
        <Route path="fireteam" element={<FireteamPage />} />
        <Route path="matrix" element={<MatrixPage />} />
        <Route path="gear" element={<GearPage />} />
        <Route path="loadouts" element={<LoadoutsPage />} />
        <Route path="builds" element={<Suspense fallback={null}><BuildsPage /></Suspense>} />
        <Route path="builds/new" element={<Suspense fallback={null}><BuildEditorPage /></Suspense>} />
        <Route path="builds/:buildId/edit" element={<Suspense fallback={null}><BuildEditorPage /></Suspense>} />
        <Route path="builds/:buildId" element={<Suspense fallback={null}><BuildDetailPage /></Suspense>} />
        <Route path="mailbox" element={<MailboxPage />} />
        <Route path="dev" element={<DevPage />} />
        <Route path="*" element={<Navigate to="/collection" replace />} />
      </Route>
    </Routes>
  );
}
