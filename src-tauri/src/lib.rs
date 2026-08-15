use base64::Engine as _;
use git2::{Repository, Sort};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

// ────────────────────── Data types sent to the frontend ──────────────────────

#[derive(Serialize)]
pub struct RepoInfo {
    path: String,
    name: String,
    head_branch: String,
    is_dirty: bool,
}

#[derive(Serialize)]
pub struct CommitInfo {
    oid: String,
    short_oid: String,
    message: String,
    author: String,
    author_email: String,
    timestamp: i64,
    parent_oids: Vec<String>,
    branch_names: Vec<String>,
}

#[derive(Serialize)]
pub struct FileStatus {
    path: String,
    status: String,
    staged: bool,
    old_path: Option<String>,
}

#[derive(Serialize)]
pub struct CommitFileChange {
    path: String,
    status: String,
    old_path: Option<String>,
}

#[derive(Serialize)]
pub struct BranchInfo {
    name: String,
    is_head: bool,
    is_remote: bool,
    upstream: Option<String>,
}

#[derive(Serialize)]
pub struct StashInfo {
    index: usize,
    message: String,
    branch: String,
    timestamp: i64,
}

#[derive(Serialize)]
pub struct RemoteInfo {
    name: String,
    url: String,
}

#[derive(Serialize)]
pub struct TagInfo {
    name: String,
    oid: String,
    message: Option<String>,
}

#[derive(Serialize)]
pub struct SigningInfo {
    enabled: bool,
    format: String,
    key_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct RebaseCommit {
    oid: String,
    short_oid: String,
    message: String,
    author: String,
    timestamp: i64,
    operation: String,
    new_message: Option<String>,
}

#[derive(Serialize)]
pub struct RebaseStatus {
    in_progress: bool,
    current_head: Option<String>,
}

#[derive(Serialize)]
pub struct ConflictFile {
    path: String,
    ancestor: Option<String>,
    ours: Option<String>,
    theirs: Option<String>,
}

#[derive(Serialize)]
pub struct SubmoduleInfo {
    name: String,
    path: String,
    url: String,
    head_oid: String,
    status: String,
}

#[derive(Serialize)]
pub struct CredentialInfo {
    helper: String,
    storage: String,
    configured: bool,
}

#[derive(Serialize)]
pub struct BlameLine {
    line_number: u32,
    content: String,
    commit_oid: String,
    short_oid: String,
    author: String,
    timestamp: i64,
}

#[derive(Serialize)]
pub struct ReflogEntry {
    oid: String,
    short_oid: String,
    message: String,
    timestamp: i64,
}

#[derive(Serialize)]
pub struct RepoStats {
    commits: u64,
    branches: u64,
    tags: u64,
    remotes: u64,
    stashes: u64,
    contributors: u64,
    first_commit_time: i64,
    last_commit_time: i64,
    head_branch: String,
    is_dirty: bool,
}

// ────────────────────── Helper functions ──────────────────────

/// Convert a git2 Oid to a hex string.
fn oid_to_hex(oid: git2::Oid) -> String {
    oid.to_string()
}

// ────────────────────── Repo commands ──────────────────────

/// Open an existing repository at the given path.
#[tauri::command]
fn open_repo(path: String) -> Result<RepoInfo, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    build_repo_info(&repo, &path)
}

/// Clone a remote repository to a local destination.
#[tauri::command]
fn clone_repo(url: String, dest: String) -> Result<RepoInfo, String> {
    let repo = Repository::clone(&url, &dest).map_err(|e| e.to_string())?;
    build_repo_info(&repo, &dest)
}

/// Initialise a new empty repository.
#[tauri::command]
fn init_repo(path: String) -> Result<RepoInfo, String> {
    let repo = Repository::init(&path).map_err(|e| e.to_string())?;
    build_repo_info(&repo, &path)
}

fn build_repo_info(repo: &Repository, path: &str) -> Result<RepoInfo, String> {
    let head_branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().ok().map(String::from))
        .unwrap_or_else(|| "HEAD".to_string());

    let name = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let mut status_opts = git2::StatusOptions::new();
    let is_dirty = !repo
        .statuses(Some(&mut status_opts))
        .map_err(|e| e.to_string())?
        .is_empty();

    Ok(RepoInfo {
        path: path.to_string(),
        name,
        head_branch,
        is_dirty,
    })
}

// ────────────────────── Status commands ──────────────────────

/// Get the list of changed files in the working tree.
#[tauri::command]
fn get_status(repo_path: String) -> Result<Vec<FileStatus>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .show(git2::StatusShow::IndexAndWorkdir);

    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for entry in statuses.iter() {
        let path_str = entry
            .path()
            .map(String::from)
            .unwrap_or_default();

        let s = entry.status();

        // Staged files (files ready to be committed).
        if s.intersects(
            git2::Status::INDEX_NEW
                | git2::Status::INDEX_MODIFIED
                | git2::Status::INDEX_DELETED
                | git2::Status::INDEX_RENAMED
                | git2::Status::INDEX_TYPECHANGE,
        ) {
            let status = if s.contains(git2::Status::INDEX_NEW) {
                "added"
            } else if s.contains(git2::Status::INDEX_DELETED) {
                "deleted"
            } else if s.contains(git2::Status::INDEX_RENAMED) {
                "renamed"
            } else {
                "modified"
            };

            result.push(FileStatus {
                path: path_str.clone(),
                status: status.to_string(),
                staged: true,
                old_path: None,
            });
        }

        // Unstaged files in the working directory (modified files not added to staging).
        if s.intersects(
            git2::Status::WT_MODIFIED
                | git2::Status::WT_DELETED
                | git2::Status::WT_RENAMED
                | git2::Status::WT_TYPECHANGE,
        ) {
            let status = if s.contains(git2::Status::WT_DELETED) {
                "deleted"
            } else if s.contains(git2::Status::WT_RENAMED) {
                "renamed"
            } else {
                "modified"
            };

            result.push(FileStatus {
                path: path_str.clone(),
                status: status.to_string(),
                staged: false,
                old_path: None,
            });
        }

        // New files that Git does not track yet.
        if s.contains(git2::Status::WT_NEW) {
            result.push(FileStatus {
                path: path_str,
                status: "untracked".to_string(),
                staged: false,
                old_path: None,
            });
        }
    }

    Ok(result)
}

/// Get the text differences for one file.
    /// If `staged` is true, compare the changes in the staging area against the latest commit (HEAD).
#[tauri::command]
fn get_diff(repo_path: String, file_path: String, staged: bool) -> Result<String, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let mut diff_opts = git2::DiffOptions::new();
    diff_opts.pathspec(&file_path);
    // Show untracked files as additions so line-staging and diffing work for
    // brand-new files too (git2 excludes them by default).
    diff_opts.include_untracked(true);
    diff_opts.recurse_untracked_dirs(true);

    let diff = if staged {
        let head = repo.head().and_then(|r| r.peel_to_commit()).ok();
        let mut index = repo.index().map_err(|e| e.to_string())?;
        let tree = index
            .write_tree()
            .ok()
            .and_then(|oid| repo.find_tree(oid).ok());

        match (head, tree) {
            (Some(head), Some(tree)) => {
                let head_tree = head.tree().map_err(|e| e.to_string())?;
                repo.diff_tree_to_tree(Some(&head_tree), Some(&tree), Some(&mut diff_opts))
                    .map_err(|e| e.to_string())?
            }
            (None, Some(tree)) => {
                repo.diff_tree_to_workdir(Some(&tree), Some(&mut diff_opts))
                    .map_err(|e| e.to_string())?
            }
            _ => {
                repo.diff_index_to_workdir(None, Some(&mut diff_opts))
                    .map_err(|e| e.to_string())?
            }
        }
    } else {
        repo.diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| e.to_string())?
    };

    let mut patch_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let content = std::str::from_utf8(line.content()).unwrap_or("");
        patch_text.push_str(content);
        true
    })
    .map_err(|e| e.to_string())?;

    Ok(patch_text)
}

// ────────────────────── Commit commands ──────────────────────

