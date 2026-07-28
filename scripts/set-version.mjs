#!/usr/bin/env node

// Derives the app version from git tags.
//
// Tagged commit  (e.g. v1.2.3)  → "1.2.3"
// Other commit                  → "0.0.0-dev.{short_sha}"
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
    // No tag on this commit. Use a dev version.
    const sha = execSync("git rev-parse --short HEAD", {
      encoding: "utf-8",
    }).trim();
    return `0.0.0-dev.${sha}`;
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
