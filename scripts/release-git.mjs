#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repository = "tsderrick17/Joe-Barr-pickem";
const expectedAccount = "tsderrick17";

export function isSafeOrigin(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:"
      && url.hostname === "github.com"
      && !url.username
      && !url.password
      && !url.port
      && !url.search
      && !url.hash
      && /^\/tsderrick17\/Joe-Barr-pickem(?:\.git)?\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function classifyGitHubFailure(value) {
  if (/access permissions|connectex|dial tcp|network is unreachable|could not resolve|timed out|ETIMEDOUT/i.test(value)) {
    return "network";
  }
  if (/HTTP 401|bad credentials|authentication required|not logged in|invalid token/i.test(value)) {
    return "login";
  }
  return "unknown";
}

export function authenticatedGitEnv(token, original = process.env, platform = process.platform) {
  if (!token) throw new Error("GitHub CLI returned no token.");
  const count = Number(original.GIT_CONFIG_COUNT ?? 0);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid Git config environment.");
  const env = {
    ...original,
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "Never",
    GIT_TRACE: "0",
    GIT_CURL_VERBOSE: "0",
  };
  const settings = [
    ["credential.helper", ""],
    ...(platform === "win32" ? [["http.sslBackend", "openssl"]] : []),
    ["http.https://github.com/.extraheader", `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`],
  ];
  env.GIT_CONFIG_COUNT = String(count + settings.length);
  settings.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${count + index}`] = key;
    env[`GIT_CONFIG_VALUE_${count + index}`] = value;
  });
  return env;
}

function command(program, args, { env = process.env, timeout = 30_000 } = {}) {
  const result = spawnSync(program, args, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    timeout,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  });
  return {
    ok: result.status === 0 && !result.error,
    output: (result.stdout ?? "").trim(),
    error: (result.stderr ?? "") + (result.error?.message ?? ""),
  };
}

function localGit(args) {
  return command("git", args);
}

function githubGit(args, env, timeout) {
  return command("git", args, { env, timeout });
}

function originAndAuth(issues) {
  const origin = localGit(["remote", "get-url", "origin"]);
  const pushOrigin = localGit(["remote", "get-url", "--push", "origin"]);
  if (!origin.ok || !pushOrigin.ok || !isSafeOrigin(origin.output) || !isSafeOrigin(pushOrigin.output)) {
    issues.push(`Set origin to the credential-free https://github.com/${repository}.git URL.`);
    return null;
  }

  const account = command("gh", ["api", "user", "--jq", ".login"], { timeout: 15_000 });
  if (!account.ok) {
    const reason = classifyGitHubFailure(account.error);
    issues.push(reason === "network"
      ? "GitHub is unreachable here. Grant network access, then retry before starting another device login."
      : reason === "login"
        ? "GitHub CLI login expired. Run gh auth login --hostname github.com --git-protocol https --web and complete the device approval."
        : "GitHub CLI could not verify this account. Check network access and gh auth status before signing in again.");
    return null;
  }
  if (account.output !== expectedAccount) {
    issues.push(`GitHub CLI is signed in as ${account.output || "an unknown account"}; use ${expectedAccount}.`);
    return null;
  }

  const credential = command("gh", ["auth", "token"]);
  if (!credential.ok || !credential.output) {
    issues.push("GitHub CLI has no usable token. Complete gh auth login on your phone or computer.");
    return null;
  }
  return authenticatedGitEnv(credential.output);
}

function inspectRelease() {
  const issues = [];
  const branch = localGit(["symbolic-ref", "--short", "HEAD"]);
  if (!branch.ok || branch.output === "main") {
    issues.push("Use a named release branch instead of main or a detached checkout.");
  }
  const dirty = localGit(["status", "--porcelain", "--untracked-files=normal"]);
  if (!dirty.ok || dirty.output) {
    issues.push("Commit the release branch's intended changes before pushing once to GitHub.");
  }

  const env = originAndAuth(issues);
  let head = "";
  if (env) {
    const remoteMain = githubGit(["ls-remote", "--heads", "origin", "main"], env);
    if (!remoteMain.ok) {
      issues.push("Git transport cannot reach GitHub. Check network access; no new login is needed unless GitHub CLI reports HTTP 401.");
    } else {
      const remoteSha = remoteMain.output.split(/\s+/)[0];
      const localMain = localGit(["rev-parse", "refs/remotes/origin/main"]);
      if (!localMain.ok || localMain.output !== remoteSha) {
        issues.push("Local origin/main is stale. Run npm run release:fetch, then update the release branch from main.");
      } else if (branch.ok && branch.output !== "main") {
        const ancestor = localGit(["merge-base", "--is-ancestor", remoteSha, "HEAD"]);
        if (!ancestor.ok) issues.push("The release branch does not include current main. Update it before pushing.");
      }
    }
    const revision = localGit(["rev-parse", "HEAD"]);
    if (revision.ok) head = revision.output;
  }
  return { issues, branch: branch.output, head, env };
}

function reportIssues(issues) {
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
}

function main() {
  const action = process.argv[2];
  const dryRun = action === "push" && process.argv[3] === "--dry-run";
  if (!["check", "fetch", "push"].includes(action)) {
    console.error("Use: npm run release:check, release:fetch, or release:push.");
    process.exitCode = 1;
    return;
  }
  if (process.argv.length > (dryRun ? 4 : 3)) {
    console.error("The only supported option is --dry-run for release:push.");
    process.exitCode = 1;
    return;
  }

  if (action === "fetch") {
    const issues = [];
    const env = originAndAuth(issues);
    if (issues.length) return reportIssues(issues);
    const fetch = githubGit(["fetch", "origin", "main"], env, 60_000);
    if (!fetch.ok) return reportIssues(["Could not fetch main. Check network and repository access; the working tree was not changed."]);
    console.log("Fetched the latest main without changing working files or starting CI.");
    return;
  }

  const release = inspectRelease();
  if (release.issues.length) return reportIssues(release.issues);
  if (action === "check") {
    console.log(`Ready to publish ${release.branch} at ${release.head.slice(0, 7)}. One push will start the PR checks.`);
    return;
  }

  const remoteBranch = githubGit(["ls-remote", "--heads", "origin", release.branch], release.env);
  if (!remoteBranch.ok) return reportIssues(["Could not check the remote branch. Nothing was pushed."]);
  if (remoteBranch.output.split(/\s+/)[0] === release.head) {
    console.log(`${release.branch} is already current on GitHub; no new CI run was started.`);
    return;
  }

  const push = githubGit(["push", ...(dryRun ? ["--dry-run"] : []), "origin", `HEAD:refs/heads/${release.branch}`], release.env, 120_000);
  if (!push.ok) {
    if (!dryRun) {
      const afterPush = githubGit(["ls-remote", "--heads", "origin", release.branch], release.env);
      if (afterPush.ok && afterPush.output.split(/\s+/)[0] === release.head) {
        console.log(`Published ${release.branch} at ${release.head.slice(0, 7)}; GitHub received it despite a lost local acknowledgment.`);
        return;
      }
    }
    return reportIssues([/non-fast-forward|rejected|fetch first/i.test(push.error)
      ? "GitHub has a newer branch commit. Fetch and reconcile it before trying again; do not force push."
      : "The push could not be confirmed. Check network access and run release:push again; an already-current branch is skipped without starting CI."]);
  }
  console.log(dryRun
    ? `Push dry run passed for ${release.branch}; no CI run was started.`
    : `Published ${release.branch} at ${release.head.slice(0, 7)}. Open one PR and wait for its checks before merging.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
