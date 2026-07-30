import type { FireteamCompletedTrackedItem, FireteamContact, FireteamData, FireteamMember, FireteamSharingMode, FireteamTrackedItem } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, BookmarkMinus, CheckCircle2, Copy, Crown, EyeOff, GripVertical, Link2, LogIn, MessageSquare, Radio, Repeat2, Share2, ShieldCheck, Timer, UserMinus, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, mutationHeaders, queuedApi } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { playCompletionChime, primeCompletionAudio } from "../services/completionAudio";
import styles from "./Pages.module.css";

interface ShareVariables {
  mode: FireteamSharingMode;
  sitePinnedQuestIds?: string[];
  siteTrackedGuardianRankIds?: string[];
  siteTrackedJourneyIds?: string[];
  siteTrackedCollectionIds?: string[];
  hiddenTrackedItemKeys?: string[];
  untrackingKey?: string;
}

const TRACKED_ITEM_EXIT_MS = 1_600;
const FIRETEAM_LOCATION_CSS = String.raw`
.gn-fireteam-location{position:relative;isolation:isolate}.gn-fireteam-location>*{position:relative;z-index:1}.gn-fireteam-location::before,.gn-fireteam-location::after{content:"";position:fixed;z-index:0;inset:130px 0 0;pointer-events:none}.gn-fireteam-location[data-fireteam-location-theme]::before{box-shadow:inset 18px 0 34px var(--loc-edge),inset -18px 0 34px var(--loc-edge);animation:gn-loc-breathe 5s ease-in-out infinite alternate}.gn-fireteam-location[data-fireteam-location-theme]::after{background:var(--loc-page);opacity:.42;animation:gn-loc-drift 12s linear infinite}
[data-location-theme]{border-color:var(--loc-line)!important;box-shadow:inset 0 0 26px var(--loc-glow),0 0 14px var(--loc-glow)}[data-location-theme]::before{content:"";position:absolute;z-index:0;inset:0;pointer-events:none;background:var(--loc-card);opacity:.6;animation:var(--loc-animation,gn-loc-drift 10s linear infinite)}
[data-location-theme=europa],.gn-fireteam-location[data-fireteam-location-theme=europa]{--loc-line:#c9f4ffbb;--loc-glow:#8ee8ff38;--loc-edge:#b8edff35;--loc-card:linear-gradient(132deg,#effdff50,transparent 32%),conic-gradient(from 214deg at 8% 110%,transparent 0 9deg,#dffaff5e 10deg 18deg,transparent 19deg 31deg,#91dbef45 32deg 42deg,transparent 43deg),conic-gradient(from 28deg at 91% -8%,transparent 0 16deg,#effdff48 17deg 27deg,transparent 28deg 47deg,#8dd8ed3d 48deg 57deg,transparent 58deg);--loc-page:conic-gradient(from 210deg at 0 104%,transparent 0 12deg,#e8fbff46 13deg 20deg,transparent 21deg 35deg,#8ed8ec3d 36deg 44deg,transparent 45deg),conic-gradient(from 34deg at 100% -4%,transparent 0 13deg,#dffaff42 14deg 23deg,transparent 24deg 39deg,#85d3e938 40deg 49deg,transparent 50deg),linear-gradient(116deg,transparent 8%,#e7fbff22 9% 10%,transparent 11% 77%,#a6e8f726 78% 79%,transparent 80%);--loc-animation:gn-frost 6s ease-in-out infinite alternate}
[data-location-theme=tower],.gn-fireteam-location[data-fireteam-location-theme=tower]{--loc-line:#f8e9b69b;--loc-glow:#fff1ad36;--loc-edge:#ffe39a31;--loc-card:radial-gradient(ellipse at 10% 92%,#fff3b1b0 0 1px,transparent 2px),radial-gradient(ellipse at 28% 18%,#fff8d7c0 0 1.5px,transparent 3px),radial-gradient(ellipse at 67% 71%,#ffe8929c 0 1px,transparent 2.5px),radial-gradient(ellipse at 91% 25%,#fff9d5b0 0 1px,transparent 2px),linear-gradient(110deg,transparent,#ffefb51c,transparent);--loc-page:radial-gradient(ellipse at 4% 88%,#fff3b1a0 0 1.5px,transparent 3px),radial-gradient(ellipse at 13% 21%,#fff9d5a0 0 1px,transparent 2.5px),radial-gradient(ellipse at 84% 74%,#ffe89290 0 1.5px,transparent 3px),radial-gradient(ellipse at 96% 17%,#fff9d5a0 0 1px,transparent 2.5px),linear-gradient(90deg,#f7d77c13,transparent 25% 75%,#f7d77c13);--loc-animation:gn-light 7s ease-in-out infinite alternate}
[data-location-theme=moon],.gn-fireteam-location[data-fireteam-location-theme=moon]{--loc-line:#c1766299;--loc-glow:#983e2935;--loc-edge:#a94c3430;--loc-card:radial-gradient(ellipse at 11% 28%,transparent 0 11px,#bc6b503f 12px 14px,transparent 15px),radial-gradient(ellipse at 78% 74%,transparent 0 18px,#7f30253b 19px 22px,transparent 23px),linear-gradient(126deg,transparent 30%,#c2735b31 31% 32%,transparent 33%);--loc-page:radial-gradient(ellipse at 5% 22%,transparent 0 42px,#a9564035 43px 47px,transparent 48px),radial-gradient(ellipse at 92% 75%,transparent 0 65px,#7c302539 66px 70px,transparent 71px),linear-gradient(118deg,#5521162b,transparent 42% 68%,#8c382528)}
[data-location-theme=dreaming],.gn-fireteam-location[data-fireteam-location-theme=dreaming]{--loc-line:#c9adf6aa;--loc-glow:#8d70c83d;--loc-edge:#b99aec31;--loc-card:linear-gradient(126deg,transparent 8%,#d9c5ff48 9% 10%,transparent 11% 31%,#91d9e440 32% 33%,transparent 34%),radial-gradient(ellipse at 18% 0,#c5a9f243,transparent 40%),radial-gradient(ellipse at 82% 100%,#6bc8dc2c,transparent 38%);--loc-page:linear-gradient(128deg,transparent 6%,#cfb6f331 7% 8%,transparent 9% 29%,#7ed8e52b 30% 31%,transparent 32%),radial-gradient(ellipse at 12% 35%,#997ac43a,transparent 31%),radial-gradient(ellipse at 88% 67%,#61b8d334,transparent 29%);--loc-animation:gn-mist 7s ease-in-out infinite alternate}
[data-location-theme=neomuna],.gn-fireteam-location[data-fireteam-location-theme=neomuna]{--loc-line:#61e7ef99;--loc-glow:#ef57d52a;--loc-edge:#49dae824;--loc-card:repeating-linear-gradient(90deg,transparent 0 58px,#48e7ef26 59px 60px),repeating-linear-gradient(0deg,transparent 0 31px,#ef57d51c 32px 33px);--loc-page:linear-gradient(115deg,#16bdcf16,transparent 35%,#df3fbd17);--loc-animation:gn-neon 4s steps(4) infinite}
[data-location-theme=nessus],.gn-fireteam-location[data-fireteam-location-theme=nessus]{--loc-line:#e47b68a0;--loc-glow:#dc523b32;--loc-edge:#c5523c29;--loc-card:linear-gradient(30deg,transparent 43%,#ef9b6a3b 44% 46%,transparent 47%),linear-gradient(150deg,transparent 35%,#de65503d 36% 38%,transparent 39%),radial-gradient(ellipse at 13% 92%,#d9523838,transparent 42%);--loc-page:linear-gradient(30deg,transparent 46%,#f09a6930 47% 48%,transparent 49%),linear-gradient(150deg,transparent 31%,#cf4f382d 32% 33%,transparent 34%),radial-gradient(ellipse at 5% 82%,#d14d3230,transparent 27%)}
[data-location-theme=edz],.gn-fireteam-location[data-fireteam-location-theme=edz]{--loc-line:#9bb87d99;--loc-glow:#668a4931;--loc-edge:#779b5929;--loc-card:radial-gradient(ellipse at 3% 110%,#789b5655,transparent 42%),radial-gradient(ellipse at 95% -10%,#a0b56f3b,transparent 35%),linear-gradient(104deg,transparent 31%,#b8c78730 32% 34%,transparent 35%);--loc-page:radial-gradient(ellipse at 0 96%,#6d914f42,transparent 31%),radial-gradient(ellipse at 100% 4%,#95a96535,transparent 27%),linear-gradient(116deg,transparent 17%,#aabb7930 18% 19%,transparent 20% 77%,#728e5530 78% 79%,transparent 80%)}
[data-location-theme=cosmodrome],.gn-fireteam-location[data-fireteam-location-theme=cosmodrome]{--loc-line:#c0967699;--loc-glow:#985e3b35;--loc-edge:#9e694b2d;--loc-card:linear-gradient(110deg,transparent 18%,#d1966d3c 19% 21%,transparent 22% 67%,#78432f4a 68% 71%,transparent 72%),repeating-linear-gradient(0deg,transparent 0 18px,#bd7a5030 19px 20px);--loc-page:linear-gradient(112deg,transparent 9%,#b7785035 10% 12%,transparent 13% 82%,#75402d36 83% 85%,transparent 86%),radial-gradient(ellipse at 88% 80%,#8d563531,transparent 30%)}
[data-location-theme=throne-world],.gn-fireteam-location[data-fireteam-location-theme=throne-world]{--loc-line:#acd491a4;--loc-glow:#63944838;--loc-edge:#86ba6930;--loc-card:conic-gradient(from 25deg at 8% 0,transparent 0 13deg,#b5df9345 14deg 18deg,transparent 19deg 31deg,#648f4a40 32deg 38deg,transparent 39deg),conic-gradient(from 202deg at 92% 100%,transparent 0 12deg,#91c1723e 13deg 18deg,transparent 19deg 34deg,#4e753a40 35deg 41deg,transparent 42deg);--loc-page:conic-gradient(from 31deg at 0 0,transparent 0 14deg,#9dca7d38 15deg 20deg,transparent 21deg 34deg,#587d4135 35deg 41deg,transparent 42deg),conic-gradient(from 211deg at 100% 100%,transparent 0 13deg,#8cb76e38 14deg 20deg,transparent 21deg 37deg,#486b3433 38deg 44deg,transparent 45deg)}
[data-location-theme=pale-heart],.gn-fireteam-location[data-fireteam-location-theme=pale-heart]{--loc-line:#eadcffad;--loc-glow:#84e3dd3d;--loc-edge:#dabfff35;--loc-card:conic-gradient(from 118deg at 17% 0,#ffcadf3b,#8ee9e33d,#dfc8ff45,transparent 43%),linear-gradient(128deg,transparent 37%,#ffffff4f 38% 39%,transparent 40%);--loc-page:conic-gradient(from 124deg at 6% 0,#f6c2dc31,#86dfdc30,#d7bfff38,transparent 39%),linear-gradient(132deg,transparent 21%,#f7edff37 22% 23%,transparent 24% 67%,#80dfdb30 68% 69%,transparent 70%)}
[data-location-theme=mars],.gn-fireteam-location[data-fireteam-location-theme=mars]{--loc-line:#e09561a0;--loc-glow:#c86b3638;--loc-edge:#d1753d30;--loc-card:radial-gradient(ellipse at 22% 115%,transparent 0 39%,#e28b5145 40% 43%,transparent 44%),radial-gradient(ellipse at 80% 115%,transparent 0 30%,#b653303f 31% 34%,transparent 35%),linear-gradient(112deg,#a94c2930,transparent 42%);--loc-page:radial-gradient(ellipse at 8% 115%,transparent 0 45%,#df87503c 46% 50%,transparent 51%),radial-gradient(ellipse at 91% 112%,transparent 0 36%,#ac4c2e3c 37% 41%,transparent 42%),linear-gradient(110deg,#a84e2832,transparent 36%)}
[data-location-theme=kepler],.gn-fireteam-location[data-fireteam-location-theme=kepler]{--loc-line:#9183eba9;--loc-glow:#654fd243;--loc-edge:#745fdf34;--loc-card:conic-gradient(from 90deg at 18% 0,transparent 0 17deg,#9d88ff45 18deg 21deg,transparent 22deg 37deg),radial-gradient(ellipse at 15% 0,#7355ec52,transparent 43%),radial-gradient(ellipse at 86% 100%,#3d2d9d38,transparent 40%);--loc-page:conic-gradient(from 88deg at 5% 0,transparent 0 18deg,#8e79ff35 19deg 22deg,transparent 23deg 38deg),radial-gradient(ellipse at 3% 12%,#664cd63f,transparent 32%),radial-gradient(ellipse at 94% 88%,#39298435,transparent 31%)}
[data-location-theme=dreadnaught],.gn-fireteam-location[data-fireteam-location-theme=dreadnaught]{--loc-line:#9dbc719f;--loc-glow:#5876373a;--loc-edge:#789b5131;--loc-card:conic-gradient(from 24deg at 6% 0,transparent 0 11deg,#9cbd713f 12deg 17deg,transparent 18deg 29deg,#536d3b42 30deg 36deg,transparent 37deg),linear-gradient(132deg,transparent 38%,#869f6038 39% 42%,transparent 43%);--loc-page:conic-gradient(from 27deg at 0 0,transparent 0 12deg,#90ad6937 13deg 18deg,transparent 19deg 32deg,#4a643536 33deg 39deg,transparent 40deg),linear-gradient(135deg,#34441f35,transparent 35% 70%,#617b432d)}
[data-location-theme=eternity],.gn-fireteam-location[data-fireteam-location-theme=eternity]{--loc-line:#86b9ef8c;--loc-glow:#8067b32b;--loc-edge:#8ab8ee1c;--loc-card:radial-gradient(circle,#d8e8ff99 0 1px,transparent 2px) 0 0/52px 39px;--loc-page:radial-gradient(circle,#fff 0 1px,transparent 2px) 0 0/79px 61px;--loc-animation:gn-stars 12s linear infinite}
[data-location-theme=orbit],.gn-fireteam-location[data-fireteam-location-theme=orbit]{--loc-line:#8aa9d6a6;--loc-glow:#5f7faf3d;--loc-edge:#7897c337;--loc-card:radial-gradient(ellipse at 72% 142%,#0b1526 0 43%,#294a745c 44%,#a6c8f078 46%,transparent 48%),radial-gradient(ellipse at 68% 130%,transparent 0 43%,#6d94c72e 48%,transparent 57%),radial-gradient(circle at 13% 21%,#ddebff 0 1px,transparent 2px),radial-gradient(circle at 31% 12%,#fff 0 .7px,transparent 1.5px),radial-gradient(circle at 88% 19%,#b9d4ff 0 1.2px,transparent 2.2px),linear-gradient(126deg,transparent 17%,#789ac21a 39%,transparent 62%);--loc-page:radial-gradient(ellipse at 78% 128%,#07101e 0 38%,#172c496f 39%,#41658e70 42%,#b8d6f067 43%,transparent 45%),radial-gradient(ellipse at 77% 124%,transparent 0 40%,#527aa446 45%,transparent 54%),radial-gradient(ellipse at 6% 116%,#111c30 0 24%,#385a7d52 25%,#9bbbd44c 27%,transparent 29%),radial-gradient(circle at 12% 18%,#ddebff 0 1px,transparent 2px),radial-gradient(circle at 34% 27%,#fff 0 .8px,transparent 1.7px),radial-gradient(circle at 59% 11%,#aac8ef 0 1.2px,transparent 2.2px),radial-gradient(circle at 91% 33%,#fff 0 .7px,transparent 1.5px),linear-gradient(126deg,transparent 12%,#7596bf17 37%,#a5c2e31f 43%,transparent 64%);--loc-animation:gn-orbit-clusters 10s ease-in-out infinite alternate}
[data-location-theme=destination],.gn-fireteam-location[data-fireteam-location-theme=destination]{--loc-line:#7da5b380;--loc-glow:#61cfe72a;--loc-edge:#61cfe718;--loc-card:linear-gradient(125deg,#61cfe719,transparent 40%);--loc-page:radial-gradient(ellipse at 8% 40%,#61cfe718,transparent 27%)}
@keyframes gn-loc-breathe{to{filter:brightness(1.35)}}@keyframes gn-loc-drift{to{background-position:80px 55px}}@keyframes gn-frost{to{filter:brightness(1.3);background-position:35px -20px}}@keyframes gn-light{to{background-position:43px -74px}}@keyframes gn-mist{to{transform:translateX(3%);filter:blur(2px)}}@keyframes gn-neon{50%{filter:brightness(1.6)}}@keyframes gn-stars{to{background-position:79px -61px}}@keyframes gn-orbit-clusters{from{filter:brightness(.82);transform:translate3d(-.2%,0,0)}to{filter:brightness(1.18);transform:translate3d(.35%,-.3%,0)}}
@media(prefers-reduced-motion:reduce){.gn-fireteam-location::before,.gn-fireteam-location::after,[data-location-theme]::before{animation:none}}html[data-reduced-motion=true] .gn-fireteam-location::before,html[data-reduced-motion=true] .gn-fireteam-location::after,html[data-reduced-motion=true] [data-location-theme]::before{animation:none}
`;

