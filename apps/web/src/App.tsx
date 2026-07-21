import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LoaderCircle } from "lucide-react";
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
import { AudiencePage } from "./pages/AudiencePage";
import { PvpPage } from "./pages/PvpPage";

const BuildsPage = lazy(() => import("./pages/BuildsPage").then((module) => ({ default: module.BuildsPage })));
const BuildDetailPage = lazy(() => import("./pages/BuildDetailPage").then((module) => ({ default: module.BuildDetailPage })));
const BuildEditorPage = lazy(() => import("./pages/BuildEditorPage").then((module) => ({ default: module.BuildEditorPage })));

function BuildRouteFallback() {
  return <section aria-live="polite" style={{ minHeight: 360, display: "grid", placeItems: "center", border: "1px solid var(--line)", background: "rgba(5,13,19,.55)", color: "var(--muted)" }}><span style={{ display: "grid", placeItems: "center", gap: 10, textTransform: "uppercase", letterSpacing: ".1em", fontSize: 11 }}><LoaderCircle className="spin" /> Loading Guardian builds</span></section>;
}

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/collection" replace />} />
        <Route path="collection" element={<CollectionPage />} />
        <Route path="xur" element={<XurPage />} />
        <Route path="quests" element={<QuestsPage />} />
        <Route path="quests/:questId" element={<QuestDetailPage />} />
        <Route path="pvp" element={<PvpPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="codes" element={<RewardCodesPage />} />
        <Route path="fireteam" element={<FireteamPage />} />
        <Route path="matrix" element={<MatrixPage />} />
        <Route path="audience" element={<AudiencePage />} />
        <Route path="gear" element={<GearPage />} />
        <Route path="loadouts" element={<LoadoutsPage />} />
        <Route path="builds" element={<Suspense fallback={<BuildRouteFallback />}><BuildsPage /></Suspense>} />
        <Route path="builds/new" element={<Suspense fallback={<BuildRouteFallback />}><BuildEditorPage /></Suspense>} />
        <Route path="builds/:buildId/edit" element={<Suspense fallback={<BuildRouteFallback />}><BuildEditorPage /></Suspense>} />
        <Route path="builds/:buildId" element={<Suspense fallback={<BuildRouteFallback />}><BuildDetailPage /></Suspense>} />
        <Route path="mailbox" element={<MailboxPage />} />
        <Route path="dev" element={<DevPage />} />
        <Route path="*" element={<Navigate to="/collection" replace />} />
      </Route>
    </Routes>
  );
}
