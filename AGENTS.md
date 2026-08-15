# AGENTS.md

Project-specific knowledge for agents working in this repo. Keep entries terse.

## Build & verify

- `npm run build` = `tsc && vite build` (typecheck + frontend bundle). Not in the README.
- Fast backend check: `cargo check --manifest-path src-tauri/Cargo.toml` (~1 min, incremental).
- **Production builds MUST go through `tauri build` (`npx tauri build`), never plain `cargo build --release`.** The CLI passes `--features tauri/custom-protocol`; without it `tauri::is_dev()` is true and the "release" exe loads `devUrl` (localhost) instead of embedding `dist/` — symptom: "localhost refused to connect" at launch.
- `vite.config.ts` pins `host: "127.0.0.1"` because Node otherwise bound only IPv6 `::1`, which IPv4 clients (WebView2/preview) can't reach.

## Architecture

- Rust commands live in `src-tauri/src/lib.rs`. Adding a command touches it in 4 places: the `#[tauri::command]` fn, the `generate_handler!` list at the bottom, a wrapper in `src/lib/tauri.ts`, and (when data is returned) a type in `src/lib/types.ts`. A React Query hook in `src/hooks/useGit.ts` usually follows.
- `types.ts` mirrors the Rust `#[derive(Serialize)]` structs field-for-field in **snake_case** (`short_oid`, `branch_names`), but IPC argument keys are **camelCase** in JS (`repoPath`). Tauri v2 converts the latter, not the former.
- Backend uses `git2` for most ops but shells out to the `git` CLI for commit signing (`-S`), rebase, submodule update, ssh-keygen, and `git credential` (libgit2 can't do those).
- Long-running commands: make them `async fn` + `tauri::async_runtime::spawn_blocking(f)` (returns an awaitable `JoinHandle` yielding `crate::Result<T>`). A sync command runs on the main thread and freezes the UI.

## Deployment & persistence

- Per-user NSIS install: app at `%LOCALAPPDATA%\git-started\git-started.exe`, data (WebView2 localStorage) at `%LOCALAPPDATA%\com.gitstarted.desktop`. `tauri build` does NOT update an existing install — copy the fresh `target/release` exe over it (or re-run the installer) to deploy locally.
- The NSIS uninstaller's "Delete app data" checkbox wipes `%APPDATA%\com.gitstarted.desktop` + `%LOCALAPPDATA%\com.gitstarted.desktop`; auto-update (`/UPDATE`) skips it. Durable user data (recent repos) must live in `dirs::config_dir()/git-started/` — never localStorage or `app_data_dir`.

## Versioning

- `scripts/set-version.mjs` patches `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` in place at build time; CI overrides via `FORCE_VERSION`.
- README says untagged = `0.0.0-dev.{sha}`, but actual is `0.0.0-{commit_count}` (numeric — MSI requires numeric pre-release). Trust the script, not the README.

## Known quirks (execution differs from how the code reads)

- `start_rebase` builds a todo list but runs `git rebase -i` with `GIT_SEQUENCE_EDITOR=cat`, so squash/fixup/reword/drop/reorder are silently ignored — the RebasePanel is cosmetic.
- `resolve_conflict` reads the file at `Path::new(&file_path)` (app CWD) instead of joining `repo_path` — conflict resolution fails outside the app's working directory.
- Inline `style` values like `#22C55E/20` and `var(--accent)/20` are invalid CSS (slash-alpha is Tailwind-class-only). The browser silently drops them.
- Tauri plugins need all three: Cargo.toml dep, `.plugin(...::init())` in `run()`, and a capability in `capabilities/default.json`. `window-state` is declared and granted but never initialized.
- Plugins with no config (e.g. `dialog`) must be omitted/null in `tauri.conf.json`'s `plugins` map — `"dialog": {}` crashes at startup (`invalid type: map, expected unit`). Compiles and bundles fine; only fails at runtime.
- `tasklist` shows "Console" in the Session column for every interactive app — that is the logon session, not a console window. To check GUI vs console, read the PE optional-header Subsystem word (2=GUI, 3=console) at file offset `e_lfanew + 4 + 20 + 68`, where `e_lfanew` is the Int32 at 0x3C.

## Shared checkout

- Other agents/threads work in this checkout and may revert uncommitted edits to tracked files or push to `main` mid-session (a Freebuff auto-commit titled "f" touching `.freebuff/desktop-v2.db*` is normal). Re-check `git status` after editing and `git fetch` + `git log origin/main..main` before pushing; never stage `.freebuff/`.