export function FireteamPage() {
  const { session, selectedCharacterId, preferences, setPreference } = useGuardian();
  const queryClient = useQueryClient();
  const result = useQuery({
    queryKey: ["fireteam", selectedCharacterId],
    queryFn: () => api<FireteamData>(`/api/v1/fireteam?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated),
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
  useEffect(() => {
    const prime = () => {
      primeCompletionAudio();
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
    window.addEventListener("pointerdown", prime);
    window.addEventListener("keydown", prime);
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);
  const data = result.data?.data;
  const membershipId = session?.guardian?.membershipId || "";
  const storageKey = membershipId && selectedCharacterId ? pinsKey(membershipId, selectedCharacterId) : "";
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readPinnedIds(storageKey));
  useEffect(() => setPinnedIds(readPinnedIds(storageKey)), [storageKey]);
  const preferenceGuardianRankIds = useMemo(() => trackedPreference(preferences["guardianRank.tracked"]), [preferences]);
  const [guardianRankIds, setGuardianRankIds] = useState(preferenceGuardianRankIds);
  useEffect(() => setGuardianRankIds(preferenceGuardianRankIds), [preferences["guardianRank.tracked"]]);
  const journeyIds = useMemo(() => trackedPreference(preferences["journey.tracked"]), [preferences]);
  const collectionIds = useMemo(() => trackedPreference(preferences["collection.tracked"]), [preferences]);
  const preferenceTrackedItemOrder = useMemo(() => trackedPreference(preferences["fireteam.trackedOrder"]), [preferences]);
  const [trackedItemOrder, setTrackedItemOrder] = useState(preferenceTrackedItemOrder);
  useEffect(() => setTrackedItemOrder(preferenceTrackedItemOrder), [preferences["fireteam.trackedOrder"]]);
  const hiddenTrackedItemKeys = data?.hiddenTrackedItemKeys || [];
  const [manualRemovingKey, setManualRemovingKey] = useState("");
  const share = useMutation({
    mutationFn: ({ mode, sitePinnedQuestIds = pinnedIds, siteTrackedGuardianRankIds = guardianRankIds, siteTrackedJourneyIds = journeyIds, siteTrackedCollectionIds = collectionIds, hiddenTrackedItemKeys: hiddenKeys = hiddenTrackedItemKeys }: ShareVariables) => queuedApi("/api/v1/fireteam/share", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ characterId: selectedCharacterId, sitePinnedQuestIds, siteTrackedGuardianRankIds, siteTrackedJourneyIds, siteTrackedCollectionIds, hiddenTrackedItemKeys: hiddenKeys, mode }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fireteam"] })
  });
  const stop = useMutation({
    mutationFn: () => queuedApi("/api/v1/fireteam/share", { method: "DELETE", headers: mutationHeaders(session?.csrfToken) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fireteam"] })
  });
  const sharingMode = data?.sharingMode;
  const syncSignature = shareSignature(selectedCharacterId, pinnedIds, guardianRankIds, journeyIds, collectionIds, hiddenTrackedItemKeys);
  const lastSyncSignature = useRef("");
  useEffect(() => {
    if (!result.data?.data.sharingEnabled || !sharingMode || sharingMode === "off") {
      lastSyncSignature.current = "";
      return;
    }
    if (lastSyncSignature.current === syncSignature || share.isPending || manualRemovingKey) return;
    lastSyncSignature.current = syncSignature;
    share.mutate({ mode: sharingMode });
  }, [result.data?.data.sharingEnabled, share, sharingMode, syncSignature, manualRemovingKey]);
  const self = data?.members.find((member) => member.isSelf);
  const trackedOrderContext = `${membershipId}:${selectedCharacterId}`;
  const previousTrackedOrderKeys = useRef<{ context: string; keys: Set<string> } | undefined>(undefined);
  const selfTrackedItems = self ? (Array.isArray(self.trackedItems) ? self.trackedItems : self.quests.map(legacyTrackedItem)) : [];
  const selfTrackedSignature = selfTrackedItems.map(trackedItemKey).sort().join("|");
  useEffect(() => {
    if (!self) return;
    const currentKeys = new Set(selfTrackedItems.map(trackedItemKey));
    const previous = previousTrackedOrderKeys.current;
    previousTrackedOrderKeys.current = { context: trackedOrderContext, keys: currentKeys };
    if (!previous || previous.context !== trackedOrderContext) {
      if (!trackedItemOrder.length && currentKeys.size) {
        const initialOrder = [...currentKeys];
        setTrackedItemOrder(initialOrder);
        setPreference("fireteam.trackedOrder", JSON.stringify(initialOrder));
      }
      return;
    }
    const addedKeys = [...currentKeys].filter((key) => !previous.keys.has(key));
    if (!addedKeys.length) return;
    const nextOrder = [...addedKeys, ...orderedTrackedItemKeys(selfTrackedItems, trackedItemOrder).filter((key) => !addedKeys.includes(key))];
    setTrackedItemOrder(nextOrder);
    setPreference("fireteam.trackedOrder", JSON.stringify(nextOrder));
  }, [selfTrackedSignature, trackedOrderContext]);
  const reorderTrackedItems = (sourceKey: string, targetKey: string) => {
    if (!self || sourceKey === targetKey) return;
    const sourceItems = Array.isArray(self.trackedItems) ? self.trackedItems : self.quests.map(legacyTrackedItem);
    const nextOrder = orderedTrackedItemKeys(sourceItems, trackedItemOrder);
    const sourceIndex = nextOrder.indexOf(sourceKey);
    const targetIndex = nextOrder.indexOf(targetKey);
    if (sourceIndex < 0 || targetIndex < 0) return;
    nextOrder.splice(targetIndex, 0, nextOrder.splice(sourceIndex, 1)[0]!);
    setTrackedItemOrder(nextOrder);
    setPreference("fireteam.trackedOrder", JSON.stringify(nextOrder));
  };
  const [copied, setCopied] = useState("");
  const copyCommand = async (label: string, command: string) => {
    if (!navigator.clipboard?.writeText) return;
    try { await navigator.clipboard.writeText(command); } catch { return; }
    setCopied(label);
    window.setTimeout(() => setCopied((current) => current === label ? "" : current), 1800);
  };
  const untrackItem = (item: FireteamTrackedItem) => {
    if (!sharingMode || sharingMode === "off") return;
    const key = trackedItemKey(item);
    const nextPinnedIds = item.kind !== "guardian-rank" && item.trackedInGuardianNexus
      ? pinnedIds.filter((id) => id !== item.id)
      : pinnedIds;
    const nextGuardianRankIds = item.kind === "guardian-rank" && item.trackedInGuardianNexus
      ? guardianRankIds.filter((id) => id !== item.id)
      : guardianRankIds;
    const nextJourneyIds = !["quest", "bounty", "order", "guardian-rank"].includes(item.kind) && item.trackedInGuardianNexus
      && item.kind !== "exotic"
      ? journeyIds.filter((id) => id !== item.id)
      : journeyIds;
    const nextCollectionIds = item.kind === "exotic" && item.trackedInGuardianNexus
      ? collectionIds.filter((id) => id !== item.id)
      : collectionIds;
    const nextHiddenKeys = new Set(hiddenTrackedItemKeys);
    if (item.trackedInDestiny) nextHiddenKeys.add(key); else nextHiddenKeys.delete(key);
    const hiddenKeys = [...nextHiddenKeys];

    if (nextPinnedIds !== pinnedIds) {
      setPinnedIds(nextPinnedIds);
      try { localStorage.setItem(storageKey, JSON.stringify(nextPinnedIds)); } catch { /* Keep the in-memory update. */ }
    }
    if (nextGuardianRankIds !== guardianRankIds) {
      setGuardianRankIds(nextGuardianRankIds);
      setPreference("guardianRank.tracked", JSON.stringify(nextGuardianRankIds));
    }
    if (nextJourneyIds !== journeyIds) setPreference("journey.tracked", JSON.stringify(nextJourneyIds));
    if (nextCollectionIds !== collectionIds) setPreference("collection.tracked", JSON.stringify(nextCollectionIds));

    lastSyncSignature.current = shareSignature(selectedCharacterId, nextPinnedIds, nextGuardianRankIds, nextJourneyIds, nextCollectionIds, hiddenKeys);
    setManualRemovingKey(key);
    window.setTimeout(() => {
      share.mutate({
        mode: sharingMode,
        sitePinnedQuestIds: nextPinnedIds,
        siteTrackedGuardianRankIds: nextGuardianRankIds,
        siteTrackedJourneyIds: nextJourneyIds,
        siteTrackedCollectionIds: nextCollectionIds,
        hiddenTrackedItemKeys: hiddenKeys,
        untrackingKey: key
      }, { onSettled: () => setManualRemovingKey((current) => current === key ? "" : current) });
    }, TRACKED_ITEM_EXIT_MS);
  };

  const pageLocationTheme = fireteamLocationTheme(presenceLocation(self, data?.activity), self?.onlineState);
  return <div className="gn-fireteam-location" data-fireteam-location-theme={pageLocationTheme}>
    <style>{FIRETEAM_LOCATION_CSS}</style>
    <AuthGate>
    <PageHeader eyebrow="Cooperative intelligence" title="Fireteam" description="Shared progress refreshes every 60 seconds while auto-refresh is enabled." actions={<>
      <Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />
      {data && !data.sharingEnabled && <>
        <button className={styles.primaryAction} onClick={() => share.mutate({ mode: "temporary" })} disabled={share.isPending}><Timer size={15} />Share 15 minutes</button>
        <button className={styles.primaryAction} onClick={() => share.mutate({ mode: "persistent" })} disabled={share.isPending}><Repeat2 size={15} />Always share</button>
      </>}
      {data?.sharingEnabled && <>
        {data.sharingMode === "temporary" && <button className={styles.primaryAction} onClick={() => share.mutate({ mode: "persistent" })} disabled={share.isPending}><Repeat2 size={15} />Make automatic</button>}
        <button className={`${styles.primaryAction} ${styles.sharing}`} onClick={() => stop.mutate()} disabled={stop.isPending}><Share2 size={15} />Stop sharing</button>
      </>}
    </>} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.fireteamStatus}>
        <div><Radio /><span>Fireteam signal</span><strong>{data.members.length > 1 ? `${data.members.length} Guardians` : "Solo"}</strong></div>
        <div><Activity /><span>Current location</span><strong>{presenceLocation(self, data.activity)}</strong></div>
        <div><ShieldCheck /><span>Your sharing</span><strong>{data.sharingMode === "persistent" ? "Always on / background refresh" : data.sharingMode === "temporary" ? "Temporary / 15 minutes" : "Private"}</strong></div>
      </section>
      <section className={styles.fireteamGrid}>{data.members.map((member) => <MemberCard key={member.membershipId} member={member} canManage={Boolean(self?.isLeader && !member.isSelf)} copied={copied} onCopy={copyCommand} onUntrack={member.isSelf ? untrackItem : undefined} itemOrder={member.isSelf ? trackedItemOrder : undefined} onReorder={member.isSelf ? reorderTrackedItems : undefined} untrackingKey={member.isSelf ? manualRemovingKey || (share.isPending ? share.variables?.untrackingKey : undefined) : undefined} />)}</section>
      <SocialRoster contacts={data.social?.contacts || []} friendsState={data.social?.friendsState || data.social?.state || "unavailable"} clanState={data.social?.clanState || (data.social?.state === "available" ? "available" : "unavailable")} warning={data.social?.warning} copied={copied} onCopy={copyCommand} />
      <section className={styles.transitoryNotice}><AlertTriangle /><div><strong>Status may be delayed</strong><p>Party presence and current activity are not guaranteed to be real time.</p></div></section>
    </>}
    </AuthGate>
  </div>;
}

function MemberCard({ member, canManage, copied, onCopy, onUntrack, itemOrder, onReorder, untrackingKey }: { member: FireteamMember; canManage: boolean; copied: string; onCopy: (label: string, command: string) => Promise<void>; onUntrack?: (item: FireteamTrackedItem) => void; itemOrder?: string[]; onReorder?: (sourceKey: string, targetKey: string) => void; untrackingKey?: string }) {
  const activity = presenceLocation(member);
  const trackedItems = Array.isArray(member.trackedItems) ? member.trackedItems : member.quests.map(legacyTrackedItem);
  const trackedItemKeys = trackedItems.map(trackedItemKey);
  const trackedItemSignature = [...trackedItemKeys].sort().join("|");
  const previousTrackedItemKeys = useRef<Set<string> | null>(null);
  const previousTrackedItems = useRef<Map<string, FireteamTrackedItem>>(new Map());
  const entryTimers = useRef<Map<string, number>>(new Map());
  const removalTimers = useRef<Map<string, number>>(new Map());
  const [enteringKeys, setEnteringKeys] = useState<Set<string>>(() => new Set());
  const [removedItems, setRemovedItems] = useState<Map<string, FireteamTrackedItem>>(() => new Map());
  const completedKeys = new Set((member.recentlyCompletedItems || []).map(trackedItemKey));
  useEffect(() => {
    const currentKeys = new Set(trackedItemKeys);
    const previousKeys = previousTrackedItemKeys.current;
    previousTrackedItemKeys.current = currentKeys;
    const currentItems = new Map(trackedItems.map((item) => [trackedItemKey(item), item]));
    const priorItems = previousTrackedItems.current;
    previousTrackedItems.current = currentItems;
    if (!previousKeys) return;

    const addedKeys = [...currentKeys].filter((key) => !previousKeys.has(key));
    if (addedKeys.length) setEnteringKeys((current) => new Set([...current, ...addedKeys]));
    for (const key of addedKeys) {
      const existingTimer = entryTimers.current.get(key);
      if (existingTimer) window.clearTimeout(existingTimer);
      const timer = window.setTimeout(() => {
        setEnteringKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        entryTimers.current.delete(key);
      }, 1_400);
      entryTimers.current.set(key, timer);
    }
    const removed = [...previousKeys]
      .filter((key) => !currentKeys.has(key) && !completedKeys.has(key))
      .map((key) => [key, priorItems.get(key)] as const)
      .filter((entry): entry is readonly [string, FireteamTrackedItem] => Boolean(entry[1]));
    if (removed.length) {
      setRemovedItems((current) => new Map([...current, ...removed]));
      for (const [key] of removed) {
        const existingTimer = removalTimers.current.get(key);
        if (existingTimer) window.clearTimeout(existingTimer);
        const timer = window.setTimeout(() => {
          setRemovedItems((current) => {
            const next = new Map(current);
            next.delete(key);
            return next;
          });
          removalTimers.current.delete(key);
        }, TRACKED_ITEM_EXIT_MS);
        removalTimers.current.set(key, timer);
      }
    }
  }, [trackedItemSignature, member.recentlyCompletedItems]);
  useEffect(() => () => {
    for (const timer of entryTimers.current.values()) window.clearTimeout(timer);
    entryTimers.current.clear();
    for (const timer of removalTimers.current.values()) window.clearTimeout(timer);
    removalTimers.current.clear();
  }, []);
  const recentlyCompletedItems = member.recentlyCompletedItems || [];
  const completedItemKeys = new Set(recentlyCompletedItems.map(trackedItemKey));
  const completedItemSignature = [...completedItemKeys].sort().join("|");
  useEffect(() => {
    if (!completedItemKeys.size) return;
    setRemovedItems((current) => {
      const next = new Map(current);
      let changed = false;
      for (const key of completedItemKeys) {
        if (next.delete(key)) changed = true;
        const timer = removalTimers.current.get(key);
        if (timer) {
          window.clearTimeout(timer);
          removalTimers.current.delete(key);
        }
      }
      return changed ? next : current;
    });
  }, [completedItemSignature]);
  const [dismissedCompletions, setDismissedCompletions] = useState<Set<string>>(() => readDismissedCompletionEvents(member.membershipId));
  const visibleCompletions = recentlyCompletedItems.filter((item) => !dismissedCompletions.has(completionEventKey(item)));
  const visibleCompletionKeys = visibleCompletions.map(completionEventKey).join("|");
  useEffect(() => {
    if (!visibleCompletionKeys) return;
    const keys = visibleCompletionKeys.split("|");
    playCompletionChime();
    const timer = window.setTimeout(() => {
      setDismissedCompletions((current) => {
        const next = new Set([...current, ...keys]);
        writeDismissedCompletionEvents(member.membershipId, next);
        return next;
      });
    }, 1_600);
    return () => window.clearTimeout(timer);
  }, [member.membershipId, visibleCompletionKeys]);
  const completingKeys = new Set(visibleCompletions.map(trackedItemKey));
  const orderedTrackedItems = orderTrackedItems(trackedItems, itemOrder);
  const visibleRemovedItems = [...removedItems.values()].filter((item) => !completedItemKeys.has(trackedItemKey(item)));
  const displayedItems = [...orderedTrackedItems.filter((item) => !completingKeys.has(trackedItemKey(item))), ...visibleCompletions, ...visibleRemovedItems];
  const [draggingKey, setDraggingKey] = useState("");
  const [dragOverKey, setDragOverKey] = useState("");
  const finishDrag = () => {
    setDraggingKey("");
    setDragOverKey("");
  };
  const onlineLabel = member.onlineState === "unknown" ? "" : ` / ${member.onlineState === "online" ? "Online" : "Offline"}`;
  const untrackingIsCompletion = Boolean(untrackingKey && completedItemKeys.has(untrackingKey));
  const cardEvent = visibleCompletions.length ? "completed" : (!untrackingIsCompletion && untrackingKey) || visibleRemovedItems.length ? "removed" : enteringKeys.size ? "added" : "idle";
  return <article className={`${styles.memberCard} ${member.isSelf ? styles.selfMember : ""} ${cardEvent === "completed" ? styles.memberCardCompleted : cardEvent === "removed" ? styles.memberCardRemoved : cardEvent === "added" ? styles.memberCardAdded : ""}`} data-tracking-event={cardEvent} data-location-theme={fireteamLocationTheme(activity, member.onlineState)}>
    <header>{member.emblemPath ? <img src={member.emblemPath} alt="" /> : <span><Users /></span>}<div><small>IGN / {member.isSelf ? `You / ${member.presenceLabel}` : member.presenceLabel}{onlineLabel} / {member.syncState === "synced" ? member.sharingMode === "persistent" ? "Auto synced" : "Synced" : "Not synced"}</small><h2>{member.inGameName}</h2><p>{member.character ? `${member.character.className} / ${member.character.power} Power` : "Public Bungie fireteam profile"}</p></div><div className={styles.memberSignals}>{member.isLeader && <Crown aria-label="Fireteam leader" />}<i className={member.sharing ? styles.signalLive : ""} /></div></header>
    <div className={styles.memberActivity}><Activity size={15} /><span>{member.onlineState === "offline" ? "Presence" : member.activitySource === "public" ? "Public location" : member.activitySource === "shared" ? "Shared activity" : "Location"}</span><strong>{activity}</strong></div>
    {member.sharing ? <div className={styles.sharedQuests}><h3>{member.sharingMode === "persistent" ? "Automatically shared tracked items" : "Shared tracked items"}</h3>{displayedItems.length ? displayedItems.map((item) => {
      const key = trackedItemKey(item);
      const transient = "completedAt" in item || removedItems.has(key);
      return <TrackedItem key={key} item={item} entering={enteringKeys.has(key)} completing={"completedAt" in item} onUntrack={onUntrack} untracking={untrackingKey === key || removedItems.has(key)} reorderable={Boolean(onReorder && !transient)} dragging={draggingKey === key} dragOver={dragOverKey === key && draggingKey !== key} onDragStart={() => setDraggingKey(key)} onDragOver={() => setDragOverKey(key)} onDrop={() => {
        if (draggingKey && draggingKey !== key) onReorder?.(draggingKey, key);
        finishDrag();
      }} onDragEnd={finishDrag} onMove={(direction) => {
        const activeItems = displayedItems.filter((candidate) => !("completedAt" in candidate) && !removedItems.has(trackedItemKey(candidate)));
        const index = activeItems.findIndex((candidate) => trackedItemKey(candidate) === key);
        const target = activeItems[index + direction];
        if (target) onReorder?.(key, trackedItemKey(target));
      }} />;
    }) : <p>Nothing is currently tracked.</p>}</div> : <div className={styles.privateMember}><EyeOff /><strong>Tracked details not shared</strong><p>This Guardian must opt into temporary or automatic sharing.</p></div>}
    {!member.isSelf && <div className={styles.memberCommands}><button onClick={() => void onCopy(`whisper-${member.membershipId}`, `/whisper ${member.inGameName} `)} title="Copies a Destiny 2 text-chat command"><MessageSquare size={13} />{copied === `whisper-${member.membershipId}` ? "Copied" : "Whisper"}</button>{canManage && <button className={styles.managementCommand} onClick={() => void onCopy(`kick-${member.membershipId}`, `/kick ${member.inGameName}`)} title="Copies a Destiny 2 text-chat command; Guardian Nexus cannot kick through the Bungie API"><UserMinus size={13} />{copied === `kick-${member.membershipId}` ? "Copied" : "Kick command"}</button>}</div>}
    {member.overlaps.length > 0 && <footer><Link2 size={13} /><span>Shared progress opportunity:</span><strong>{member.overlaps.join(", ")}</strong></footer>}
  </article>;
}

function TrackedItem({ item, entering = false, completing = false, onUntrack, untracking = false, reorderable = false, dragging = false, dragOver = false, onDragStart, onDragOver, onDrop, onDragEnd, onMove }: { item: FireteamTrackedItem; entering?: boolean; completing?: boolean; onUntrack?: (item: FireteamTrackedItem) => void; untracking?: boolean; reorderable?: boolean; dragging?: boolean; dragOver?: boolean; onDragStart?: () => void; onDragOver?: () => void; onDrop?: () => void; onDragEnd?: () => void; onMove?: (direction: -1 | 1) => void }) {
  const progressKnown = item.objectives.length === 0 || item.objectives.some((objective) => objective.progressAvailable);
  const manageable = Boolean(onUntrack && !completing);
  const untrackTitle = item.trackedInDestiny
    ? item.trackedInGuardianNexus ? "Untrack in Guardian Nexus and hide while Destiny still tracks it" : "Hide from Fireteam sharing until Destiny stops tracking it"
    : "Untrack in Guardian Nexus";
  const trackingState = completing ? "exiting" : entering ? "entering" : "active";
  const removing = untracking && !completing;
  return <div className={`${styles.sharedQuest} ${manageable ? styles.sharedQuestManageable : ""} ${reorderable ? styles.sharedQuestReorderable : ""} ${dragging ? styles.sharedQuestDragging : ""} ${dragOver ? styles.sharedQuestDragOver : ""} ${completing ? styles.sharedQuestCompleting : removing ? styles.sharedQuestRemoving : entering ? styles.sharedQuestEntering : ""}`} data-completion-state={completing ? "exiting" : "active"} data-tracking-state={removing ? "removing" : trackingState} onDragOver={reorderable ? (event) => { event.preventDefault(); onDragOver?.(); } : undefined} onDrop={reorderable ? (event) => { event.preventDefault(); onDrop?.(); } : undefined}>
    {reorderable && <button type="button" draggable className={styles.sharedQuestDragHandle} aria-label={`Reorder ${item.name}`} title="Drag to reorder" onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", trackedItemKey(item)); onDragStart?.(); }} onDragEnd={onDragEnd} onKeyDown={(event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      onMove?.(event.key === "ArrowUp" ? -1 : 1);
    }}><GripVertical /></button>}
    {completing && <span className={styles.sharedQuestCompletionFx} aria-hidden="true"><i /><b>{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</b><em><CheckCircle2 /></em></span>}
    <span className={styles.sharedQuestIcon}>{item.icon ? <img src={item.icon} alt="" /> : <CheckCircle2 />}</span>
    <div className={styles.sharedQuestDetails}>
      <div className={styles.sharedQuestTitle}><b>{item.name}</b><em>{item.context}</em></div>
      <small>{item.description}</small>
      {item.objectives.length > 0 && <div className={styles.sharedObjectives}>{item.objectives.map((objective) => <div key={objective.objectiveHash}><span>{objective.name}</span><strong>{objective.complete ? "Complete" : !objective.progressAvailable ? "Unavailable" : objective.completionValue > 0 ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}` : `${objective.percent}%`}</strong></div>)}</div>}
      {item.acquisitionGuide && <div className={styles.sharedAcquisitionGuide}><strong>How to get it</strong><p>{item.acquisitionGuide.summary}</p>{item.acquisitionGuide.steps.length > 0 && <ol>{item.acquisitionGuide.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>}{item.acquisitionGuide.prerequisites.length > 0 && <><strong>Prerequisites</strong><ul>{item.acquisitionGuide.prerequisites.map((step, index) => <li key={index}>{step}</li>)}</ul></>}</div>}
      <i className={styles.sharedQuestBar}><span style={{ width: `${progressKnown ? item.percent : 0}%` }} /></i>
    </div>
    <strong className={styles.sharedQuestPercent}>{progressKnown ? `${item.percent}%` : "—"}</strong>
    {manageable && <button type="button" className={styles.sharedQuestUntrack} onClick={() => onUntrack?.(item)} disabled={untracking} title={untrackTitle} aria-label={`Untrack ${item.name} from Fireteam`}><BookmarkMinus /></button>}
  </div>;
}