/// Get the commit log.
#[tauri::command]
fn get_log(repo_path: String, max: Option<usize>) -> Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().map_err(|e| e.to_string())?;

    // Collect all branch names mapped to their tip oid.
    let mut branch_map: std::collections::HashMap<String, git2::Oid> =
        std::collections::HashMap::new();
    if let Ok(branches) = repo.branches(Some(git2::BranchType::Local)) {
        for (branch, _bt) in branches.flatten() {
            if let Ok(ref_name) = branch.get().name() {
                if let Ok(Some(oid)) = branch.get().resolve().map(|r| r.target()) {
                    let short = ref_name
                        .strip_prefix("refs/heads/")
                        .unwrap_or(ref_name)
                        .to_string();
                    branch_map.insert(short, oid);
                }
            }
        }
    }

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(Sort::TOPOLOGICAL | Sort::TIME)
        .map_err(|e| e.to_string())?;

    // Walk every local branch tip (not just HEAD) so parallel branches appear
    // in the graph. This mirrors `git log --all`.
    if let Ok(branches) = repo.branches(Some(git2::BranchType::Local)) {
        for (branch, _bt) in branches.flatten() {
            if let Some(target) = branch.get().target() {
                revwalk.push(target).ok();
            }
        }
    }
    // Always include HEAD itself, even when detached.
    revwalk
        .push(head.target().ok_or("HEAD has no target")?)
        .map_err(|e| e.to_string())?;

    let limit = max.unwrap_or(1000);
    let mut result = Vec::new();

    for (i, oid_result) in revwalk.enumerate() {
        if i >= limit {
            break;
        }
        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

        let parent_oids: Vec<String> = commit.parent_ids().map(oid_to_hex).collect();

        // Find which branches point at this commit.
        let branch_names: Vec<String> = branch_map
            .iter()
            .filter(|(_, &tip)| tip == oid)
            .map(|(name, _)| name.clone())
            .collect();

        let time = commit.time().seconds();
        let author = commit.author().name().unwrap_or("").to_string();
        let author_email = commit.author().email().unwrap_or("").to_string();

        let message = commit.message().unwrap_or("").to_string();
        // Only take the first line of the message for the graph view.
        let message = message.lines().next().unwrap_or("").to_string();

        result.push(CommitInfo {
            oid: oid_to_hex(oid),
            short_oid: oid_to_hex(oid)[..7.min(oid_to_hex(oid).len())].to_string(),
            message,
            author,
            author_email,
            timestamp: time,
            parent_oids,
            branch_names,
        });
    }

    Ok(result)
}

/// Create a new commit with the staged files.
/// If `sign` is true, the program runs the `git commit -S` command line tool to add a GPG or SSH signature.
#[tauri::command]
fn do_commit(
    repo_path: String,
    message: String,
    amend: bool,
    sign: bool,
) -> Result<String, String> {
    if sign {
        // Run the command line tool `git commit -S` for signatures.
        // The libgit2 library does not include built-in signing functions.
        let mut args = vec!["commit", "-S", "--allow-empty", "-m", &message];
        if amend {
            args.push("--amend");
        }
        let output = Command::new("git")
            .current_dir(&repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("git commit -S failed: {}", stderr));
        }

        // Parse the new commit hash from output.
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Ok(parse_commit_hash_from_output(&stdout, &repo_path));
    }

    // Unsigned commit via libgit2.
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let sig = repo.signature().map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.write_tree().map_err(|e| e.to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;
    let head_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

    if amend {
        if let Some(old) = head_commit {
            let oid = old
                .amend(Some("HEAD"), Some(&sig), Some(&sig), None, Some(&message), Some(&tree))
                .map_err(|e| e.to_string())?;
            return Ok(oid_to_hex(oid));
        }
    }

    let parent_commits: Vec<git2::Commit> = head_commit.into_iter().collect();
    let parent_refs: Vec<&git2::Commit> = parent_commits.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parent_refs)
        .map_err(|e| e.to_string())?;

    Ok(oid_to_hex(oid))
}

/// Parse the commit hash from `git commit` output.
fn parse_commit_hash_from_output(stdout: &str, repo_path: &str) -> String {
    // Try to read HEAD directly since git commit output varies.
    if let Ok(repo) = Repository::open(repo_path) {
        if let Ok(head) = repo.head() {
            if let Some(oid) = head.target() {
                return oid_to_hex(oid);
            }
        }
    }
    // Fallback: parse "[branch abc1234] message" format.
    if let Some(start) = stdout.find("] ") {
        let rest = &stdout[start + 2..];
        if let Some(end) = rest.find(' ') {
            return rest[..end].to_string();
        }
    }
    "unknown".to_string()
}

/// Read commit signing configuration from git config.
#[tauri::command]
fn get_signing_info(repo_path: String) -> Result<SigningInfo, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let cfg = repo.config().map_err(|e| e.to_string())?;

    let format = cfg
        .get_string("gpg.format")
        .unwrap_or_else(|_| "openpgp".to_string());

    let key_id = match format.as_str() {
        "ssh" => cfg
            .get_string("user.signingkey")
            .unwrap_or_else(|_| cfg
                .get_string("gpg.ssh.defaultKeyCommand")
                .unwrap_or_default()),
        _ => cfg
            .get_string("user.signingkey")
            .unwrap_or_default(),
    };

    let enabled = !key_id.is_empty();

    Ok(SigningInfo {
        enabled,
        format,
        key_id,
    })
}

// ────────────────────── Staging commands ──────────────────────

/// Stage a single file by path.
#[tauri::command]
fn stage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_path(Path::new(&file_path))
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove a single file from the staging area. This cancels the staged change using data from the latest commit (HEAD).
#[tauri::command]
fn unstage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().and_then(|h| h.peel(git2::ObjectType::Tree)).ok();
    repo.reset_default(head.as_ref(), [Path::new(&file_path)])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Stage all tracked and untracked files.
#[tauri::command]
fn stage_all(repo_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_all(["*"], git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove all files from the staging area. This keeps your file modifications but resets the staging area state to match the latest commit (HEAD).
#[tauri::command]
fn unstage_all(repo_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().and_then(|h| h.peel(git2::ObjectType::Tree)).ok();
    let empty_paths: Vec<&Path> = Vec::new();
    repo.reset_default(head.as_ref(), empty_paths).map_err(|e| e.to_string())?;
    Ok(())
}

// ────────────────────── Line-level staging ──────────────────────

/// Stage (staged=false) or unstage (staged=true) individual lines of a file.
/// `add_lines` are 1-based line numbers on the *new* side (the `+` lines in
/// the diff); `del_lines` are 1-based line numbers on the *old* side (the `-`
/// lines). The index is rewritten to the old content plus the chosen subset of
/// changes, so unrelated hunks stay untouched.
#[tauri::command]
fn stage_lines(
    repo_path: String,
    file_path: String,
    staged: bool,
    add_lines: Vec<u32>,
    del_lines: Vec<u32>,
) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let old = read_blob_bytes(&repo, &file_path, "HEAD");
    let new = if staged {
        read_blob_bytes(&repo, &file_path, "index")
    } else {
        std::fs::read(Path::new(&repo_path).join(&file_path)).ok()
    };

    let old_lines = split_lines(old.as_deref().unwrap_or(&[]));
    let new_lines = split_lines(new.as_deref().unwrap_or(&[]));

    // LCS is O(n*m); bail out on pathological inputs instead of hanging.
    if old_lines.len().saturating_mul(new_lines.len()) > 2_000_000 {
        return Err(
            "File is too large for line-level staging. Stage the whole file instead.".to_string(),
        );
    }

    let sel_add: std::collections::HashSet<u32> = add_lines.into_iter().collect();
    let sel_del: std::collections::HashSet<u32> = del_lines.into_iter().collect();

    // Stage = keep selected; unstage = revert selected (keep the rest).
    let target = partial_apply(&old_lines, &new_lines, &sel_add, &sel_del, !staged);

    write_partial_to_index(&repo, &file_path, target.as_bytes())
}

/// Raw bytes of a file at a revision: "HEAD" = HEAD tree, "index" = staged
/// blob. Returns None when the path is absent.
fn read_blob_bytes(repo: &Repository, file_path: &str, revision: &str) -> Option<Vec<u8>> {
    match revision {
        "HEAD" => {
            let head = repo.head().ok()?;
            let commit = head.peel_to_commit().ok()?;
            let tree = commit.tree().ok()?;
            let entry = tree.get_path(Path::new(file_path)).ok()?;
            entry.to_object(repo).ok()?.as_blob().map(|b| b.content().to_vec())
        }
        "index" => {
            let index = repo.index().ok()?;
            let entry = index.get_path(Path::new(file_path), 0)?;
            repo.find_blob(entry.id).ok().map(|b| b.content().to_vec())
        }
        _ => None,
    }
}

/// Split raw bytes into lines, preserving each line's trailing newline so the
/// result can be re-joined losslessly.
fn split_lines(bytes: &[u8]) -> Vec<String> {
    String::from_utf8_lossy(bytes)
        .split_inclusive('\n')
        .map(|s| s.to_string())
        .collect()
}

/// Replay a subset of the old→new line changes. `keep_selected` = stage the
/// selection; false = unstage it (revert the selection, keep the rest).
fn partial_apply(
    old: &[String],
    new: &[String],
    sel_add: &std::collections::HashSet<u32>,
    sel_del: &std::collections::HashSet<u32>,
    keep_selected: bool,
) -> String {
    let n = old.len();
    let m = new.len();

    // Longest-common-subsequence table aligns old and new lines.
    let mut dp = vec![vec![0usize; m + 1]; n + 1];
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            dp[i][j] = if old[i] == new[j] {
                dp[i + 1][j + 1] + 1
            } else {
                dp[i + 1][j].max(dp[i][j + 1])
            };
        }
    }

    let mut out: Vec<&str> = Vec::new();
    let (mut i, mut j) = (0usize, 0usize);
    while i < n && j < m {
        if old[i] == new[j] {
            out.push(&old[i]);
            i += 1;
            j += 1;
        } else if dp[i + 1][j] >= dp[i][j + 1] {
            // old[i] was deleted
            let selected = sel_del.contains(&((i + 1) as u32));
            let remove = if keep_selected { selected } else { !selected };
            if !remove {
                out.push(&old[i]);
            }
            i += 1;
        } else {
            // new[j] was added
            let selected = sel_add.contains(&((j + 1) as u32));
            let keep = if keep_selected { selected } else { !selected };
            if keep {
                out.push(&new[j]);
            }
            j += 1;
        }
    }
    while i < n {
        let selected = sel_del.contains(&((i + 1) as u32));
        let remove = if keep_selected { selected } else { !selected };
        if !remove {
            out.push(&old[i]);
        }
        i += 1;
    }
    while j < m {
        let selected = sel_add.contains(&((j + 1) as u32));
        let keep = if keep_selected { selected } else { !selected };
        if keep {
            out.push(&new[j]);
        }
        j += 1;
    }
    out.concat()
}

