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
                if let Ok(oid) = branch.get().resolve().map(|r| r.target()) {
                    let short = ref_name
                        .strip_prefix("refs/heads/")
                        .unwrap_or(ref_name)
                        .to_string();
                    branch_map.insert(short, oid.unwrap());
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

/// Start an interactive rebase. You can specify an action for each commit.
/// The actions are: pick, squash, fixup, reword, edit, or drop.
/// This uses the command line interface (`git rebase -i`) because the libgit2 library
/// does not let you assign custom actions to commits.
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
            get_ssh_keys,
            generate_ssh_key,
            get_ssh_agent_status,
            test_ssh_connection,
            save_credential,
            remove_credential,
            get_git_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