function trackedItemKey(item: Pick<FireteamTrackedItem, "kind" | "id">): string {
  return `${item.kind}:${item.id}`;
}

function orderedTrackedItemKeys(items: FireteamTrackedItem[], order: string[] = []): string[] {
  const available = new Set(items.map(trackedItemKey));
  const known = order.filter((key) => available.delete(key));
  return [...available, ...known];
}

function orderTrackedItems(items: FireteamTrackedItem[], order: string[] = []): FireteamTrackedItem[] {
  const byKey = new Map(items.map((item) => [trackedItemKey(item), item]));
  return orderedTrackedItemKeys(items, order).map((key) => byKey.get(key)!).filter(Boolean);
}

function completionEventKey(item: FireteamCompletedTrackedItem): string {
  return `${trackedItemKey(item)}:${item.completedAt}`;
}

function readDismissedCompletionEvents(membershipId: string): Set<string> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(completionDismissalStorageKey(membershipId)) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(-100) : []);
  } catch {
    return new Set();
  }
}

function writeDismissedCompletionEvents(membershipId: string, values: ReadonlySet<string>): void {
  try {
    sessionStorage.setItem(completionDismissalStorageKey(membershipId), JSON.stringify([...values].slice(-100)));
  } catch {
    // The current card still dismisses the event when browser storage is unavailable.
  }
}