/// Write `target` as the file's staged blob (add or update the index entry),
/// removing the entry when the partial result is empty.
fn write_partial_to_index(repo: &Repository, file_path: &str, target: &[u8]) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let in_index = index.get_path(Path::new(file_path), 0).is_some();

    if target.is_empty() {
        if in_index {
            index
                .remove_path(Path::new(file_path))
                .map_err(|e| e.to_string())?;
        }
        // else: new file with nothing selected — nothing to stage.
    } else {
        let blob_oid = repo.blob(target).map_err(|e| e.to_string())?;
        if let Some(mut entry) = index.get_path(Path::new(file_path), 0) {
            entry.id = blob_oid;
            entry.file_size = target.len() as u32;
            index.add(&entry).map_err(|e| e.to_string())?;
        } else {
            let entry = git2::IndexEntry {
                ctime: git2::IndexTime::new(0, 0),
                mtime: git2::IndexTime::new(0, 0),
                dev: 0,
                ino: 0,
                mode: 0o100644,
                uid: 0,
                gid: 0,
                file_size: target.len() as u32,
                id: blob_oid,
                flags: 0,
                flags_extended: 0,
                path: file_path.as_bytes().to_vec(),
            };
            index.add(&entry).map_err(|e| e.to_string())?;
        }
    }
    index.write().map_err(|e| e.to_string())
}

// ────────────────────── Branch commands ──────────────────────

/// List all local and remote branches.
#[tauri::command]
fn get_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head_oid = repo.head().ok().and_then(|h| h.target());

    let mut result = Vec::new();

    if let Ok(branches) = repo.branches(None) {
        for (branch, bt) in branches.flatten() {
            let refname = branch.get().name().unwrap_or("");
            let name = refname
                .strip_prefix("refs/heads/")
                .or_else(|| refname.strip_prefix("refs/remotes/"))
                .unwrap_or(refname)
                .to_string();

            let is_head = branch.get().target() == head_oid && bt == git2::BranchType::Local;
            let is_remote = bt == git2::BranchType::Remote;

            let upstream = branch.upstream().ok().and_then(|u| {
                u.get()
                    .name()
                    .ok()
                    .map(|n| {
                        n.strip_prefix("refs/remotes/")
                            .unwrap_or(n)
                            .to_string()
                    })
            });

            result.push(BranchInfo {
                name,
                is_head,
                is_remote,
                upstream,
            });
        }
    }

    // Sort so HEAD is first, then alphabetically.
    result.sort_by(|a, b| {
        b.is_head
            .cmp(&a.is_head)
            .then(a.name.cmp(&b.name))
    });

    Ok(result)
}

