#!/usr/bin/env node

// Derives the app version from git tags.
//
// Tagged commit  (e.g. v1.2.3)  → "1.2.3"
// Other commit                  → "0.0.0-{commit_count}"
//
// The MSI bundle target only accepts numeric pre-release identifiers.
// Use the total number of commits for the dev build number.
//
// Patches version in:
//   - src-tauri/tauri.conf.json
//   - src-tauri/Cargo.toml
//   - package.json

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

function gitVersion() {
  try {
    const desc = execSync("git describe --tags --exact-match", {
      encoding: "utf-8",
    }).trim();
    return desc.replace(/^v/, "");
  } catch {
    const sha = execSync("git rev-parse --short HEAD", {
      encoding: "utf-8",
    }).trim();
    // MSI/DEB require X.Y.Z format. Use 0.0.0-{sha} (valid semver pre-release).
    return `0.0.0-${sha}`;
  }
}

function patchFile(path, version) {
  const content = readFileSync(path, "utf-8");

  let patched;
  if (path.endsWith(".json")) {
    patched = content.replace(
      /"version"\s*:\s*"[^"]*"/,
      `"version": "${version}"`
    );
  } else if (path.endsWith(".toml")) {
    patched = content.replace(
      /^version\s*=\s*"[^"]*"/m,
      `version = "${version}"`
    );
  } else {
    console.error(`Unknown file type: ${path}`);
    process.exit(1);
  }

  writeFileSync(path, patched, "utf-8");
  console.log(`Patched ${path} → ${version}`);
}

const version = gitVersion();
console.log(`\n  Version: ${version}\n`);

patchFile("package.json", version);
patchFile("src-tauri/tauri.conf.json", version);
patchFile("src-tauri/Cargo.toml", version);
