import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const experience = await readFile(new URL("../src/system-theme/SystemThemeExperience.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/system-theme/system-flow.css", import.meta.url), "utf8");

test("login errors render between the KNOWHERE heading and username field", () => {
  const login = experience.slice(experience.indexOf('flow.stage === "login"'), experience.indexOf(': <section className="system-login-progress"'));
  const heading = login.indexOf('className="system-login-heading"');
  const error = login.indexOf('className="system-error system-login-error"');
  const username = login.indexOf('name="username"');

  assert.ok(heading >= 0 && heading < error, "the heading must precede the login error");
  assert.ok(error < username, "the login error must precede the username field");
  assert.match(experience, /flow\.stage !== "login" && flow\.error/);
  assert.match(css, /\.system-login-error\s*\{[^}]+font-size: clamp\(1\.05rem, 2\.5vw, 1\.25rem\);[^}]+text-align: center;/s);
});

test("login progress uses one aligned status row and a full-width track", () => {
  assert.match(experience, /className="system-login-progress" aria-live="polite"/);
  assert.match(experience, /className="system-login-progress__status"/);
  assert.match(experience, /<output aria-label="Login progress">/);
  assert.match(css, /\.system-login-progress__status\s*\{[^}]+grid-template-columns: minmax\(0, 1fr\) auto;[^}]+align-items: baseline;/s);
  assert.match(css, /\.system-login-progress progress\s*\{[^}]+width: 100%;/s);
});

test("login shell stays compact with one uniform 2x2 seated key definition", () => {
  const panel = css.match(/\.system-panel\s*\{([^}]+)\}/)?.[1] ?? "";
  const shell = css.match(/\.system-access-shell\s*\{([^}]+)\}/)?.[1] ?? "";
  const seatedKeyRules = [...css.matchAll(/\.system-seated-key\s*\{([^}]+)\}/g)];
  const seatedKeySizeRules = seatedKeyRules.filter(([, body]) => /^\s*(?:width|height):/m.test(body));

  assert.match(panel, /width: min\(40rem, 100%\);/);
  assert.match(panel, /min-height: 38rem;/);
  assert.match(shell, /width: min\(40rem, 100%\);/);
  assert.equal(seatedKeySizeRules.length, 1, "viewport media rules must not resize the seated key");
  assert.match(seatedKeySizeRules[0][1], /width: 4rem;/);
  assert.match(seatedKeySizeRules[0][1], /height: 4rem;/);
  assert.doesNotMatch(css, /system-seated-key\s*\{[^}]+(?:clamp\(|6\.75rem|7\.5rem|9\.75rem)/s);
});