/// Checkout (switch to) a branch or commit.
#[tauri::command]
fn checkout_branch(repo_path: String, target: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    // First, try to find a local branch with the target name.
    if let Ok(reference) = repo.find_branch(&target, git2::BranchType::Local) {
        let obj = reference.get().peel(git2::ObjectType::Any).map_err(|e| e.to_string())?;
        repo.checkout_tree(&obj, None)
            .map_err(|e| e.to_string())?;
        repo.set_head(&format!("refs/heads/{}", target))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Next, try to find a remote branch. If found, create a local branch that follows the remote branch.
    let remote_ref = format!("refs/remotes/origin/{}", target);
    if let Ok(reference) = repo.find_reference(&remote_ref) {
        let commit = reference.peel_to_commit().map_err(|e| e.to_string())?;
        let branch = repo
            .branch(&target, &commit, false)
            .map_err(|e| e.to_string())?;
        let obj = branch.get().peel(git2::ObjectType::Any).map_err(|e| e.to_string())?;
        repo.checkout_tree(&obj, None)
            .map_err(|e| e.to_string())?;
        repo.set_head(&format!("refs/heads/{}", target))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Finally, try to match the target to a specific commit hash (Object ID).
    if let Ok(oid) = git2::Oid::from_str(&target) {
        let obj = repo.find_object(oid, None).map_err(|e| e.to_string())?;
        repo.checkout_tree(&obj, None).map_err(|e| e.to_string())?;
        repo.set_head_detached(oid).map_err(|e| e.to_string())?;
        return Ok(());
    }

    Err(format!("Could not find branch or commit: {}", target))
}

/// Create a new branch at HEAD.
#[tauri::command]
fn create_branch(repo_path: String, name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().and_then(|h| h.peel_to_commit()).map_err(|e| e.to_string())?;
    repo.branch(&name, &head, false).map_err(|e| e.to_string())?;
    Ok(())
}

/// Create a branch pointing at an arbitrary commit (used by reflog recovery).
#[tauri::command]
fn create_branch_at(repo_path: String, name: String, oid: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let commit = repo
        .revparse_single(&oid)
        .and_then(|o| o.peel_to_commit())
        .map_err(|e| e.to_string())?;
    repo.branch(&name, &commit, false).map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete a local branch.
#[tauri::command]
fn delete_branch(repo_path: String, name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut branch = repo
        .find_branch(&name, git2::BranchType::Local)
        .map_err(|e| e.to_string())?;
    branch.delete().map_err(|e| e.to_string())?;
    Ok(())
}

// ────────────────────── Remote commands ──────────────────────

/// Push the current branch to a remote.
#[tauri::command]
fn do_push(repo_path: String, remote: String, branch: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut remote = repo.find_remote(&remote).map_err(|e| e.to_string())?;
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);
    remote
        .push(&[&refspec], None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Pull from a remote branch.
#[tauri::command]
fn do_pull(repo_path: String, remote: String, branch: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let remote_name = remote.clone();

    // Fetch first.
    {
        let mut remote = repo.find_remote(&remote_name).map_err(|e| e.to_string())?;
        remote.fetch(&[&branch], None, None).map_err(|e| e.to_string())?;
    }

    // Merge the fetched branch.
    let fetch_branch = format!("{}/{}", remote_name, branch);
    let reference =
        repo.find_reference(&fetch_branch)
            .map_err(|e| e.to_string())?;
    let annotated =
        repo.reference_to_annotated_commit(&reference)
            .map_err(|e| e.to_string())?;

    let analysis = repo.merge_analysis(&[&annotated]).map_err(|e| e.to_string())?;

    if analysis.0.is_fast_forward() {
        let oid = annotated.id();
        let refname = format!("refs/heads/{}", branch);
        repo.reference(&refname, oid, true, "pull: fast-forward")
            .map_err(|e| e.to_string())?;
        let obj = repo.find_object(annotated.id(), None).map_err(|e| e.to_string())?;
        repo.checkout_tree(&obj, None)
            .map_err(|e| e.to_string())?;
    } else if analysis.0.is_normal() {
        let head_commit = repo.head().and_then(|h| h.peel_to_commit()).map_err(|e| e.to_string())?;
        repo.merge(&[&annotated], None, None)
            .map_err(|e| e.to_string())?;

        let sig = repo.signature().map_err(|e| e.to_string())?;
        let mut index = repo.index().map_err(|e| e.to_string())?;
        index.write_tree().map_err(|e| e.to_string())?;
        let tree = repo
            .find_tree(index.write_tree().map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        let merge_commit = repo.find_commit(annotated.id()).map_err(|e| e.to_string())?;

        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &format!("Merge '{}' into {}", remote_name, branch),
            &tree,
            &[&head_commit, &merge_commit],
        )
        .map_err(|e| e.to_string())?;

        repo.cleanup_state().map_err(|e| e.to_string())?;
    } else {
        repo.cleanup_state().map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Fetch from a remote.
#[tauri::command]
fn do_fetch(repo_path: String, remote: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut remote = repo.find_remote(&remote).map_err(|e| e.to_string())?;
    remote.fetch::<&str>(&[], None, None).map_err(|e| e.to_string())?;
    Ok(())
}

/// List all remotes.
#[tauri::command]
fn get_remotes(repo_path: String) -> Result<Vec<RemoteInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for remote_result in repo.remotes().map_err(|e| e.to_string())?.iter() {
        if let Ok(Some(name)) = remote_result {
            let url = repo
                .find_remote(name)
                .ok()
                .and_then(|r| r.url().map(String::from).ok())
                .unwrap_or_default();
            result.push(RemoteInfo {
                name: name.to_string(),
                url,
            });
        }
    }

    Ok(result)
}

// ────────────────────── Stash commands ──────────────────────

/// Stash all local changes.
#[tauri::command]
fn do_stash(repo_path: String) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let signature = repo.signature().map_err(|e| e.to_string())?;
    repo.stash_save(&signature, "WIP", Some(git2::StashFlags::DEFAULT))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Pop the most recent stash.
#[tauri::command]
fn stash_pop(repo_path: String) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    repo.stash_pop(0, None).map_err(|e| e.to_string())?;
    Ok(())
}

/// List all stashes.
#[tauri::command]
fn get_stashes(repo_path: String) -> Result<Vec<StashInfo>, String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    let _ = repo.stash_foreach(|index, _oid, msg| {
        let message = msg.to_string();
        // Extract branch name from stash message (e.g. "On branch: message").
        let branch = message
            .split(':')
            .next()
            .unwrap_or("")
            .strip_prefix("On ")
            .unwrap_or("HEAD")
            .to_string();

        result.push(StashInfo {
            index,
            message,
            branch,
            timestamp: 0,
        });
        true
    });

    Ok(result)
}

// ────────────────────── Tag commands ──────────────────────

/// List all tags.
#[tauri::command]
fn get_tags(repo_path: String) -> Result<Vec<TagInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    repo.tag_foreach(|oid, name| {
        let name_str = std::str::from_utf8(name).unwrap_or("").to_string();
        let oid_hex = oid_to_hex(oid);
        let message = repo.find_tag(oid)
            .ok()
            .and_then(|t| t.message().ok().flatten().map(String::from));
        result.push(TagInfo {
            name: name_str,
            oid: oid_hex,
            message,
        });
        true
    }).map_err(|e| e.to_string())?;

    Ok(result)
}

/// Create a lightweight tag at HEAD.
#[tauri::command]
fn create_tag(repo_path: String, name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().and_then(|h| h.peel(git2::ObjectType::Any)).map_err(|e| e.to_string())?;
    repo.tag_lightweight(&name, &head, false)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ────────────────────── Interactive rebase commands ──────────────────────

/// Get commits on a branch that are not in the base branch.
/// These are the candidates for interactive rebase.
#[tauri::command]
fn get_rebase_commits(
    repo_path: String,
    branch: String,
    base: String,
) -> Result<Vec<RebaseCommit>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let branch_oid = repo
        .refname_to_id(&format!("refs/heads/{}", branch))
        .or_else(|_| repo.refname_to_id(&format!("refs/remotes/origin/{}", branch)))
        .map_err(|e| format!("Branch '{}' not found: {}", branch, e))?;

    let base_oid = repo
        .refname_to_id(&format!("refs/heads/{}", base))
        .or_else(|_| repo.refname_to_id(&format!("refs/remotes/origin/{}", base)))
        .or_else(|_| repo.refname_to_id("HEAD"))
        .map_err(|e| format!("Base '{}' not found: {}", base, e))?;

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(Sort::TOPOLOGICAL | Sort::TIME)
        .map_err(|e| e.to_string())?;
    revwalk
        .hide(base_oid)
        .map_err(|e| e.to_string())?;
    revwalk
        .push(branch_oid)
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for oid_result in revwalk {
        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        let message = commit
            .message()
            .unwrap_or("")
            .lines()
            .next()
            .unwrap_or("")
            .to_string();

        result.push(RebaseCommit {
            oid: oid_to_hex(oid),
            short_oid: oid_to_hex(oid)[..7.min(oid_to_hex(oid).len())].to_string(),
            message,
            author: commit.author().name().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            operation: "pick".to_string(),
            new_message: None,
        });
    }

    // Revwalk returns newest first. We want oldest first for rebase.
    result.reverse();
    Ok(result)
}

/// Check if a rebase is currently in progress.
#[tauri::command]
fn get_rebase_status(repo_path: String) -> Result<RebaseStatus, String> {
    let rebase_dir = Path::new(&repo_path).join(".git").join("rebase-merge");
    let rebase_apply = Path::new(&repo_path).join(".git").join("rebase-apply");

    let in_progress = rebase_dir.exists() || rebase_apply.exists();
    let current_head = if in_progress {
        // Read the onto commit from the rebase state.
        let head_file = if rebase_dir.exists() {
            rebase_dir.join("head-name")
        } else {
            rebase_apply.join("head-name")
        };
        std::fs::read_to_string(head_file)
            .ok()
            .map(|s| s.trim().to_string())
    } else {
        None
    };

    Ok(RebaseStatus {
        in_progress,
        current_head,
    })
}

/// Start an interactive rebase that actually applies the chosen per-commit
/// actions (pick/squash/fixup/drop/edit) and their ordering. We shell out to
/// `git rebase -i` because libgit2 cannot script a todo list; a tiny temp
/// "sequence editor" script overwrites git's generated todo with ours.
#[tauri::command]
fn start_rebase(
    repo_path: String,
    branch: String,
    onto: String,
    operations: Vec<RebaseCommit>,
    backup: bool,
) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    // Optionally tag the branch tip before rewriting history so the pre-rebase
    // state stays reachable.
    if backup {
        if let Ok(oid) = repo
            .refname_to_id(&format!("refs/heads/{}", branch))
            .or_else(|_| repo.refname_to_id(&format!("refs/remotes/origin/{}", branch)))
        {
            if let Ok(obj) = repo.find_object(oid, None) {
                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                let tag = format!(
                    "backup/{}-{}",
                    branch.replace('/', "-").replace('\\', "-"),
                    ts
                );
                let _ = repo.tag_lightweight(&tag, &obj, false);
            }
        }
    }

    let mut todo_lines: Vec<String> = Vec::new();
    for op in &operations {
        let cmd = match op.operation.as_str() {
            "squash" | "s" => "squash",
            "fixup" | "f" => "fixup",
            "reword" | "r" => "reword",
            "edit" | "e" => "edit",
            "drop" | "d" => "drop",
            _ => "pick",
        };
        todo_lines.push(format!("{} {}", cmd, op.oid));
    }
    let todo = format!("{}\n", todo_lines.join("\n"));

    let script = write_sequence_editor(&todo)?;
    let output = Command::new("git")
        .current_dir(&repo_path)
        .args([
            "rebase",
            "-i",
            "--no-autosquash",
            "--onto",
            &onto,
            &onto,
            &branch,
        ])
        .env("GIT_SEQUENCE_EDITOR", &script)
        .env("GIT_EDITOR", "true") // accept default messages for squash/reword
        .output()
        .map_err(|e| format!("Failed to start rebase: {}", e))?;

    // Best-effort cleanup of the temp files.
    let _ = std::fs::remove_file(&script);
    let _ = std::fs::remove_file(sequence_editor_todo_path());

    if !output.status.success() {
        return Err(format!(
            "Rebase failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

fn sequence_editor_todo_path() -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "git-started-rebase-todo-{}.txt",
        std::process::id()
    ))
}

/// Write the interactive-rebase todo to a temp file and return the path of a
/// tiny script git invokes as its sequence editor (`<script> <todo-path>`). The
/// script overwrites git's generated todo with ours. `.cmd` on Windows, `.sh`
/// elsewhere.
fn write_sequence_editor(todo: &str) -> Result<std::path::PathBuf, String> {
    let dir = std::env::temp_dir();
    let todo_path = sequence_editor_todo_path();
    std::fs::write(&todo_path, todo).map_err(|e| e.to_string())?;

    #[cfg(windows)]
    let script_path = dir.join(format!("git-started-seq-editor-{}.cmd", std::process::id()));
    #[cfg(not(windows))]
    let script_path = dir.join(format!("git-started-seq-editor-{}.sh", std::process::id()));

    #[cfg(windows)]
    {
        let content = format!(
            "@echo off\r\ncopy /y \"{}\" \"%~1\" >nul\r\n",
            todo_path.display()
        );
        std::fs::write(&script_path, content).map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        let content = format!("#!/bin/sh\ncp \"{}\" \"$1\"\n", todo_path.display());
        std::fs::write(&script_path, content).map_err(|e| e.to_string())?;
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(script_path)
}

/// Continue a rebase that is in progress (after resolving conflicts).
#[tauri::command]
fn rebase_continue(repo_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .current_dir(&repo_path)
        .args(["rebase", "--continue"])
        .output()
        .map_err(|e| format!("Failed to continue rebase: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git rebase --continue failed: {}", stderr));
    }
    Ok(())
}

/// Abort a rebase in progress.
#[tauri::command]
fn rebase_abort(repo_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .current_dir(&repo_path)
        .args(["rebase", "--abort"])
        .output()
        .map_err(|e| format!("Failed to abort rebase: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git rebase --abort failed: {}", stderr));
    }
    Ok(())
}

// ────────────────────── Merge conflict commands ──────────────────────

/// Check if a merge/rebase is in progress and list conflicting files.
#[tauri::command]
fn get_conflicts(repo_path: String) -> Result<Vec<ConflictFile>, String> {
    let merge_head = Path::new(&repo_path).join(".git").join("MERGE_HEAD");
    let rebase_dir = Path::new(&repo_path).join(".git").join("rebase-merge");
    let rebase_apply = Path::new(&repo_path).join(".git").join("rebase-apply");

    if !merge_head.exists() && !rebase_dir.exists() && !rebase_apply.exists() {
        return Ok(vec![]);
    }

    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.write().ok();

    let mut conflicts = Vec::new();
    if let Ok(conflict_iter) = index.conflicts() {
        for entry in conflict_iter.flatten() {
            let path_str = entry
                .ancestor
                .as_ref()
                .or(entry.our.as_ref())
                .or(entry.their.as_ref())
                .map(|e| String::from_utf8_lossy(&e.path).to_string())
                .unwrap_or_default();

            // Read conflict markers from the file.
            let full_path = Path::new(&repo_path).join(&path_str);
            let content = std::fs::read_to_string(&full_path).unwrap_or_default();

            let (ancestor, ours, theirs) = parse_conflict_markers(&content);

            conflicts.push(ConflictFile {
                path: path_str,
                ancestor,
                ours,
                theirs,
            });
        }
    }

    Ok(conflicts)
}

/// Parse conflict markers (<<<<<<<, =======, >>>>>>>) from file content.
fn parse_conflict_markers(content: &str) -> (Option<String>, Option<String>, Option<String>) {
    let mut ancestor = None;
    let mut ours = None;
    let mut theirs = None;

    let mut current_section = "";
    let mut current_lines: Vec<String> = Vec::new();

    for line in content.lines() {
        if line.starts_with("<<<<<<<") {
            current_section = "ours";
            current_lines.clear();
        } else if line.starts_with("=======") {
            if current_section == "ours" {
                ours = Some(current_lines.join("\n"));
            } else if current_section == "ancestor" {
                ancestor = Some(current_lines.join("\n"));
            }
            current_lines.clear();
            current_section = if ours.is_some() { "theirs" } else { "ancestor" };
        } else if line.starts_with(">>>>>>>") {
            if current_section == "theirs" {
                theirs = Some(current_lines.join("\n"));
            } else if current_section == "ancestor" {
                ancestor = Some(current_lines.join("\n"));
            }
            current_lines.clear();
            current_section = "";
        } else {
            current_lines.push(line.to_string());
        }
    }

    (ancestor, ours, theirs)
}

/// Mark a conflict as resolved by choosing one side and staging the file.
#[tauri::command]
fn resolve_conflict(
    repo_path: String,
    file_path: String,
    side: String,
) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let full_path = Path::new(&file_path);
    let content = std::fs::read_to_string(full_path).map_err(|e| e.to_string())?;
    let (ancestor, ours, theirs) = parse_conflict_markers(&content);

    let resolved = match side.as_str() {
        "ours" => ours.unwrap_or_default(),
        "theirs" => theirs.unwrap_or_default(),
        "base" => ancestor.unwrap_or_default(),
        _ => return Err(format!("Invalid side: {}", side)),
    };

    std::fs::write(full_path, resolved).map_err(|e| e.to_string())?;

    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_path(full_path)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    Ok(())
}

