import type { CSSProperties } from "react";
import type { NotificationCategory } from "@guardian-nexus/contracts";
import { BellRing, Check, Clipboard, Map, Play, RotateCcw, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AuthGate, PageHeader } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { notificationCategoryConfig } from "../modules/notifications/categoryConfig";
import {
  fireteamThemeDefinitions,
  fireteamThemeOptions,
  notificationThemeDefinitions,
  notificationThemeOptions,
  type FireteamThemeDefinition,
  type NotificationThemeDefinition,
  type ThemeOption,
  type ThemeOptionNumber
} from "./themeTestingData";
import styles from "./ThemeTestingPage.module.css";

const STORAGE_KEY = "guardian-nexus:admin-theme-testing:v1";

interface ThemeTestingState {
  notificationFamily: NotificationCategory;
  notificationOption: ThemeOptionNumber;
  fireteamTheme: string;
  fireteamOption: ThemeOptionNumber;
  notificationPicks: Partial<Record<NotificationCategory, ThemeOptionNumber>>;
  fireteamPicks: Record<string, ThemeOptionNumber>;
}

const defaultState: ThemeTestingState = {
  notificationFamily: "distortion",
  notificationOption: 1,
  fireteamTheme: "europa",
  fireteamOption: 1,
  notificationPicks: {},
  fireteamPicks: {}
};

