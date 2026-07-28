use git2::{Repository, Sort};
use serde::Serialize;
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

#[derive(Serialize)]
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
        .and_then(|h| h.shorthand().map(String::from))
        .unwrap_or_else(|| "HEAD".to_string());

    let name = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let status_opts = git2::StatusOptions::new();
    let is_dirty = repo
        .statuses(Some(&mut status_opts))
        .map_err(|e| e.to_string())?
        .len()
        > 0;

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

        // Index (staged) entries.
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

        // Worktree (unstaged) entries.
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

        // Untracked files.
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

/// Get the diff for a single file. If staged is true, compare index vs HEAD.
#[tauri::command]
fn get_diff(repo_path: String, file_path: String, staged: bool) -> Result<String, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let mut diff_opts = git2::differ::DiffOptions::new();
    diff_opts.pathspec(&file_path);

    let diff = if staged {
        let head = repo.head().and_then(|r| r.peel_to_commit()).ok();
        let index = repo.index().map_err(|e| e.to_string())?;
        let tree = index
            .write_tree()
            .ok()
            .and_then(|oid| repo.find_tree(oid).ok());

        match (head, tree) {
            (Some(head), Some(tree)) => {
                let head_tree = head.tree().map_err(|e| e.to_string())?;
                repo.diff_tree_to_tree(&head_tree, Some(&tree), Some(&mut diff_opts))
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
    for i in 0..diff.deltas().len() {
        if let Ok(patch) = diff.patch_index(i) {
            patch
                .to_buf(git2::PatchFormat::Patch)
                .map_err(|e| e.to_string())?
                .as_str()
                .map(|s| patch_text.push_str(s))
                .unwrap_or(());
        }
    }

    // If the structured diff is empty, fall back to a raw unified diff string.
    if patch_text.is_empty() {
        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let content = std::str::from_utf8(line.content()).unwrap_or("");
            patch_text.push_str(content);
            true
        })
        .map_err(|e| e.to_string())?;
    }

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
        for branch_result in branches {
            if let Ok((branch, _bt)) = branch_result {
                if let Ok(Some(ref_name)) = branch.get().name() {
                    if let Ok(oid) = branch.get().resolve().map(|r| r.target()) {
                        let short = ref_name
                            .strip_prefix("refs/heads/")
                            .unwrap_or(ref_name)
                            .to_string();
                        branch_map.insert(short, oid);
                    }
                }
            }
        }
    }

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.set_sorting(Sort::TIME).map_err(|e| e.to_string())?;
    revwalk.push(head.target().ok_or("HEAD has no target")?)
        .map_err(|e| e.to_string())?;

    let limit = max.unwrap_or(200);
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