// ────────────────────── Commit search commands ──────────────────────

/// Search commits by author or message substring.
#[tauri::command]
fn search_commits(
    repo_path: String,
    query: String,
    max: Option<usize>,
) -> Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().map_err(|e| e.to_string())?;

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(Sort::TOPOLOGICAL | Sort::TIME)
        .map_err(|e| e.to_string())?;
    revwalk.push(head.target().ok_or("HEAD has no target")?)
        .map_err(|e| e.to_string())?;

    let limit = max.unwrap_or(500);
    let query_lower = query.to_lowercase();
    let mut result = Vec::new();

    for oid_result in revwalk {
        if result.len() >= limit {
            break;
        }
        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

        let message = commit.message().unwrap_or("").to_string();
        let author = commit.author().name().unwrap_or("").to_string();
        let author_email = commit.author().email().unwrap_or("").to_string();

        if message.to_lowercase().contains(&query_lower)
            || author.to_lowercase().contains(&query_lower)
            || author_email.to_lowercase().contains(&query_lower)
        {
            let first_line = message.lines().next().unwrap_or("").to_string();
            result.push(CommitInfo {
                oid: oid_to_hex(oid),
                short_oid: oid_to_hex(oid)[..7.min(oid_to_hex(oid).len())].to_string(),
                message: first_line,
                author,
                author_email,
                timestamp: commit.time().seconds(),
                parent_oids: commit.parent_ids().map(oid_to_hex).collect(),
                branch_names: vec![],
            });
        }
    }

    Ok(result)
}

// ────────────────────── Submodule commands ──────────────────────

/// List all submodules in the repository.
#[tauri::command]
fn get_submodules(repo_path: String) -> Result<Vec<SubmoduleInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    if let Ok(submodules) = repo.submodules() {
        for sm in submodules {
            let name = sm.name().unwrap_or("").to_string();
            let path = sm.path().to_string_lossy().to_string();
            let url = sm.url().ok().flatten().map(String::from).unwrap_or_default();
            let head_oid = sm
                .head_id()
                .map(oid_to_hex)
                .unwrap_or_default();

            // Determine status.
            let status = if sm.open().is_err() {
                "not_init"
            } else if head_oid.is_empty() {
                "uninitialized"
            } else {
                "initialized"
            };

            result.push(SubmoduleInfo {
                name,
                path,
                url,
                head_oid,
                status: status.to_string(),
            });
        }
    }

    Ok(result)
}