function completionDismissalStorageKey(membershipId: string): string {
  return `guardian-nexus:fireteam-completions:${membershipId}`;
}

function legacyTrackedItem(quest: FireteamMember["quests"][number]): FireteamTrackedItem {
  const kind = quest.category || "quest";
  const label = kind === "bounty" ? "Bounty" : kind === "order" ? "Order" : "Quest";
  return {
    id: quest.instanceId,
    definitionHash: quest.itemHash,
    kind,
    name: quest.name,
    description: quest.currentStep || quest.description,
    icon: quest.icon,
    context: quest.activityName ? `${label} · ${quest.activityName}` : label,
    trackedInDestiny: quest.inGameTracked,
    trackedInGuardianNexus: quest.sitePinned,
    objectives: quest.objectives.map((objective) => ({ ...objective, progressAvailable: true })),
    percent: quest.percent,
    updatedAt: quest.updatedAt
  };
}

function trackedPreference(value?: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(0, 200) : [];
  } catch { return []; }
}

function readPinnedIds(storageKey: string): string[] {
  if (!storageKey) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(0, 40) : [];
  } catch { return []; }
}

function shareSignature(characterId: string, pinnedIds: string[], guardianRankIds: string[], journeyIds: string[], collectionIds: string[], hiddenKeys: string[]): string {
  return `${characterId}|${pinnedIds.join(",")}|${guardianRankIds.join(",")}|${journeyIds.join(",")}|${collectionIds.join(",")}|${hiddenKeys.join(",")}`;
}