/// Create a new commit from staged files.
/// When sign is true, uses `git commit -S` for GPG/SSH signing.
#[tauri::command]
fn do_commit(
    repo_path: String,
    message: String,
    amend: bool,
    sign: bool,
) -> Result<String, String> {
    if sign {
        // Shell out to `git commit -S` for signing support.
        // libgit2 does not have native signing callbacks.
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
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let sig = repo.signature().map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.write_tree().map_err(|e| e.to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;
    let head_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

    if amend {
        if let Some(mut old) = head_commit {
            let oid = old
                .amend(Some("HEAD"), &sig, &sig, None, Some(&message), Some(&tree))
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
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_path(Path::new(&file_path))
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

/// Unstage a single file by restoring it from HEAD.
#[tauri::command]
fn unstage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().and_then(|h| h.peel_to_tree()).ok();
    repo.reset_default(head.as_ref(), &[Path::new(&file_path)])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Stage all tracked and untracked files.
#[tauri::command]
fn stage_all(repo_path: String) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_all(["*"], git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

/// Unstage all files (soft reset to HEAD).
#[tauri::command]
fn unstage_all(repo_path: String) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().and_then(|h| h.peel_to_tree()).ok();
    repo.reset_default(head.as_ref(), &[]).map_err(|e| e.to_string())?;
    Ok(())
}

// ────────────────────── Branch commands ──────────────────────

/// List all local and remote branches.
#[tauri::command]
fn get_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head_oid = repo.head().ok().and_then(|h| h.target());

    let mut result = Vec::new();

    if let Ok(branches) = repo.branches(None) {
        for branch_result in branches {
            if let Ok((branch, bt)) = branch_result {
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
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    // Try as a branch first.
    if let Ok(reference) = repo.find_branch(&target, git2::BranchType::Local) {
        repo.checkout_tree(reference.get().peel_to_object().as_ref(), None)
            .map_err(|e| e.to_string())?;
        repo.set_head(&format!("refs/heads/{}", target))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Try as a remote branch — create a local tracking branch.
    let remote_ref = format!("refs/remotes/origin/{}", target);
    if let Ok(reference) = repo.find_reference(&remote_ref) {
        let commit = reference.peel_to_commit().map_err(|e| e.to_string())?;
        let branch = repo
            .branch(&target, &commit, false)
            .map_err(|e| e.to_string())?;
        repo.checkout_tree(branch.get().peel_to_object().as_ref(), None)
            .map_err(|e| e.to_string())?;
        repo.set_head(&format!("refs/heads/{}", target))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Try as an OID.
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
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().and_then(|h| h.peel_to_commit()).map_err(|e| e.to_string())?;
    repo.branch(&name, &head, false).map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete a local branch.
#[tauri::command]
fn delete_branch(repo_path: String, name: String) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let branch = repo
        .find_branch(&name, git2::BranchType::Local)
        .map_err(|e| e.to_string())?;
    branch.delete().map_err(|e| e.to_string())?;
    Ok(())
}

// ────────────────────── Remote commands ──────────────────────

/// Push the current branch to a remote.
#[tauri::command]
fn do_push(repo_path: String, remote: String, branch: String) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
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
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let remote_name = remote.clone();

    // Fetch first.
    {
        let mut remote = repo.find_remote(&remote_name).map_err(|e| e.to_string())?;
        remote.fetch(&[&branch], None, None).map_err(|e| e.to_string())?;
    }

    // Merge the fetched branch.
    let fetch_branch = format!("{}/{}", remote_name, branch);
    let annotated =
        repo.reference_to_annotated_commit(&fetch_branch)
            .map_err(|e| e.to_string())?;

    let analysis = repo.merge_analysis(&[&annotated]).map_err(|e| e.to_string())?;

    if analysis.0.is_fast_forward() {
        if let Some(oid) = annotated.target() {
            let refname = format!("refs/heads/{}", branch);
            repo.reference(&refname, oid, true, "pull: fast-forward", None)
                .map_err(|e| e.to_string())?;
            repo.checkout_tree(annotated.as_object(), None)
                .map_err(|e| e.to_string())?;
        }
    } else if analysis.0.is_normal() {
        let head_commit = repo.head().and_then(|h| h.peel_to_commit()).map_err(|e| e.to_string())?;
        repo.merge(&[&annotated], None)
            .map_err(|e| e.to_string())?;

        let sig = repo.signature().map_err(|e| e.to_string())?;
        let mut index = repo.index().map_err(|e| e.to_string())?;
        index.write_tree().map_err(|e| e.to_string())?;
        let tree = repo
            .find_tree(index.write_tree().map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;

        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &format!("Merge '{}' into {}", remote_name, branch),
            &tree,
            &[&head_commit, &annotated
                .to_commit()
                .map_err(|e| e.to_string())?],
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
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut remote = repo.find_remote(&remote).map_err(|e| e.to_string())?;
    remote.fetch(&[], None, None).map_err(|e| e.to_string())?;
    Ok(())
}

/// List all remotes.
#[tauri::command]
fn get_remotes(repo_path: String) -> Result<Vec<RemoteInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for remote_result in repo.remotes().map_err(|e| e.to_string())?.iter() {
        if let Some(name) = remote_result {
            let url = repo
                .find_remote(name)
                .ok()
                .and_then(|r| r.url().map(String::from))
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
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    let _ = repo.stash_foreach(|index, _oid, msg| {
        let message = msg.unwrap_or("No message").to_string();
        // Extract branch name from stash message (e.g. "On branch: message").
        let branch = message
            .splitn(2, ':')
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
        Ok(true)
    });

    Ok(result)
}

// ────────────────────── Tag commands ──────────────────────

/// List all tags.
#[tauri::command]
fn get_tags(repo_path: String) -> Result<Vec<TagInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    if let Ok(tags) = repo.tags() {
        for tag_result in tags {
            if let Ok(tag) = tag_result {
                let name = tag.name().unwrap_or("").to_string();
                let oid = oid_to_hex(tag.id());
                let message = tag.message().map(String::from);
                result.push(TagInfo { name, oid, message });
            }
        }
    }

    Ok(result)
}

/// Create a lightweight tag at HEAD.
#[tauri::command]
fn create_tag(repo_path: String, name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().and_then(|h| h.peel_to_object()).map_err(|e| e.to_string())?;
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
    revwalk.set_sorting(Sort::TIME).map_err(|e| e.to_string())?;
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

/// Start an interactive rebase. Each commit can have an operation:
/// pick, squash, fixup, reword, edit, drop.
/// This shells out to `git rebase -i` since libgit2's rebase API
/// does not support custom commit selection.
#[tauri::command]
fn start_rebase(
    repo_path: String,
    onto: String,
    operations: Vec<RebaseCommit>,
) -> Result<(), String> {
    // Build the todo list for git rebase -i.
    let mut todo_lines: Vec<String> = Vec::new();
    for op in &operations {
        let oid = &op.oid;
        let line = match op.operation.as_str() {
            "squash" | "s" => {
                if let Some(ref new_msg) = op.new_message {
                    format!("s {} {}", oid, new_msg.replace('\n', " "))
                } else {
                    format!("s {}", oid)
                }
            }
            "fixup" | "f" => format!("f {}", oid),
            "reword" | "r" => {
                if let Some(ref new_msg) = op.new_message {
                    format!("r {} {}", oid, new_msg.replace('\n', " "))
                } else {
                    format!("r {}", oid)
                }
            }
            "edit" | "e" => format!("e {}", oid),
            "drop" | "d" => format!("d {}", oid),
            _ => format!("pick {}", oid),
        };
        todo_lines.push(line);
    }

    let todo = todo_lines.join("\n");

    // Write the todo file and invoke rebase.
    use std::io::Write;
    let output = Command::new("git")
        .current_dir(&repo_path)
        .args([
            "rebase",
            "-i",
            &onto,
            "--no-autosquash",
            "--quiet",
        ])
        .env("GIT_SEQUENCE_EDITOR", "cat") // Just show the todo, don't edit.
        .output()
        .map_err(|e| format!("Failed to start rebase: {}", e))?;

    // If rebase needs manual todo editing, we write our own todo.
    if !output.status.success() {
        // Try the manual approach: init rebase, write todo, continue.
        let rebase_dir = Path::new(&repo_path).join(".git").join("rebase-merge");
        if !rebase_dir.exists() {
            return Err(format!(
                "Rebase could not start. Git output: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let todo_path = rebase_dir.join("git-rebase-todo");
        let mut f = std::fs::File::create(&todo_path)
            .map_err(|e| format!("Failed to write todo file: {}", e))?;
        f.write_all(todo.as_bytes())
            .map_err(|e| format!("Failed to write todo: {}", e))?;
        f.flush().map_err(|e| format!("Failed to flush todo: {}", e))?;
    }

    Ok(())
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
    index.add_conflicts_from_dir(Path::new(".")).ok();
    index.write().ok();

    let mut conflicts = Vec::new();
    if let Ok(conflict_iter) = index.conflicts() {
        for conflict_result in conflict_iter {
            if let Ok(entry) = conflict_result {
                let path_str = entry
                    .ancestor
                    .as_ref()
                    .or(entry.ourself.as_ref())
                    .or(entry.theirself.as_ref())
                    .map(|e| {
                        e.path
                            .as_ref()
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_default()
                    })
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
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

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
    revwalk.set_sorting(Sort::TIME).map_err(|e| e.to_string())?;
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
            let url = sm.url().unwrap_or("").to_string();
            let head_oid = sm
                .head_id()
                .map(|oid| oid_to_hex(oid))
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

// ────────────────────── Entry point ──────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            open_repo,
            clone_repo,
            init_repo,
            get_status,
            get_diff,
            get_log,
            do_commit,
            stage_file,
            unstage_file,
            stage_all,
            unstage_all,
            get_branches,
            checkout_branch,
            create_branch,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