/// Initialise and update a submodule.
#[tauri::command]
fn submodule_update(repo_path: String, name: String) -> Result<(), String> {
    let output = Command::new("git")
        .current_dir(&repo_path)
        .args(["submodule", "update", "--init", "--recursive", &name])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git submodule update failed: {}", stderr));
    }
    Ok(())
}

// ────────────────────── Credential helper commands ──────────────────────

/// Read the configured credential helper and its status.
#[tauri::command]
fn get_credential_info(repo_path: String) -> Result<CredentialInfo, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let cfg = repo.config().map_err(|e| e.to_string())?;

    let helper = cfg
        .get_string("credential.helper")
        .unwrap_or_default();

    let storage = cfg
        .get_string("credential.cache.ignoreoptions")
        .ok()
        .map(|_| "cache".to_string())
        .or_else(|| {
            if helper.contains("store") {
                Some("store".to_string())
            } else if helper.contains("manager") {
                Some("manager".to_string())
            } else {
                None
            }
        })
        .unwrap_or_default();

    let configured = !helper.is_empty();

    Ok(CredentialInfo {
        helper,
        storage,
        configured,
    })
}

// ────────────────────── Auth commands ──────────────────────

#[derive(Serialize)]
pub struct SshKeyInfo {
    path: String,
    filename: String,
    public_key: String,
    fingerprint: String,
    exists: bool,
}

#[derive(Serialize)]
pub struct SshAgentStatus {
    has_agent: bool,
    loaded_keys: Vec<String>,
    error: Option<String>,
}

#[derive(Serialize)]
pub struct SshTestResult {
    success: bool,
    message: String,
}

/// List all public keys in ~/.ssh/.
#[tauri::command]
fn get_ssh_keys() -> Result<Vec<SshKeyInfo>, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let ssh_dir = home.join(".ssh");

    if !ssh_dir.exists() {
        return Ok(vec![]);
    }

    let mut keys = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&ssh_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".pub") {
                let pub_path = entry.path();
                let private_path = ssh_dir.join(name.trim_end_matches(".pub"));

                let public_key = std::fs::read_to_string(&pub_path).unwrap_or_default();
                let fingerprint = public_key
                    .split_whitespace()
                    .nth(1)
                    .unwrap_or("")
                    .to_string();

                keys.push(SshKeyInfo {
                    path: private_path.to_string_lossy().to_string(),
                    filename: name.trim_end_matches(".pub").to_string(),
                    public_key: public_key.trim().to_string(),
                    fingerprint,
                    exists: private_path.exists(),
                });
            }
        }
    }

    Ok(keys)
}

/// Generate a new SSH keypair via ssh-keygen.
#[tauri::command]
fn generate_ssh_key(comment: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let ssh_dir = home.join(".ssh");

    if !ssh_dir.exists() {
        std::fs::create_dir_all(&ssh_dir).map_err(|e| e.to_string())?;
    }

    // Check if a key already exists.
    let key_path = ssh_dir.join("id_ed25519");
    if key_path.exists() {
        return Err("A key already exists at ~/.ssh/id_ed25519. Delete it first or choose a different name.".to_string());
    }

    let output = Command::new("ssh-keygen")
        .args([
            "-t", "ed25519",
            "-C", &comment,
            "-f", &key_path.to_string_lossy(),
            "-N", "",  // empty passphrase
        ])
        .output()
        .map_err(|e| format!("Failed to run ssh-keygen: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ssh-keygen failed: {}", stderr));
    }

    // Read the public key.
    let pub_key = std::fs::read_to_string(key_path.with_extension("pub"))
        .map_err(|e| e.to_string())?;

    Ok(pub_key.trim().to_string())
}

/// Check if ssh-agent is running and which keys are loaded.
#[tauri::command]
fn get_ssh_agent_status() -> Result<SshAgentStatus, String> {
    // Check if agent is running.
    let output = Command::new("ssh-add")
        .args(["-l"])
        .output();

    match output {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let keys: Vec<String> = stdout
                .lines()
                .filter_map(|line| {
                    // Lines look like: "2048 SHA256:xxxx /path/to/key (RSA)"
                    line.split_whitespace().last().map(|s| s.to_string())
                })
                .filter(|s| !s.starts_with('('))
                .collect();
            Ok(SshAgentStatus {
                has_agent: true,
                loaded_keys: keys,
                error: None,
            })
        }
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            Ok(SshAgentStatus {
                has_agent: false,
                loaded_keys: vec![],
                error: Some(stderr.trim().to_string()),
            })
        }
        Err(e) => Ok(SshAgentStatus {
            has_agent: false,
            loaded_keys: vec![],
            error: Some(format!("Could not run ssh-add: {}", e)),
        }),
    }
}

