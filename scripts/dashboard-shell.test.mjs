import assert from "node:assert/strict";
import test from "node:test";

import {
  dashboardEntryAvailable,
  dashboardEntryStatus,
  dashboardGroups,
  resolveDashboardPage,
} from "../src/dashboard/dashboard-model.ts";

test("dashboard keeps the established group defaults and unified page state", () => {
  assert.deepEqual(dashboardGroups.filter((group) => group.initiallyOpen).map((group) => group.id), ["account"]);
  assert.equal(resolveDashboardPage("service-status").id, "service-status");
  assert.equal(resolveDashboardPage("users").id, "overview");
  assert.equal(resolveDashboardPage("unknown").id, "overview");
});

test("planned and capability-gated tools stay visible but fail closed", () => {
  const entries = dashboardGroups.flatMap((group) => group.entries);
  const users = entries.find((entry) => entry.id === "users");
  const login = entries.find((entry) => entry.id === "login");
  assert.ok(users);
  assert.ok(login);
  assert.equal(dashboardEntryAvailable(users), false);
  assert.equal(dashboardEntryStatus(users), "Requires admin.dashboard.read");
  assert.equal(dashboardEntryAvailable(login), false);
  assert.equal(dashboardEntryStatus(login), "In progress · Creator");
});

test("dashboard exposes only overview and credential-free health as available", () => {
  const available = dashboardGroups.flatMap((group) => group.entries).filter(dashboardEntryAvailable).map((entry) => entry.id);
  assert.deepEqual(available, ["overview", "service-status"]);
});
