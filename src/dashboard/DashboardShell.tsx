import { useEffect, useState } from "react";

import { useGatewayHealth } from "../api/useGatewayHealth";
import {
  dashboardEntryAvailable,
  dashboardEntryStatus,
  dashboardGroups,
  resolveDashboardPage,
  type DashboardEntry,
} from "./dashboard-model";

function GatewayStatusCard() {
  const [status, refresh] = useGatewayHealth();
  const description = status.phase === "healthy"
    ? `Gateway is responding (${status.health.buildVersion}).`
    : status.phase === "unavailable"
      ? `Gateway is unavailable for this request (${status.reason}).`
      : status.phase === "checking"
        ? "Checking Gateway availability…"
        : status.phase === "aborted"
          ? "The availability request was cancelled."
          : "Availability has not been checked.";

  return (
    <article className="dashboard-card dashboard-status-card" aria-live="polite">
      <span className={`dashboard-health dashboard-health--${status.phase}`} aria-hidden="true" />
      <div>
        <p className="dashboard-kicker">Public service boundary</p>
        <h2>Gateway health</h2>
        <p>{description}</p>
      </div>
      <button type="button" onClick={refresh}>Check again</button>
    </article>
  );
}

function DashboardOverview() {
  return (
    <>
      <section className="dashboard-hero">
        <p className="dashboard-kicker">Client recovery</p>
        <h1>Knowhere dashboard</h1>
        <p>The navigation shell is restored. Features become interactive only after their public Gateway contracts and capability projections are ready.</p>
      </section>
      <div className="dashboard-grid">
        <GatewayStatusCard />
        <article className="dashboard-card">
          <p className="dashboard-kicker">Security posture</p>
          <h2>Public Gateway only</h2>
          <p>The dashboard does not call API, Keymaster, databases, tunnels, or local world hosts directly. Login, character, and world flows remain with their assigned implementation lanes.</p>
        </article>
        <article className="dashboard-card">
          <p className="dashboard-kicker">Capability policy</p>
          <h2>Unavailable stays visible</h2>
          <p>Planned and permissioned tools remain in the navigation tree, disabled with their current status instead of implying readiness.</p>
        </article>
      </div>
    </>
  );
}

function DashboardPage({ page }: Readonly<{ page: DashboardEntry }>) {
  if (page.id === "service-status") {
    return <><section className="dashboard-hero"><p className="dashboard-kicker">Diagnostics</p><h1>Service status</h1><p>This view uses only the existing credential-free Gateway health seam.</p></section><GatewayStatusCard /></>;
  }
  return <DashboardOverview />;
}

export function DashboardShell() {
  const [page, setPage] = useState(() => resolveDashboardPage(new URLSearchParams(window.location.search).get("page")));
  const [openGroups, setOpenGroups] = useState(() => new Set(dashboardGroups.filter((group) => group.initiallyOpen).map((group) => group.id)));

  useEffect(() => {
    function syncPageFromLocation() {
      setPage(resolveDashboardPage(new URLSearchParams(window.location.search).get("page")));
    }

    window.addEventListener("popstate", syncPageFromLocation);
    return () => window.removeEventListener("popstate", syncPageFromLocation);
  }, []);

  function navigate(entry: DashboardEntry) {
    if (!dashboardEntryAvailable(entry)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("page", entry.id);
    window.history.pushState({}, "", url);
    setPage(entry);
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  return (
    <main className="dashboard-shell" aria-label="Knowhere Dashboard">
      <aside className="dashboard-sidebar">
        <a className="dashboard-brand" href="/" aria-label="Knowhere home"><b>Knowhere</b><span>the Kingdom</span></a>
        <nav aria-label="Dashboard navigation">
          {dashboardGroups.map((group) => {
            const open = openGroups.has(group.id);
            return (
              <section className="dashboard-nav-group" key={group.id}>
                <button className="dashboard-nav-group__trigger" type="button" aria-expanded={open} onClick={() => toggleGroup(group.id)}>
                  <span aria-hidden="true">{open ? "▾" : "▸"}</span>{group.label}
                </button>
                {open && <ul>{group.entries.map((entry) => {
                  const available = dashboardEntryAvailable(entry);
                  return <li key={entry.id}><button type="button" disabled={!available} aria-current={page.id === entry.id ? "page" : undefined} title={`${entry.description} ${dashboardEntryStatus(entry)}`} onClick={() => navigate(entry)}><span>{entry.label}</span><small>{dashboardEntryStatus(entry)}</small></button></li>;
                })}</ul>}
              </section>
            );
          })}
        </nav>
      </aside>
      <section className="dashboard-content"><DashboardPage page={page} /></section>
    </main>
  );
}