/// Test SSH connection to a given host (e.g. "github.com").
#[tauri::command]
fn test_ssh_connection(host: String) -> Result<SshTestResult, String> {
    let output = Command::new("ssh")
        .args([
            "-T",
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", "ConnectTimeout=5",
            &format!("git@{}", host),
        ])
        .output()
        .map_err(|e| format!("Failed to run ssh: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}{}", stdout, stderr);
    let lower = combined.to_lowercase();
    let success = lower.contains("successfully authenticated")
        || lower.contains("welcome")
        || lower.contains("you've successfully")
        || lower.contains("logged in as");

    Ok(SshTestResult {
        success,
        message: combined.trim().to_string(),
    })
}

/// Save a personal access token to the credential helper.
#[tauri::command]
fn save_credential(protocol: String, host: String, username: String, password: String) -> Result<(), String> {
    let input = format!(
        "protocol={}\nhost={}\nusername={}\npassword={}\n",
        protocol, host, username, password
    );

    let mut output = Command::new("git")
        .args(["credential", "approve"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run git credential: {}", e))?;

    // Write to stdin and close.
    if let Some(ref mut stdin) = output.stdin {
        use std::io::Write;
        stdin.write_all(input.as_bytes()).map_err(|e| e.to_string())?;
    }

    let result = output.wait_with_output().map_err(|e| e.to_string())?;
    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(format!("git credential approve failed: {}", stderr));
    }

    Ok(())
}

/// Remove saved credentials for a host.
#[tauri::command]
fn remove_credential(protocol: String, host: String) -> Result<(), String> {
    let input = format!("protocol={}\nhost={}\n", protocol, host);

    let mut output = Command::new("git")
        .args(["credential", "reject"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run git credential: {}", e))?;

    if let Some(ref mut stdin) = output.stdin {
        use std::io::Write;
        stdin.write_all(input.as_bytes()).map_err(|e| e.to_string())?;
    }

    let result = output.wait_with_output().map_err(|e| e.to_string())?;
    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(format!("git credential reject failed: {}", stderr));
    }

    Ok(())
}

/// Read a git config value (global or local).
#[tauri::command]
fn get_git_config(key: String, repo_path: Option<String>) -> Result<Option<String>, String> {
    let mut args = vec!["config".to_string()];
    if let Some(rp) = &repo_path {
        args.push("--local".to_string());
        args.push("-f".to_string());
        args.push(format!("{}/.git/config", rp));
    } else {
        args.push("--global".to_string());
    }
    args.push(key.clone());

    let output = Command::new("git")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run git config: {}", e))?;

    if output.status.success() {
        let val = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(Some(val))
    } else {
        Ok(None)
    }
}

// ────────────────────── Commit inspection & operations ──────────────────────

/// List the files changed by a single commit, relative to its first parent.
#[tauri::command]
fn get_commit_diff(repo_path: String, oid: String) -> Result<Vec<CommitFileChange>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let oid = git2::Oid::from_str(&oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;

    // A root commit has no parent; diff against an empty tree.
    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for delta in diff.deltas() {
        let status_str = match delta.status() {
            git2::Delta::Renamed | git2::Delta::Copied => "renamed",
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            _ => "modified",
        };

        let path = delta
            .new_file()
            .path()
            .and_then(|p| p.to_str())
            .unwrap_or("")
            .to_string();
        let old_path = delta
            .old_file()
            .path()
            .and_then(|p| p.to_str())
            .map(|s| s.to_string());

        result.push(CommitFileChange {
            path,
            status: status_str.to_string(),
            old_path,
        });
    }

    Ok(result)
}

/// Cherry-pick a commit onto HEAD and commit it if the result is clean.
#[tauri::command]
fn cherry_pick(repo_path: String, oid: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let oid = git2::Oid::from_str(&oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

    repo.cherrypick(&commit, None).map_err(|e| e.to_string())?;

    finish_apply(&repo, commit.message().unwrap_or(""))
}

/// Revert a commit and commit the reversal if the result is clean.
#[tauri::command]
fn revert(repo_path: String, oid: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let oid = git2::Oid::from_str(&oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

    repo.revert(&commit, None).map_err(|e| e.to_string())?;

    let subject = commit
        .message()
        .unwrap_or("")
        .lines()
        .next()
        .unwrap_or("");
    let message = format!(
        "Revert \"{}\"\n\nThis reverts commit {}.\n",
        subject, oid
    );
    finish_apply(&repo, &message)
}

/// Cherry-pick several commits onto HEAD in chronological order, committing
/// each clean result and stopping at the first conflict (which is left staged
/// for the conflict panel).
#[tauri::command]
fn cherry_pick_many(repo_path: String, oids: Vec<String>) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let mut commits: Vec<git2::Commit> = Vec::new();
    for oid_str in &oids {
        let oid = git2::Oid::from_str(oid_str).map_err(|e| e.to_string())?;
        commits.push(repo.find_commit(oid).map_err(|e| e.to_string())?);
    }
    commits.sort_by_key(|c| c.time().seconds());

    for commit in commits {
        repo.cherrypick(&commit, None).map_err(|e| e.to_string())?;
        let message = commit.message().unwrap_or("");
        let short = commit.id().to_string();
        let short = &short[..7.min(short.len())];
        finish_apply(&repo, message)
            .map_err(|e| format!("Cherry-pick stopped at {}: {}", short, e))?;
    }
    Ok(())
}

/// Commit the result of a cherry-pick/revert, or leave conflicts for the user.
fn finish_apply(repo: &Repository, message: &str) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| e.to_string())?;

    if index.has_conflicts() {
        index.write().map_err(|e| e.to_string())?;
        return Err(
            "Operation resulted in conflicts. Resolve them, then commit.".to_string(),
        );
    }

    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;
    let sig = repo.signature().map_err(|e| e.to_string())?;
    let head_commit = repo
        .head()
        .and_then(|h| h.peel_to_commit())
        .map_err(|e| e.to_string())?;

    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[&head_commit])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ────────────────────── History & inspection ──────────────────────

fn short_hex(oid: git2::Oid) -> String {
    let hex = oid.to_string();
    hex[..7.min(hex.len())].to_string()
}

fn commit_to_info(commit: &git2::Commit) -> CommitInfo {
    CommitInfo {
        oid: commit.id().to_string(),
        short_oid: short_hex(commit.id()),
        message: commit
            .message()
            .unwrap_or("")
            .lines()
            .next()
            .unwrap_or("")
            .to_string(),
        author: commit.author().name().unwrap_or("").to_string(),
        author_email: commit.author().email().unwrap_or("").to_string(),
        timestamp: commit.time().seconds(),
        parent_oids: commit.parent_ids().map(oid_to_hex).collect(),
        branch_names: Vec::new(),
    }
}

fn commit_touches_path(
    repo: &Repository,
    commit: &git2::Commit,
    path: &Path,
) -> Result<bool, String> {
    let tree = commit.tree().map_err(|e| e.to_string())?;
    if commit.parent_count() == 0 {
        return Ok(tree.get_path(path).is_ok());
    }
    let parent_tree = commit
        .parent(0)
        .ok()
        .and_then(|p| p.tree().ok())
        .ok_or("Cannot read parent tree")?;
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(path.to_string_lossy().as_ref());
    let diff = repo
        .diff_tree_to_tree(Some(&parent_tree), Some(&tree), Some(&mut opts))
        .map_err(|e| e.to_string())?;
    Ok(diff.deltas().len() > 0)
}

/// Line-by-line blame for a file at HEAD.
#[tauri::command]
fn get_blame(repo_path: String, file_path: String) -> Result<Vec<BlameLine>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let path = Path::new(&file_path);

    let tree = repo.head().and_then(|h| h.peel_to_tree()).map_err(|e| e.to_string())?;
    let text = tree
        .get_path(path)
        .ok()
        .and_then(|e| e.to_object(&repo).ok())
        .and_then(|o| o.as_blob().map(|b| b.content().to_vec()))
        .map(|b| String::from_utf8_lossy(&b).to_string())
        .unwrap_or_default();
    let lines: Vec<&str> = text.split('\n').collect();

    let blame = repo.blame_file(path, None).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    let mut line_index = 0usize;
    for hunk in blame.iter() {
        let commit_id = hunk.final_commit_id();
        let oid = commit_id.to_string();
        let short = short_hex(commit_id);
        let author = hunk
            .final_signature()
            .map(|s| s.name().unwrap_or("").to_string())
            .unwrap_or_default();
        let timestamp = hunk.final_signature().map(|s| s.when().seconds()).unwrap_or(0);
        for _ in 0..hunk.lines_in_hunk() {
            result.push(BlameLine {
                line_number: (line_index + 1) as u32,
                content: lines.get(line_index).copied().unwrap_or("").to_string(),
                commit_oid: oid.clone(),
                short_oid: short.clone(),
                author: author.clone(),
                timestamp,
            });
            line_index += 1;
        }
    }
    Ok(result)
}

/// Commits that changed a file or directory, newest first.
#[tauri::command]
fn get_file_history(
    repo_path: String,
    file_path: String,
    max: Option<usize>,
) -> Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let path = Path::new(&file_path);

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.set_sorting(Sort::TIME).map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;

    let limit = max.unwrap_or(100);
    let mut result = Vec::new();
    for oid in revwalk {
        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        if !commit_touches_path(&repo, &commit, path)? {
            continue;
        }
        result.push(commit_to_info(&commit));
        if result.len() >= limit {
            break;
        }
    }
    Ok(result)
}

/// HEAD reflog entries, newest first.
#[tauri::command]
fn get_reflog(repo_path: String) -> Result<Vec<ReflogEntry>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let reflog = repo.reflog("HEAD").map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for entry in reflog.iter().take(100) {
        result.push(ReflogEntry {
            oid: entry.id_new().to_string(),
            short_oid: short_hex(entry.id_new()),
            message: entry.message().ok().flatten().unwrap_or("").to_string(),
            timestamp: entry.committer().when().seconds(),
        });
    }
    Ok(result)
}

/// Aggregate repository statistics for the summary view.
#[tauri::command]
fn get_repo_stats(repo_path: String) -> Result<RepoStats, String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let mut commits = 0u64;
    let mut first_time = 0i64;
    let mut last_time = 0i64;
    let mut contributors: std::collections::HashSet<String> = std::collections::HashSet::new();
    if let Ok(head) = repo.head() {
        if let (Ok(mut revwalk), Some(target)) = (repo.revwalk(), head.target()) {
            let _ = revwalk.push(target);
            for oid in revwalk.flatten() {
                if commits >= 200_000 {
                    break;
                }
                if let Ok(commit) = repo.find_commit(oid) {
                    let t = commit.time().seconds();
                    if last_time == 0 {
                        last_time = t;
                    }
                    first_time = t;
                    commits += 1;
                    if let Ok(email) = commit.author().email() {
                        contributors.insert(email.to_string());
                    }
                }
            }
        }
    }

    let branches = repo.branches(None).map(|it| it.count() as u64).unwrap_or(0);
    let tags = repo.tag_names(None).map(|t| t.len() as u64).unwrap_or(0);
    let remotes = repo.remotes().map(|r| r.len() as u64).unwrap_or(0);
    let mut stashes = 0u64;
    let _ = repo.stash_foreach(|_, _, _| {
        stashes += 1;
        true
    });

    let head_branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().ok().map(String::from))
        .unwrap_or_else(|| "HEAD".to_string());
    let mut opts = git2::StatusOptions::new();
    let is_dirty = repo.statuses(Some(&mut opts)).map(|s| !s.is_empty()).unwrap_or(false);

    Ok(RepoStats {
        commits,
        branches,
        tags,
        remotes,
        stashes,
        contributors: contributors.len() as u64,
        first_commit_time: first_time,
        last_commit_time: last_time,
        head_branch,
        is_dirty,
    })
}

