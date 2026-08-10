import { Activity, CheckCircle2, Clipboard, Copy, LogOut, Play, ShieldAlert, TriangleAlert, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { api, getClientReliabilityDiagnostics } from "../services/api/client";
import styles from "./SupportPage.module.css";

type Status = "pass" | "warning" | "fail" | "not-applicable";
interface DiagnosticTest { id: string; name: string; status: Status; durationMs: number; explanation: string; details?: Record<string, unknown>; httpStatus?: number; applicationCode?: string; bungieErrorCode?: number; bungieErrorStatus?: string; bungieMessage?: string; throttleSeconds?: number }
interface DiagnosticReport { reportVersion: number; timestamp: string; guardianNexus: Record<string, unknown>; session: Record<string, unknown>; tests: DiagnosticTest[]; profileTests: Array<Record<string, unknown>>; applicationBootstrap: Record<string, unknown>; diagnosis: { code: string; summary: string; nextSteps: string[] }; browser?: Record<string, unknown> }

export function SupportPage() {
  const [report, setReport] = useState<DiagnosticReport>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"text" | "json">();
  const [resetArmed, setResetArmed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const browser = useMemo(browserDiagnostics, []);
  const run = async () => {
    setRunning(true); setError(""); setCopied(undefined);
    const started = performance.now();
    try {
      const response = await api<DiagnosticReport>("/api/v1/support/diagnostics", { cache: "no-store" });
      const frontendCommit = String(browser.frontendCommit || "unknown");
      const backendCommit = String(response.data.guardianNexus.commit || "unknown");
      const clientTests: DiagnosticTest[] = [
        { id: "frontend-parse", name: "Frontend diagnostic response parsed", status: "pass", durationMs: 0, explanation: "The support bundle parsed the sanitized Worker response without depending on Guardian profile state." },
        { id: "frontend-state", name: "Support page state initialized", status: "pass", durationMs: 0, explanation: "The diagnostic report initialized and is allowed to render independently of the authenticated application shell." }
      ];
      setReport({ ...response.data, tests: [...response.data.tests, ...clientTests], browser: { ...browser, backendLatencyMs: Math.round(performance.now() - started), frontendParsedResponse: true, frontendBackendVersionMismatch: frontendCommit !== "unknown" && backendCommit !== "unknown" && frontendCommit !== backendCommit } });
    } catch (value) {
      setError(value instanceof Error ? value.message : "Diagnostics could not reach the Guardian Nexus Worker.");
    } finally { setRunning(false); }
  };
  const copy = async (kind: "text" | "json") => {
    if (!report) return;
    await navigator.clipboard.writeText(kind === "json" ? JSON.stringify(report, null, 2) : textReport(report));
    setCopied(kind);
  };
  const resetSignIn = async () => {
    if (!resetArmed) { setResetArmed(true); return; }
    setResetting(true); setResetError("");
    try {
      await api<{ reset: boolean }>("/api/v1/support/session-reset", { method: "POST", headers: { "X-Guardian-Nexus-Support-Action": "reset-current-sign-in" } });
      window.location.href = "/api/v1/auth/start?returnTo=%2Fsupport";
    } catch (value) {
      setResetError(value instanceof Error ? value.message : "Guardian Nexus could not clear this sign-in.");
      setResetting(false); setResetArmed(false);
    }
  };
  return <main className={styles.page}>
    <header className={styles.hero}><div><span><ShieldAlert /> Guardian Nexus support</span><h1>Account & Login Diagnostics</h1><p>This private tool follows the same session, Bungie membership, profile, character, and account-normalization chain used by Guardian Nexus. It does not move gear, change settings, or upload the report.</p></div><a href="/">Return to Guardian Nexus</a></header>
    <section className={styles.runPanel}><div><Activity /><span><b>Find the exact failed stage</b><small>Only the current browser session is inspected. Credentials, cookies, API keys, and authorization headers are never included.</small></span></div><div className={styles.runActions}><button onClick={() => void run()} disabled={running || resetting}><Play />{running ? "Running diagnostics…" : "Run Diagnostics"}</button><button className={styles.resetAction} onClick={() => void resetSignIn()} disabled={running || resetting}><LogOut />{resetting ? "Clearing sign-in…" : resetArmed ? "Confirm clear & reconnect" : "Cannot sign out?"}</button></div></section>
    {resetArmed && !resetting && <section className={styles.resetWarning}><TriangleAlert /><div><b>Clear Guardian Nexus sign-in on every browser?</b><p>This removes all Guardian Nexus login sessions for this account, clears this browser cookie, and starts Bungie authorization again. It does not alter the Destiny or Bungie account.</p></div><button onClick={() => setResetArmed(false)}>Cancel</button></section>}
    {resetError && <section className={styles.fatal}><XCircle /><div><b>Guardian Nexus could not clear this sign-in</b><p>{resetError}</p></div></section>}
    {error && <section className={styles.fatal}><XCircle /><div><b>Guardian Nexus Worker could not complete diagnostics</b><p>{error}</p></div></section>}
    {report && <>
      <section className={styles.diagnosis} data-code={report.diagnosis.code}><small>Likely cause · {report.diagnosis.code}</small><h2>{report.diagnosis.summary}</h2><ol>{report.diagnosis.nextSteps.map((step) => <li key={step}>{step}</li>)}</ol><div><button onClick={() => void copy("text")}><Clipboard />{copied === "text" ? "Report copied" : "Copy Diagnostic Report"}</button><button onClick={() => void copy("json")}><Copy />{copied === "json" ? "JSON copied" : "Copy JSON"}</button></div></section>
      <section className={styles.environment}><header><h2>Browser & deployment</h2><span>{String(report.guardianNexus.build || "unknown")} · {String(report.guardianNexus.commit || "unknown")}</span></header><dl>{Object.entries(report.browser || {}).map(([key, value]) => <div key={key}><dt>{friendly(key)}</dt><dd>{display(value)}</dd></div>)}</dl></section>
      <section className={styles.results}><header><h2>Diagnostic stages</h2><span>{report.tests.filter((test) => test.status === "pass").length}/{report.tests.length} passed</span></header>{report.tests.map((test) => <DiagnosticResult key={test.id} test={test} />)}</section>
      <details className={styles.raw}><summary>Sanitized profile probes and bootstrap JSON</summary><pre>{JSON.stringify({ profileTests: report.profileTests, applicationBootstrap: report.applicationBootstrap }, null, 2)}</pre></details>
    </>}
  </main>;
}

function DiagnosticResult({ test }: { test: DiagnosticTest }) {
  const Icon = test.status === "pass" ? CheckCircle2 : test.status === "fail" ? XCircle : TriangleAlert;
  return <article className={styles.result} data-status={test.status}><Icon /><div><header><b>{test.name}</b><span>{label(test.status)} · {test.durationMs} ms</span></header><p>{test.explanation}</p>{(test.httpStatus || test.applicationCode || test.bungieErrorCode || test.bungieErrorStatus || test.throttleSeconds) && <div className={styles.codes}>{test.httpStatus !== undefined && <code>HTTP {test.httpStatus}</code>}{test.applicationCode && <code>{test.applicationCode}</code>}{test.bungieErrorCode !== undefined && <code>Bungie {test.bungieErrorCode}</code>}{test.bungieErrorStatus && <code>{test.bungieErrorStatus}</code>}{test.throttleSeconds !== undefined && <code>Throttle {test.throttleSeconds}s</code>}</div>}{test.bungieMessage && <blockquote>{test.bungieMessage}</blockquote>}{test.details && <details><summary>Sanitized details</summary><pre>{JSON.stringify(test.details, null, 2)}</pre></details>}</div></article>;
}

function browserDiagnostics(): Record<string, unknown> {
  const storage = (kind: "localStorage" | "sessionStorage") => { try { const target = window[kind]; const key = "guardian-nexus-support-test"; target.setItem(key, "1"); target.removeItem(key); return true; } catch { return false; } };
  return {
    frontendVersion: import.meta.env.VITE_APP_VERSION || "0.1.0",
    frontendCommit: import.meta.env.VITE_GIT_COMMIT || "unknown",
    frontendBuiltAt: import.meta.env.VITE_BUILD_TIMESTAMP || "unknown",
    hostname: window.location.hostname,
    route: window.location.pathname,
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    cookiesEnabled: navigator.cookieEnabled,
    localStorageAvailable: storage("localStorage"),
    sessionStorageAvailable: storage("sessionStorage"),
    serviceWorkerActive: Boolean(navigator.serviceWorker?.controller),
    cacheStorageAvailable: "caches" in window,
    frontendCacheVersion: "network-only-no-service-worker",
    lastFireteamRouteError: getClientReliabilityDiagnostics()
  };
}

function textReport(report: DiagnosticReport): string {
  return [`Guardian Nexus Diagnostic Report v${report.reportVersion}`, `Timestamp: ${report.timestamp}`, `Diagnosis: ${report.diagnosis.code}`, report.diagnosis.summary, "", ...report.tests.flatMap((test) => [`[${label(test.status)}] ${test.name} (${test.durationMs} ms)`, test.explanation, ...[test.httpStatus && `HTTP ${test.httpStatus}`, test.applicationCode && `Application: ${test.applicationCode}`, test.bungieErrorCode !== undefined && `Bungie ErrorCode: ${test.bungieErrorCode}`, test.bungieErrorStatus && `Bungie ErrorStatus: ${test.bungieErrorStatus}`, test.bungieMessage && `Bungie Message: ${test.bungieMessage}`, test.throttleSeconds !== undefined && `ThrottleSeconds: ${test.throttleSeconds}`].filter(Boolean).map(String), test.details ? JSON.stringify(test.details, null, 2) : "", ""]), "Next steps:", ...report.diagnosis.nextSteps.map((step) => `- ${step}`)].join("\n");
}
function label(status: Status): string { return status === "not-applicable" ? "NOT APPLICABLE" : status.toUpperCase(); }
function friendly(value: string): string { return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()); }
function display(value: unknown): string { return typeof value === "boolean" ? value ? "Yes" : "No" : String(value ?? "Unknown"); }
