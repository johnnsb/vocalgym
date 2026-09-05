// Runs automatically before `npm run dev` (see the "predev" script in
// package.json). Next's dev server keeps a persistent, incrementally-updated
// build cache (.next/cache) across the process's lifetime, which is designed
// to reconcile individual file saves — not a git checkout/merge/rebase/pull
// landing a batch of files with new content and mtimes underneath a dev
// server that's still running (or about to start against a tree that just
// changed a lot). That can leave the cache referencing CSS/JS chunks that no
// longer match what's on disk, which is what caused the fully-unstyled-page
// bug this guard exists to prevent from recurring.
//
// Fix: clear .next whenever the current git commit differs from the commit
// the last `npm run dev` started under. Normal edit-save-reload cycles (no
// new commit) are untouched, so this costs nothing on the common path — it
// only pays the one-time recompile cost right after a branch switch/merge/
// pull, which is exactly when a stale cache is a real risk.

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
// Lives outside .next (which this script may delete) and outside git (so
// switching branches can't itself perturb the marker).
const markerDir = path.join(projectRoot, "node_modules", ".cache");
const markerFile = path.join(markerDir, "vocalgym-dev-head");

function currentHead() {
  try {
    return execSync("git rev-parse HEAD", { cwd: projectRoot }).toString().trim();
  } catch {
    return null; // not a git checkout — nothing to compare against, so skip
  }
}

const head = currentHead();
if (!head) process.exit(0);

const lastHead = existsSync(markerFile) ? readFileSync(markerFile, "utf8").trim() : null;

if (lastHead !== head) {
  const nextDir = path.join(projectRoot, ".next");
  if (existsSync(nextDir)) {
    console.log(
      `[dev-cache-guard] HEAD changed since the last \`npm run dev\` (${lastHead?.slice(0, 7) ?? "none"} -> ${head.slice(0, 7)}) — clearing .next to avoid a stale build cache.`,
    );
    rmSync(nextDir, { recursive: true, force: true });
  }
  mkdirSync(markerDir, { recursive: true });
  writeFileSync(markerFile, head);
}
