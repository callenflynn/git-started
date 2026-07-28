use git2::{Repository, Sort};
use serde::Serialize;
use std::path::Path;

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
#[tauri::command]
fn do_commit(repo_path: String, message: String, amend: bool) -> Result<String, String> {
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

// ────────────────────── Entry point ──────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