function SocialRoster({ contacts, friendsState, clanState, warning, copied, onCopy }: { contacts: FireteamContact[]; friendsState: "available" | "reauthorization-required" | "unavailable"; clanState: "available" | "unavailable"; warning?: string; copied: string; onCopy: (label: string, command: string) => Promise<void> }) {
  const friends = contacts.filter((contact) => contact.source === "friend" || contact.source === "friend-and-clan");
  const clan = contacts.filter((contact) => contact.source === "clan" || contact.source === "friend-and-clan");
  return <section className={styles.socialRoster}>
    <header><div><Users /><span>Social roster</span><h2>Friends & clan</h2></div></header>
    <SocialGroup title="Bungie Friends" count={friends.length}>
      {friendsState === "reauthorization-required" ? <div className={styles.socialUnavailable}><AlertTriangle /><div><strong>Reconnect for Bungie friends</strong><p>{warning || "Bungie did not authorize access to the signed-in account's friend list."}</p></div><a href="/api/v1/auth/start?returnTo=%2Ffireteam">Reconnect Bungie</a></div>
        : friendsState === "unavailable" ? <div className={styles.socialUnavailable}><AlertTriangle /><div><strong>Bungie friends unavailable</strong><p>The friend-list request failed; clan members can still appear below.</p></div></div>
        : friends.length ? <div className={styles.socialGrid}>{friends.map((contact) => <SocialContact key={`friend-${contact.membershipId}-${contact.displayName}`} contact={contact} copied={copied} onCopy={onCopy} />)}</div>
        : <div className={styles.socialUnavailable}><Users /><div><strong>No Bungie friends returned</strong></div></div>}
    </SocialGroup>
    <SocialGroup title="Clan Members" count={clan.length}>
      {clanState === "unavailable" ? <div className={styles.socialUnavailable}><AlertTriangle /><div><strong>Clan roster unavailable</strong></div></div>
        : clan.length ? <div className={styles.socialGrid}>{clan.map((contact) => <SocialContact key={`clan-${contact.membershipId}-${contact.displayName}`} contact={contact} copied={copied} onCopy={onCopy} />)}</div>
        : <div className={styles.socialUnavailable}><Users /><div><strong>No clan members returned</strong><p>The signed-in Destiny membership may not currently belong to a clan.</p></div></div>}
    </SocialGroup>
  </section>;
}

function SocialGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className={styles.socialGroup}><header><h3>{title}</h3><span>{count}</span></header>{children}</section>;
}

function SocialContact({ contact, copied, onCopy }: { contact: FireteamContact; copied: string; onCopy: (label: string, command: string) => Promise<void> }) {
  const id = contact.membershipId || contact.displayName;
  const online = contact.onlineState === "online";
  const canJoin = canJoinContact(contact);
  const joinTitle = contact.onlineState === "unknown" ? "Bungie did not provide a confirmed online state" : !canJoin ? "This Guardian is currently offline" : contact.inDestiny2 ? "Copies /join for Destiny 2 text chat" : "Copies /join; Bungie shows this Guardian online but does not identify their current title";
  return <article className={styles.socialContact}><i className={online ? styles.socialOnline : ""} /><div><span>{contact.source === "friend-and-clan" ? "Friend · Clan" : contact.source}{contact.clanName ? ` · ${contact.clanName}` : ""}</span><strong>{contact.displayName}</strong><small>{online ? contact.inDestiny2 ? "Online in Destiny 2" : "Online · title unavailable" : contact.onlineState === "offline" ? "Offline" : "Offline or presence hidden"}</small></div><div><button disabled={!canJoin} onClick={() => void onCopy(`join-${id}`, `/join ${contact.displayName}`)} title={joinTitle}><LogIn size={13} />{copied === `join-${id}` ? "Copied" : "Join Fireteam"}</button><button disabled={!online} onClick={() => void onCopy(`friend-whisper-${id}`, `/whisper ${contact.displayName} `)} title="Copies /whisper for Destiny 2 text chat"><MessageSquare size={13} />{copied === `friend-whisper-${id}` ? "Copied" : "Whisper"}</button><button onClick={() => void onCopy(`name-${id}`, contact.displayName)} title="Copy Bungie Name"><Copy size={13} /></button></div></article>;
}

