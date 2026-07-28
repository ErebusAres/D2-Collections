import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Shell } from "./components/layout/Shell";
const CollectionPage = lazy(() => import("./pages/CollectionPage").then((module) => ({ default: module.CollectionPage })));
const DevPage = lazy(() => import("./pages/DevPage").then((module) => ({ default: module.DevPage })));
const FireteamPage = lazy(() => import("./pages/FireteamPage").then((module) => ({ default: module.FireteamPage })));
const GearPage = lazy(() => import("./pages/GearPage").then((module) => ({ default: module.GearPage })));
const MatrixPage = lazy(() => import("./pages/MatrixPage").then((module) => ({ default: module.MatrixPage })));
const MailboxPage = lazy(() => import("./pages/MailboxPage").then((module) => ({ default: module.MailboxPage })));
const LoadoutsPage = lazy(() => import("./pages/LoadoutsPage").then((module) => ({ default: module.LoadoutsPage })));
const JourneyPage = lazy(() => import("./pages/JourneyPage").then((module) => ({ default: module.JourneyPage })));
const QuestsPage = lazy(() => import("./pages/QuestsPage").then((module) => ({ default: module.QuestsPage })));
const BountiesPage = lazy(() => import("./pages/BountiesPage").then((module) => ({ default: module.BountiesPage })));
const SeasonalPage = lazy(() => import("./pages/SeasonalPage").then((module) => ({ default: module.SeasonalPage })));
const WeeklyProgressPage = lazy(() => import("./pages/WeeklyProgressPage").then((module) => ({ default: module.WeeklyProgressPage })));
const JourneyUnavailablePage = lazy(() => import("./pages/JourneyUnavailablePage").then((module) => ({ default: module.JourneyUnavailablePage })));
const QuestDetailPage = lazy(() => import("./pages/QuestDetailPage").then((module) => ({ default: module.QuestDetailPage })));
const RewardsPage = lazy(() => import("./pages/RewardsPage").then((module) => ({ default: module.RewardsPage })));
const RewardCodesPage = lazy(() => import("./pages/RewardCodesPage").then((module) => ({ default: module.RewardCodesPage })));
const XurPage = lazy(() => import("./pages/XurPage").then((module) => ({ default: module.XurPage })));
const AudiencePage = lazy(() => import("./pages/AudiencePage").then((module) => ({ default: module.AudiencePage })));
const NextStepsPage = lazy(() => import("./pages/NextStepsPage").then((module) => ({ default: module.NextStepsPage })));
const PvpPage = lazy(() => import("./pages/PvpPage").then((module) => ({ default: module.PvpPage })));
const GuardianRankPage = lazy(() => import("./pages/GuardianRankPage").then((module) => ({ default: module.GuardianRankPage })));
const PowerPage = lazy(() => import("./pages/PowerPage").then((module) => ({ default: module.PowerPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const ReportDetailPage = lazy(() => import("./pages/ReportDetailPage").then((module) => ({ default: module.ReportDetailPage })));
const ReportAdminPage = lazy(() => import("./pages/ReportAdminPage").then((module) => ({ default: module.ReportAdminPage })));
const BuildsPage = lazy(() => import("./pages/BuildsPage").then((module) => ({ default: module.BuildsPage })));
const BuildDetailPage = lazy(() => import("./pages/BuildDetailPage").then((module) => ({ default: module.BuildDetailPage })));
const BuildEditorPage = lazy(() => import("./pages/BuildEditorPage").then((module) => ({ default: module.BuildEditorPage })));
const BuildAdvisorPage = lazy(() => import("./pages/BuildAdvisorPage").then((module) => ({ default: module.BuildAdvisorPage })));

function RouteFallback() {
  return <section aria-live="polite" style={{ minHeight: 360, display: "grid", placeItems: "center", border: "1px solid var(--line)", background: "rgba(5,13,19,.55)", color: "var(--muted)" }}><span style={{ display: "grid", placeItems: "center", gap: 10, textTransform: "uppercase", letterSpacing: ".1em", fontSize: 11 }}><LoaderCircle className="spin" /> Loading Guardian data</span></section>;
}

function PageRoute({ children }: { children: ReactNode }) { return <Suspense fallback={<RouteFallback />}>{children}</Suspense>; }

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/collection" replace />} />
        <Route path="collection" element={<PageRoute><CollectionPage /></PageRoute>} />
        <Route path="xur" element={<PageRoute><XurPage /></PageRoute>} />
        <Route path="quests" element={<Navigate to="/journey" replace />} />
        <Route path="quests/tracker" element={<Navigate to="/journey/quests" replace />} />
        <Route path="quests/:questId" element={<PageRoute><QuestDetailPage /></PageRoute>} />
        <Route path="journey" element={<PageRoute><JourneyPage /></PageRoute>} />
        <Route path="journey/quests" element={<PageRoute><QuestsPage /></PageRoute>} />
        <Route path="journey/bounties" element={<PageRoute><BountiesPage /></PageRoute>} />
        <Route path="journey/season" element={<PageRoute><SeasonalPage /></PageRoute>} />
        <Route path="journey/guardian-rank" element={<PageRoute><GuardianRankPage /></PageRoute>} />
        <Route path="journey/titles" element={<PageRoute><JourneyUnavailablePage kind="titles" /></PageRoute>} />
        <Route path="journey/triumphs" element={<PageRoute><JourneyUnavailablePage kind="triumphs" /></PageRoute>} />
        <Route path="journey/weekly" element={<PageRoute><WeeklyProgressPage /></PageRoute>} />
        <Route path="guardian-rank" element={<PageRoute><GuardianRankPage /></PageRoute>} />
        <Route path="power" element={<PageRoute><PowerPage /></PageRoute>} />
        <Route path="pvp" element={<PageRoute><PvpPage /></PageRoute>} />
        <Route path="rewards" element={<PageRoute><RewardsPage /></PageRoute>} />
        <Route path="reports" element={<PageRoute><ReportsPage /></PageRoute>} />
        <Route path="reports/:reportId" element={<PageRoute><ReportDetailPage /></PageRoute>} />
        <Route path="reports/admin" element={<PageRoute><ReportAdminPage /></PageRoute>} />
        <Route path="codes" element={<PageRoute><RewardCodesPage /></PageRoute>} />
        <Route path="fireteam" element={<PageRoute><FireteamPage /></PageRoute>} />
        <Route path="matrix" element={<PageRoute><MatrixPage /></PageRoute>} />
        <Route path="build-advisor" element={<PageRoute><BuildAdvisorPage /></PageRoute>} />
        <Route path="next" element={<PageRoute><NextStepsPage /></PageRoute>} />
        <Route path="audience" element={<PageRoute><AudiencePage /></PageRoute>} />
        <Route path="gear" element={<PageRoute><GearPage /></PageRoute>} />
        <Route path="loadouts" element={<PageRoute><LoadoutsPage /></PageRoute>} />
        <Route path="builds" element={<PageRoute><BuildsPage /></PageRoute>} />
        <Route path="builds/new" element={<PageRoute><BuildEditorPage /></PageRoute>} />
        <Route path="builds/:buildId/edit" element={<PageRoute><BuildEditorPage /></PageRoute>} />
        <Route path="builds/:buildId" element={<PageRoute><BuildDetailPage /></PageRoute>} />
        <Route path="mailbox" element={<PageRoute><MailboxPage /></PageRoute>} />
        <Route path="dev" element={<PageRoute><DevPage /></PageRoute>} />
        <Route path="*" element={<Navigate to="/collection" replace />} />
      </Route>
    </Routes>
  );
}
