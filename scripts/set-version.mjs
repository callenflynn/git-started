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
    // Describe the current commit relative to the nearest tag.
    const desc = execSync("git describe --tags --exact-match", {
      encoding: "utf-8",
    }).trim();
    // Strip leading "v" if present.
    return desc.replace(/^v/, "");
  } catch {
    // No tag on this commit. Use a dev version with a numeric pre-release.
    // MSI requires the pre-release part to contain only digits and be <= 65535.
    const count = execSync("git rev-list --count HEAD", {
      encoding: "utf-8",
    }).trim();
    return `0.0.0-${count}`;
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