/// Read a file's bytes at a revision as base64 (for image diffs / file-at-commit).
/// `revision`: None = working tree, "index" = staged, anything else = a rev.
#[tauri::command]
fn read_file_version(
    repo_path: String,
    file_path: String,
    revision: Option<String>,
) -> Result<Option<String>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let bytes: Option<Vec<u8>> = match revision.as_deref() {
        None => std::fs::read(Path::new(&repo_path).join(&file_path)).ok(),
        Some("index") => {
            let index = repo.index().map_err(|e| e.to_string())?;
            index
                .get_path(Path::new(&file_path), 0)
                .and_then(|e| repo.find_blob(e.id).ok())
                .map(|b| b.content().to_vec())
        }
        Some(rev) => {
            let obj = repo.revparse_single(rev).map_err(|e| e.to_string())?;
            let commit = obj.peel_to_commit().map_err(|e| e.to_string())?;
            let tree = commit.tree().map_err(|e| e.to_string())?;
            tree.get_path(Path::new(&file_path))
                .ok()
                .and_then(|e| e.to_object(&repo).ok())
                .and_then(|o| o.as_blob().map(|b| b.content().to_vec()))
        }
    };
    Ok(bytes.map(|b| base64::engine::general_purpose::STANDARD.encode(&b)))
}

/// Delete a tag.
#[tauri::command]
fn delete_tag(repo_path: String, name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    repo.tag_delete(&name).map_err(|e| e.to_string())?;
    Ok(())
}

// ────────────────────── Recent repos & repo discovery ──────────────────────

/// Path to the durable recent-repos file. Lives in the OS config dir
/// (Roaming AppData on Windows), NOT the app-data dir the uninstaller wipes.
fn recent_repos_path() -> Result<std::path::PathBuf, String> {
    let dir = dirs::config_dir().ok_or("Cannot determine config directory")?;
    Ok(dir.join("git-started").join("recent-repos.json"))
}

fn load_recent_repos() -> Vec<String> {
    let path = match recent_repos_path() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .unwrap_or_default()
        .into_iter()
        .filter(|p| Path::new(p).is_dir())
        .collect()
}

fn save_recent_repos(repos: &[String]) -> Result<(), String> {
    let path = recent_repos_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(repos).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

/// List recently-opened repositories, most recent first.
#[tauri::command]
fn get_recent_repos() -> Vec<String> {
    load_recent_repos()
}

/// Remember a repository (deduped, moved to front, capped at 20).
#[tauri::command]
fn add_recent_repo(path: String) -> Vec<String> {
    let mut repos = load_recent_repos();
    repos.retain(|r| r.as_str() != path.as_str());
    repos.insert(0, path);
    repos.truncate(20);
    let _ = save_recent_repos(&repos);
    repos
}

/// Forget a repository from the recent list.
#[tauri::command]
fn remove_recent_repo(path: String) -> Vec<String> {
    let mut repos = load_recent_repos();
    repos.retain(|r| r.as_str() != path.as_str());
    let _ = save_recent_repos(&repos);
    repos
}

/// Scan the filesystem for git worktrees (dirs containing a `.git` entry).
/// Slow by design; runs on a background thread.
#[tauri::command]
async fn detect_git_repos() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(scan_for_repos)
        .await
        .map_err(|e| e.to_string())?
}

fn scan_for_repos() -> Result<Vec<String>, String> {
    let mut roots: Vec<std::path::PathBuf> = Vec::new();
    #[cfg(target_os = "windows")]
    {
        for letter in b'A'..=b'Z' {
            let root = format!("{}:\\", letter as char);
            let p = std::path::PathBuf::from(&root);
            if p.is_dir() {
                roots.push(p);
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(home) = dirs::home_dir() {
            roots.push(home);
        }
        roots.push(std::path::PathBuf::from("/"));
    }

    let mut found: Vec<String> = Vec::new();
    for root in roots {
        walk_for_repos(&root, &mut found);
    }
    found.sort();
    found.dedup();
    Ok(found)
}

fn walk_for_repos(root: &Path, found: &mut Vec<String>) {
    let mut stack: Vec<std::path::PathBuf> = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue, // permission denied, disconnected drive, etc.
        };
        for entry in entries.flatten() {
            let ft = match entry.file_type() {
                Ok(f) => f,
                Err(_) => continue,
            };
            // file_type() does not follow symlinks, so symlinked dirs are
            // skipped (avoids cycles and double-counting).
            if !ft.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if name == ".git" {
                if let Some(parent) = entry.path().parent() {
                    if let Some(p) = parent.to_str() {
                        found.push(p.to_string());
                    }
                }
                continue; // never descend into .git
            }
            if is_pruned_dir(&name) {
                continue;
            }
            stack.push(entry.path());
        }
    }
}

fn is_pruned_dir(name: &str) -> bool {
    matches!(
        name,
        // Build/cache trees that never contain repos the user wants to see
        "node_modules" | "target" | "bin" | "obj" | "dist" | "build" | "out"
        | ".cache" | ".npm" | ".cargo" | ".rustup" | ".gradle" | ".m2"
        | ".next" | ".nuxt" | ".angular" | ".venv" | "venv"
        | "vendor" | "coverage" | ".idea" | ".vscode"
        // OS/system trees
        | "$Recycle.Bin" | "System Volume Information" | "Windows"
        | "Program Files" | "Program Files (x86)" | "ProgramData" | "AppData"
        | "Recovery" | "PerfLogs" | "Documents and Settings"
        | "System" | "Library" | "Applications" | "Volumes" | "private"
        | "proc" | "sys" | "dev" | "run" | "usr" | "lib" | "lib64" | "boot"
        | "etc" | "opt" | "snap" | "var" | "sbin" | "tmp" | "lost+found"
    )
}

// ────────────────────── Entry point ──────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            open_repo,
            clone_repo,
            init_repo,
            get_status,
            get_diff,
            get_log,
            get_commit_diff,
            cherry_pick,
            cherry_pick_many,
            revert,
            do_commit,
            stage_file,
            unstage_file,
            stage_all,
            unstage_all,
            stage_lines,
            get_branches,
            checkout_branch,
            create_branch,
            create_branch_at,
            delete_branch,
            do_push,
            do_pull,
            do_fetch,
            get_remotes,
            do_stash,
            stash_pop,
            get_stashes,
            get_tags,
            create_tag,
            get_signing_info,
            get_rebase_commits,
            get_rebase_status,
            start_rebase,
            rebase_continue,
            rebase_abort,
            get_conflicts,
            resolve_conflict,
            search_commits,
            get_submodules,
            submodule_update,
            get_credential_info,
            get_ssh_keys,
            generate_ssh_key,
            get_ssh_agent_status,
            test_ssh_connection,
            save_credential,
            remove_credential,
            get_git_config,
            get_recent_repos,
            add_recent_repo,
            remove_recent_repo,
            detect_git_repos,
            get_blame,
            get_file_history,
            get_reflog,
            get_repo_stats,
            read_file_version,
            delete_tag,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn hs(v: &[u32]) -> HashSet<u32> {
        v.iter().copied().collect()
    }

    #[test]
    fn stage_only_the_modified_line() {
        let old = split_lines(b"one\ntwo\nthree\n");
        let new = split_lines(b"one\nTWO\nthree\nfour\n");
        // Stage the two->TWO edit (old line 2 removed, new line 2 added) but
        // leave the trailing "four" addition unstaged.
        let out = partial_apply(&old, &new, &hs(&[2]), &hs(&[2]), true);
        assert_eq!(out, "one\nTWO\nthree\n");
    }

    #[test]
    fn stage_only_the_added_line() {
        let old = split_lines(b"one\ntwo\nthree\n");
        let new = split_lines(b"one\nTWO\nthree\nfour\n");
        // Stage only the appended "four" line.
        let out = partial_apply(&old, &new, &hs(&[4]), &HashSet::new(), true);
        assert_eq!(out, "one\ntwo\nthree\nfour\n");
    }

    #[test]
    fn unstage_reverts_selected_line() {
        let old = split_lines(b"one\ntwo\nthree\n");
        let new = split_lines(b"one\nTWO\nthree\nfour\n");
        // Unstaging selected lines keeps everything EXCEPT the selection:
        // selecting the two->TWO edit means "revert that edit".
        let out = partial_apply(&old, &new, &hs(&[2]), &hs(&[2]), false);
        assert_eq!(out, "one\ntwo\nthree\nfour\n");
    }
}