export function ThemeTestingPage() {
  const { session } = useGuardian();
  const [state, setState] = useState<ThemeTestingState>(readThemeTestingState);
  const [notificationReplay, setNotificationReplay] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const activeNotification = useMemo(
    () => notificationThemeDefinitions.find((entry) => entry.id === state.notificationFamily) || notificationThemeDefinitions[0]!,
    [state.notificationFamily]
  );
  const activeFireteam = useMemo(
    () => fireteamThemeDefinitions.find((entry) => entry.id === state.fireteamTheme) || fireteamThemeDefinitions[0]!,
    [state.fireteamTheme]
  );

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Testing choices still work in memory. */ }
  }, [state]);

  if (session?.authenticated && !session.roles.dev) return <Navigate to="/director" replace />;

  const selectNotificationFamily = (family: NotificationCategory) => {
    setState((current) => ({
      ...current,
      notificationFamily: family,
      notificationOption: current.notificationPicks[family] || 1
    }));
    setNotificationReplay((value) => value + 1);
  };
  const selectNotificationOption = (option: ThemeOptionNumber) => {
    setState((current) => ({
      ...current,
      notificationOption: option,
      notificationPicks: { ...current.notificationPicks, [current.notificationFamily]: option }
    }));
    setNotificationReplay((value) => value + 1);
  };
  const selectSavedNotification = (definition: NotificationThemeDefinition, option: ThemeOptionNumber) => {
    setState((current) => ({
      ...current,
      notificationFamily: definition.id,
      notificationOption: option,
      notificationPicks: { ...current.notificationPicks, [definition.id]: option }
    }));
    setNotificationReplay((value) => value + 1);
  };
  const selectFireteamTheme = (theme: string) => {
    setState((current) => ({
      ...current,
      fireteamTheme: theme,
      fireteamOption: current.fireteamPicks[theme] || 1
    }));
  };
  const selectFireteamOption = (option: ThemeOptionNumber) => {
    setState((current) => ({
      ...current,
      fireteamOption: option,
      fireteamPicks: { ...current.fireteamPicks, [current.fireteamTheme]: option }
    }));
  };
  const selectSavedFireteam = (definition: FireteamThemeDefinition, option: ThemeOptionNumber) => {
    setState((current) => ({
      ...current,
      fireteamTheme: definition.id,
      fireteamOption: option,
      fireteamPicks: { ...current.fireteamPicks, [definition.id]: option }
    }));
  };
  const resetChoices = () => {
    setState(defaultState);
    setNotificationReplay((value) => value + 1);
  };
  const copyChoices = async () => {
    const notificationLines = notificationThemeDefinitions
      .filter((entry) => state.notificationPicks[entry.id])
      .map((entry) => `${notificationCategoryConfig[entry.id].label}: #${state.notificationPicks[entry.id]}`);
    const fireteamLines = fireteamThemeDefinitions
      .filter((entry) => state.fireteamPicks[entry.id])
      .map((entry) => `${entry.label}: #${state.fireteamPicks[entry.id]}`);
    const text = [
      "Guardian Nexus theme testing selections",
      "",
      "Notification fanfare",
      ...(notificationLines.length ? notificationLines : ["No notification choices saved."]),
      "",
      "Fireteam destination themes",
      ...(fireteamLines.length ? fireteamLines : ["No Fireteam choices saved."])
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied");
      window.setTimeout(() => setCopyStatus(""), 1_800);
    } catch {
      setCopyStatus("Copy unavailable");
    }
  };

  return <AuthGate>
    <div
      className={styles.page}
      data-fireteam-option={state.fireteamOption}
      data-fireteam-motif={activeFireteam.motif}
      style={fireteamStyle(activeFireteam)}
    >
      <div className={styles.pageWorld} aria-hidden="true">
        <i className={styles.pageWorldBackdrop} />
        <i className={styles.pageWorldLandmark} />
        <i className={styles.pageWorldWeather} />
        <i className={styles.pageWorldForeground} />
      </div>
      <span className={styles.pageRailLeft} aria-hidden="true" />
      <span className={styles.pageRailRight} aria-hidden="true" />
      <PageHeader eyebrow="Restricted visual laboratory" title="Theme Testing" description="Preview and save numbered candidates without changing production notification fanfare or Fireteam destination themes." />
      <section className={styles.adminNotice}>
        <ShieldAlert />
        <div><strong>Developer-admin sandbox</strong><p>Selections are browser-local testing references. Choosing a number does not assign that design to the live site.</p></div>
        <div className={styles.noticeActions}><button type="button" onClick={() => void copyChoices()}><Clipboard />{copyStatus || "Copy choices"}</button><button type="button" onClick={resetChoices}><RotateCcw />Reset</button></div>
      </section>

      <section className={styles.labSection}>
        <header className={styles.sectionHeader}>
          <BellRing />
          <div><span>Independent system A</span><h2>Notification fanfare laboratory</h2><p>Every family keeps its own motif. The eight numbered candidates change composition and motion without borrowing Fireteam edge styling.</p></div>
        </header>
        <div className={styles.familyPicker} aria-label="Notification family">
          {notificationThemeDefinitions.map((entry) => {
            const config = notificationCategoryConfig[entry.id];
            const Icon = config.icon;
            const saved = state.notificationPicks[entry.id];
            return <button type="button" key={entry.id} className={entry.id === activeNotification.id ? styles.activeFamily : ""} onClick={() => selectNotificationFamily(entry.id)}><Icon /><span>{config.label}</span>{saved && <b>#{saved}</b>}</button>;
          })}
        </div>
        <div className={styles.intent}><strong>{notificationCategoryConfig[activeNotification.id].label}</strong><span>{activeNotification.designIntent}</span></div>
        <NotificationPreview definition={activeNotification} option={state.notificationOption} replayKey={notificationReplay} />
        <button type="button" className={styles.replayButton} onClick={() => setNotificationReplay((value) => value + 1)}><Play />Replay selected fanfare</button>
        <div className={styles.variantGrid}>
          {notificationThemeOptions.map((option) => <NotificationVariantCard key={option.number} definition={activeNotification} option={option} selected={state.notificationOption === option.number} onSelect={selectNotificationOption} />)}
        </div>
      </section>

      <section className={styles.labSection}>
        <header className={styles.sectionHeader}>
          <Map />
          <div><span>Independent system B</span><h2>Fireteam destination laboratory</h2><p>Each destination owns its scenery, weather, silhouettes, particles, border material, and movement. The eight candidates are different compositions rather than resized versions of one frame.</p></div>
        </header>
        <div className={styles.familyPicker} aria-label="Fireteam destination">
          {fireteamThemeDefinitions.map((entry) => {
            const saved = state.fireteamPicks[entry.id];
            return <button type="button" key={entry.id} className={entry.id === activeFireteam.id ? styles.activeFamily : ""} onClick={() => selectFireteamTheme(entry.id)}><span>{entry.label}</span>{saved && <b>#{saved}</b>}</button>;
          })}
        </div>
        <div className={styles.intent}><strong>{activeFireteam.label}</strong><span>{activeFireteam.designIntent}</span></div>
        <FireteamPreview definition={activeFireteam} option={state.fireteamOption} />
        <div className={styles.variantGrid}>
          {fireteamThemeOptions.map((option) => <FireteamVariantCard key={option.number} definition={activeFireteam} option={option} selected={state.fireteamOption === option.number} onSelect={selectFireteamOption} />)}
        </div>
      </section>

      <SelectionLedger state={state} onNotificationSelect={selectSavedNotification} onFireteamSelect={selectSavedFireteam} />
    </div>
  </AuthGate>;
}

function NotificationVariantCard({ definition, option, selected, onSelect }: { definition: NotificationThemeDefinition; option: ThemeOption; selected: boolean; onSelect: (option: ThemeOptionNumber) => void }) {
  return <article className={`${styles.variantCard} ${selected ? styles.selectedVariant : ""}`}>
    <NotificationPreview definition={definition} option={option.number} compact />
    <footer><button type="button" onClick={() => onSelect(option.number)} aria-label={`Select notification theme ${option.number}`} title={`Select ${option.name}`}>{option.number}</button><div><strong>{option.name}</strong><p>{option.description}</p></div>{selected && <Check />}</footer>
  </article>;
}

function NotificationPreview({ definition, option, replayKey = 0, compact = false }: { definition: NotificationThemeDefinition; option: ThemeOptionNumber; replayKey?: number; compact?: boolean }) {
  const config = notificationCategoryConfig[definition.id];
  const Icon = config.icon;
  const optionDefinition = notificationThemeOptions.find((entry) => entry.number === option)!;
  return <div
    key={`${definition.id}:${option}:${replayKey}`}
    className={`${styles.notificationPreview} ${compact ? styles.compactNotification : ""}`}
    data-notification-option={option}
    data-notification-motif={definition.motif}
    style={notificationStyle(definition.id)}
  >
    <span className={styles.notificationAtmosphere} aria-hidden="true" />
    <span className={styles.notificationEvent} aria-hidden="true">
      <i className={styles.eventPrimary} />
      <i className={styles.eventSecondary} />
      <i className={styles.eventParticles} />
    </span>
    <div className={styles.notificationBanner}>
      <i><Icon /></i>
      <span><small>{config.label} · Candidate #{option}</small><strong>{compact ? optionDefinition.name : `${optionDefinition.name} theme preview`}</strong></span>
      <em>{compact ? `#${option}` : "Now"}</em>
      <b className={styles.notificationFx} aria-hidden="true" />
    </div>
  </div>;
}

function FireteamVariantCard({ definition, option, selected, onSelect }: { definition: FireteamThemeDefinition; option: ThemeOption; selected: boolean; onSelect: (option: ThemeOptionNumber) => void }) {
  return <article className={`${styles.variantCard} ${selected ? styles.selectedVariant : ""}`}>
    <FireteamPreview definition={definition} option={option.number} compact />
    <footer><button type="button" onClick={() => onSelect(option.number)} aria-label={`Select Fireteam theme ${option.number}`} title={`Select ${option.name}`}>{option.number}</button><div><strong>{option.name}</strong><p>{option.description}</p></div>{selected && <Check />}</footer>
  </article>;
}

function FireteamPreview({ definition, option, compact = false }: { definition: FireteamThemeDefinition; option: ThemeOptionNumber; compact?: boolean }) {
  return <div className={`${styles.fireteamPreview} ${compact ? styles.compactFireteam : ""}`} data-fireteam-option={option} data-fireteam-motif={definition.motif} style={fireteamStyle(definition)}>
    <div className={styles.destinationWorld} aria-hidden="true">
      <i className={styles.worldBackdrop} />
      <i className={styles.worldLandmark} />
      <i className={styles.worldWeather} />
      <i className={styles.worldForeground} />
      <i className={styles.worldAccent} />
    </div>
    <i className={styles.fireteamLeft} aria-hidden="true" />
    <i className={styles.fireteamRight} aria-hidden="true" />
    <article className={styles.guardianCard}>
      <header><span /><div><small>{definition.label} · Candidate #{option}</small><strong>Guardian destination frame</strong></div></header>
      <div className={styles.trackedPreview}><i /><span><strong>Tracked objective</strong><small>Destination border and signature element</small><b><em /></b></span><strong>68%</strong></div>
      {!compact && <div className={styles.trackedPreview}><i /><span><strong>Secondary tracked item</strong><small>Confirms repetition and density across multiple rows</small><b><em /></b></span><strong>42%</strong></div>}
    </article>
  </div>;
}

function SelectionLedger({ state, onNotificationSelect, onFireteamSelect }: { state: ThemeTestingState; onNotificationSelect: (definition: NotificationThemeDefinition, option: ThemeOptionNumber) => void; onFireteamSelect: (definition: FireteamThemeDefinition, option: ThemeOptionNumber) => void }) {
  return <section className={styles.ledger}>
    <header><div><span>Saved browser-local references</span><h2>Selection ledger</h2></div></header>
    <div>
      <section><h3>Notification fanfare</h3>{notificationThemeDefinitions.map((entry) => { const option = state.notificationPicks[entry.id]; return <button type="button" key={entry.id} disabled={!option} onClick={() => option && onNotificationSelect(entry, option)}><span>{notificationCategoryConfig[entry.id].label}</span><b>{option ? `#${option}` : "—"}</b></button>; })}</section>
      <section><h3>Fireteam locations</h3>{fireteamThemeDefinitions.map((entry) => { const option = state.fireteamPicks[entry.id]; return <button type="button" key={entry.id} disabled={!option} onClick={() => option && onFireteamSelect(entry, option)}><span>{entry.label}</span><b>{option ? `#${option}` : "—"}</b></button>; })}</section>
    </div>
  </section>;
}

function notificationStyle(category: NotificationCategory): CSSProperties {
  const config = notificationCategoryConfig[category];
  return {
    "--lab-primary": config.primaryColor,
    "--lab-accent": config.accentColor,
    "--lab-border": config.borderColor,
    "--lab-banner": config.backgroundGradient
  } as CSSProperties;
}

function fireteamStyle(definition: FireteamThemeDefinition): CSSProperties {
  return {
    "--fire-primary": definition.primary,
    "--fire-secondary": definition.secondary,
    "--fire-deep": definition.deep,
    "--fire-glow": definition.glow
  } as CSSProperties;
}

function readThemeTestingState(): ThemeTestingState {
  if (typeof localStorage === "undefined") return defaultState;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Partial<ThemeTestingState>;
    const notificationFamily = notificationThemeDefinitions.some((entry) => entry.id === parsed.notificationFamily) ? parsed.notificationFamily! : defaultState.notificationFamily;
    const fireteamTheme = fireteamThemeDefinitions.some((entry) => entry.id === parsed.fireteamTheme) ? parsed.fireteamTheme! : defaultState.fireteamTheme;
    const notificationOption = validOption(parsed.notificationOption) ? parsed.notificationOption : defaultState.notificationOption;
    const fireteamOption = validOption(parsed.fireteamOption) ? parsed.fireteamOption : defaultState.fireteamOption;
    return {
      notificationFamily,
      notificationOption,
      fireteamTheme,
      fireteamOption,
      notificationPicks: sanitizeNotificationPicks(parsed.notificationPicks),
      fireteamPicks: sanitizeFireteamPicks(parsed.fireteamPicks)
    };
  } catch {
    return defaultState;
  }
}

function validOption(value: unknown): value is ThemeOptionNumber {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 8;
}

function sanitizeNotificationPicks(value: unknown): Partial<Record<NotificationCategory, ThemeOptionNumber>> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const result: Partial<Record<NotificationCategory, ThemeOptionNumber>> = {};
  for (const entry of notificationThemeDefinitions) {
    const option = source[entry.id];
    if (validOption(option)) result[entry.id] = option;
  }
  return result;
}

function sanitizeFireteamPicks(value: unknown): Record<string, ThemeOptionNumber> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, ThemeOptionNumber> = {};
  for (const entry of fireteamThemeDefinitions) {
    const option = source[entry.id];
    if (validOption(option)) result[entry.id] = option;
  }
  return result;
}
