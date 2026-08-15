# AGENTS.md

Project-specific knowledge for agents working in this repo. Keep entries terse.

## Build & verify

- `npm run build` = `tsc && vite build` (typecheck + frontend bundle). Not in the README.
- Fast backend check: `cargo check --manifest-path src-tauri/Cargo.toml` (~1 min, incremental).

## Architecture

- Rust commands live in `src-tauri/src/lib.rs`. Adding a command touches it in 4 places: the `#[tauri::command]` fn, the `generate_handler!` list at the bottom, a wrapper in `src/lib/tauri.ts`, and (when data is returned) a type in `src/lib/types.ts`. A React Query hook in `src/hooks/useGit.ts` usually follows.
- `types.ts` mirrors the Rust `#[derive(Serialize)]` structs field-for-field in **snake_case** (`short_oid`, `branch_names`), but IPC argument keys are **camelCase** in JS (`repoPath`). Tauri v2 converts the latter, not the former.
- Backend uses `git2` for most ops but shells out to the `git` CLI for commit signing (`-S`), rebase, submodule update, ssh-keygen, and `git credential` (libgit2 can't do those).

## Versioning

- `scripts/set-version.mjs` patches `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` in place at build time; CI overrides via `FORCE_VERSION`.
- README says untagged = `0.0.0-dev.{sha}`, but actual is `0.0.0-{commit_count}` (numeric — MSI requires numeric pre-release). Trust the script, not the README.

## Known quirks (execution differs from how the code reads)

- `start_rebase` builds a todo list but runs `git rebase -i` with `GIT_SEQUENCE_EDITOR=cat`, so squash/fixup/reword/drop/reorder are silently ignored — the RebasePanel is cosmetic.
- `resolve_conflict` reads the file at `Path::new(&file_path)` (app CWD) instead of joining `repo_path` — conflict resolution fails outside the app's working directory.
- Inline `style` values like `#22C55E/20` and `var(--accent)/20` are invalid CSS (slash-alpha is Tailwind-class-only). The browser silently drops them.
- Tauri plugins need all three: Cargo.toml dep, `.plugin(...::init())` in `run()`, and a capability in `capabilities/default.json`. `window-state` is declared and granted but never initialized.
- Plugins with no config (e.g. `dialog`) must be omitted/null in `tauri.conf.json`'s `plugins` map — `"dialog": {}` crashes at startup (`invalid type: map, expected unit`). Compiles and bundles fine; only fails at runtime.
