# git-started

[Documentation](https://cstaks-wiki.callen.page/en/Git-Started/Git-Started-Home)

A fast, native Git GUI built with [Tauri](https://tauri.app), React, and Rust.

![Theme: Dark](https://img.shields.io/badge/theme-dark-1E1E1E)
![Theme: AMOLED](https://img.shields.io/badge/theme-amoled-000000)
![Theme: Light](https://img.shields.io/badge/theme-light-FFEFE0)

## Features

- Commit graph with branch visualization
- Stage / unstage files and hunks
- Diff viewer
- Branch management (create, switch, delete)
- Push / Pull / Fetch
- Stash management
- Tags
- Remotes
- Three themes: Dark (default), AMOLED, Light

## Development

### Prerequisites

- [Rust](https://rustup.rs) (stable)
- [Node.js](https://nodejs.org) (20+)
- Platform build tools — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Run in dev mode

```bash
npm install
cargo tauri dev
```

### Versioning

The app version is derived from **git tags**, not manual edits.

```bash
# Tag a release
git tag v1.2.3
git push origin v1.2.3

# CI automatically builds with version "1.2.3"
```

Untagged commits on `main` get version `0.0.0-dev.{short_sha}`.

To preview the version locally:

```bash
node scripts/set-version.mjs
```

## Building & Releasing

### Automated (GitHub Actions)

The workflow at `.github/workflows/build.yml` runs on every push to `main`:

| Platform | Runner | Outputs |
|----------|--------|---------|
| macOS | `macos-latest` | `.dmg`, `.app` (universal binary) |
| Linux | `ubuntu-22.04` | `.deb`, `.AppImage` |
| Windows | `windows-latest` | `.msi`, `.exe` (NSIS installer) |

**To create a release:**

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers the `release` job, which uploads all installers to a GitHub Release.

### Manual

```bash
npm install
cargo tauri build
```

Output is in `src-tauri/target/release/bundle/`.

## Project Structure

```
git-started/
├── .github/workflows/build.yml   CI pipeline
├── scripts/set-version.mjs       Git-based versioning
├── src-tauri/                     Rust backend
│   ├── src/lib.rs                 Git commands (git2-rs)
│   ├── tauri.conf.json            Tauri config
│   └── Cargo.toml                 Rust dependencies
├── src/                           React frontend
│   ├── components/                UI components
│   ├── hooks/useGit.ts            React Query hooks
│   ├── lib/tauri.ts               IPC wrappers
│   └── stores/                    Zustand state
└── package.json
```

## License

MIT