function presenceLocation(member: Pick<FireteamMember, "onlineState" | "activity"> | undefined, fallback?: string): string {
  if (member?.onlineState === "offline") return "Offline";
  if (member?.activity) return member.activity;
  if (fallback) return fallback;
  return member?.onlineState === "online" ? "Online · location unavailable" : "Presence unavailable";
}

export function fireteamLocationTheme(location: string | undefined, onlineState?: FireteamMember["onlineState"]): string | undefined {
  if (onlineState === "offline" || !location || /offline|unavailable|unknown/i.test(location)) return undefined;
  const value = location.toLocaleLowerCase();
  if (/\borbit\b/.test(value)) return "orbit";
  if (/tower|h\.e\.l\.m|helm/.test(value)) return "tower";
  if (/europa|eventide|cadmus|asterion/.test(value)) return "europa";
  if (/dreaming city|rheasilvia|d[ei]valian|strand/.test(value)) return "dreaming";
  if (/neomuna|neptune|zephyr|ahimsa|líming|liming/.test(value)) return "neomuna";
  if (/savath[uû]n|throne world|miasma|quagmire|fluorescent canal/.test(value)) return "throne-world";
  if (/pale heart|traveler/.test(value)) return "pale-heart";
  if (/cosmodrome|skywatch|mothyards/.test(value)) return "cosmodrome";
  if (/european dead zone|\bedz\b|tro[st]land|winding cove/.test(value)) return "edz";
  if (/nessus|cistern|artifact's edge|watcher's grave/.test(value)) return "nessus";
  if (/\bmoon\b|hellmouth|sorrow's harbor|archer's line/.test(value)) return "moon";
  if (/\bmars\b|enclave|braytech futurescape/.test(value)) return "mars";
  if (/kepler/.test(value)) return "kepler";
  if (/dreadnaught/.test(value)) return "dreadnaught";
  if (/eternity|dares of eternity|x[uû]r's treasure/.test(value)) return "eternity";
  if (/mercury|venus|io|titan|tangled shore|reef/.test(value)) return "destination";
  return "destination";
}

export function canJoinContact(contact: Pick<FireteamContact, "onlineState">): boolean {
  return contact.onlineState === "online";
}
