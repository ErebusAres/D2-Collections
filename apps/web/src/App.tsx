import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import styles from "./App.module.css";
import { Shell } from "./components/layout/Shell";
const CollectionPage = lazy(() => import("./pages/CollectionPage").then((module) => ({ default: module.CollectionPage })));
const DevPage = lazy(() => import("./pages/DevPage").then((module) => ({ default: module.DevPage })));
const FireteamPage = lazy(() => import("./pages/FireteamRoute").then((module) => ({ default: module.FireteamRoute })));
const GearPage = lazy(() => import("./pages/GearPage").then((module) => ({ default: module.GearPage })));
const MatrixPage = lazy(() => import("./pages/MatrixPage").then((module) => ({ default: module.MatrixPage })));
const MailboxPage = lazy(() => import("./pages/MailboxPage").then((module) => ({ default: module.MailboxPage })));
const LoadoutsPage = lazy(() => import("./pages/LoadoutsPage").then((module) => ({ default: module.LoadoutsPage })));
const JourneyPage = lazy(() => import("./pages/JourneyPage").then((module) => ({ default: module.JourneyPage })));
const QuestsPage = lazy(() => import("./pages/QuestsPage").then((module) => ({ default: module.QuestsPage })));
const BountiesPage = lazy(() => import("./pages/BountiesPage").then((module) => ({ default: module.BountiesPage })));
const SeasonalPage = lazy(() => import("./pages/SeasonalPage").then((module) => ({ default: module.SeasonalPage })));
const WeeklyProgressPage = lazy(() => import("./pages/WeeklyProgressPage").then((module) => ({ default: module.WeeklyProgressPage })));
const JourneyRecordsPage = lazy(() => import("./pages/JourneyRecordsPage").then((module) => ({ default: module.JourneyRecordsPage })));
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
const GuardianSnapshotsPage = lazy(() => import("./pages/GuardianSnapshotsPage").then((module) => ({ default: module.GuardianSnapshotsPage })));
const BuildDetailPage = lazy(() => import("./pages/BuildDetailPage").then((module) => ({ default: module.BuildDetailPage })));
const BuildEditorPage = lazy(() => import("./pages/BuildEditorPage").then((module) => ({ default: module.BuildEditorPage })));
const BuildAdvisorPage = lazy(() => import("./pages/BuildAdvisorPage").then((module) => ({ default: module.BuildAdvisorPage })));
const WhatsHappeningPage = lazy(() => import("./pages/WhatsHappeningPage").then((module) => ({ default: module.WhatsHappeningPage })));
const DistortionsPage = lazy(() => import("./pages/DistortionsPage").then((module) => ({ default: module.DistortionsPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then((module) => ({ default: module.NotificationsPage })));
const RaidRotationsPage = lazy(() => import("./pages/RaidRotationsPage").then((module) => ({ default: module.RaidRotationsPage })));
const WatchlistsPage = lazy(() => import("./pages/WatchlistsPage").then((module) => ({ default: module.WatchlistsPage })));
const FashionPage = lazy(() => import("./pages/FashionPage").then((module) => ({ default: module.FashionPage })));
const ChallengesPage = lazy(() => import("./pages/ChallengesPage").then((module) => ({ default: module.ChallengesPage })));

function RouteFallback() {
  return <section className={styles.fallback} aria-live="polite"><span><LoaderCircle /> Loading</span></section>;
}

function PageRoute({ children }: { children: ReactNode }) { return <Suspense fallback={<RouteFallback />}>{children}</Suspense>; }

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/director" replace />} />
        <Route path="director" element={<PageRoute><WhatsHappeningPage /></PageRoute>} />
        <Route path="whats-happening" element={<Navigate to="/director" replace />} />
        <Route path="distortions" element={<PageRoute><DistortionsPage /></PageRoute>} />
        <Route path="notifications" element={<PageRoute><NotificationsPage /></PageRoute>} />
        <Route path="watchlists" element={<PageRoute><WatchlistsPage /></PageRoute>} />
        <Route path="activities/raids" element={<PageRoute><RaidRotationsPage /></PageRoute>} />
        <Route path="collection" element={<PageRoute><CollectionPage /></PageRoute>} />
        <Route path="fashion" element={<PageRoute><FashionPage /></PageRoute>} />
        <Route path="challenges" element={<PageRoute><ChallengesPage /></PageRoute>} />
        <Route path="xur" element={<PageRoute><XurPage /></PageRoute>} />
        <Route path="quests" element={<Navigate to="/journey" replace />} />
        <Route path="quests/tracker" element={<Navigate to="/journey/quests" replace />} />
        <Route path="quests/:questId" element={<PageRoute><QuestDetailPage /></PageRoute>} />
        <Route path="journey/*" element={<PageRoute><JourneyPage /></PageRoute>} />
        <Route path="journey/quests" element={<PageRoute><QuestsPage /></PageRoute>} />
        <Route path="journey/bounties" element={<PageRoute><BountiesPage /></PageRoute>} />
        <Route path="journey/season" element={<PageRoute><SeasonalPage /></PageRoute>} />
        <Route path="journey/guardian-rank" element={<PageRoute><GuardianRankPage /></PageRoute>} />
        <Route path="journey/titles" element={<PageRoute><JourneyRecordsPage kind="titles" /></PageRoute>} />
        <Route path="journey/triumphs" element={<PageRoute><JourneyRecordsPage kind="triumphs" /></PageRoute>} />
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
        <Route path="next/*" element={<PageRoute><NextStepsPage /></PageRoute>} />
        <Route path="audience" element={<PageRoute><AudiencePage /></PageRoute>} />
        <Route path="gear" element={<PageRoute><GearPage /></PageRoute>} />
        <Route path="loadouts" element={<PageRoute><LoadoutsPage /></PageRoute>} />
        <Route path="builds" element={<PageRoute><BuildsPage /></PageRoute>} />
        <Route path="builds/new" element={<PageRoute><BuildEditorPage /></PageRoute>} />
        <Route path="builds/:buildId/edit" element={<PageRoute><BuildEditorPage /></PageRoute>} />
        <Route path="builds/:buildId" element={<PageRoute><BuildDetailPage /></PageRoute>} />
        <Route path="snapshots" element={<PageRoute><GuardianSnapshotsPage /></PageRoute>} />
        <Route path="snapshots/:snapshotSlug" element={<PageRoute><GuardianSnapshotsPage /></PageRoute>} />
        <Route path="mailbox" element={<PageRoute><MailboxPage /></PageRoute>} />
        <Route path="dev" element={<PageRoute><DevPage /></PageRoute>} />
        <Route path="*" element={<Navigate to="/director" replace />} />
      </Route>
    </Routes>
  );
}
