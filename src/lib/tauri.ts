import { invoke } from "@tauri-apps/api/core";
import type {
  RepoInfo,
  CommitInfo,
  FileStatus,
  BranchInfo,
  StashInfo,
  RemoteInfo,
  TagInfo,
} from "./types";

// ---- Repo operations ----

export async function openRepo(path: string): Promise<RepoInfo> {
  return invoke<RepoInfo>("open_repo", { path });
}

export async function cloneRepo(url: string, dest: string): Promise<RepoInfo> {
  return invoke<RepoInfo>("clone_repo", { url, dest });
}

export async function initRepo(path: string): Promise<RepoInfo> {
  return invoke<RepoInfo>("init_repo", { path });
}

// ---- Status and diffs ----

export async function getStatus(repoPath: string): Promise<FileStatus[]> {
  return invoke<FileStatus[]>("get_status", { repoPath });
}

export async function getDiff(repoPath: string, filePath: string, staged: boolean): Promise<string> {
  return invoke<string>("get_diff", { repoPath, filePath, staged });
}

// ---- Commits ----

export async function getLog(repoPath: string, max?: number): Promise<CommitInfo[]> {
  return invoke<CommitInfo[]>("get_log", { repoPath, max: max ?? 200 });
}

export async function commit(repoPath: string, message: string, amend: boolean): Promise<string> {
  return invoke<string>("do_commit", { repoPath, message, amend });
}

// ---- Staging ----

export async function stageFile(repoPath: string, filePath: string): Promise<void> {
  return invoke("stage_file", { repoPath, filePath });
}

export async function unstageFile(repoPath: string, filePath: string): Promise<void> {
  return invoke("unstage_file", { repoPath, filePath });
}

export async function stageAll(repoPath: string): Promise<void> {
  return invoke("stage_all", { repoPath });
}

export async function unstageAll(repoPath: string): Promise<void> {
  return invoke("unstage_all", { repoPath });
}

// ---- Branches ----

export async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  return invoke<BranchInfo[]>("get_branches", { repoPath });
}

export async function checkout(repoPath: string, target: string): Promise<void> {
  return invoke("checkout_branch", { repoPath, target });
}

export async function createBranch(repoPath: string, name: string): Promise<void> {
  return invoke("create_branch", { repoPath, name });
}

export async function deleteBranch(repoPath: string, name: string): Promise<void> {
  return invoke("delete_branch", { repoPath, name });
}

// ---- Remote operations ----

export async function push(repoPath: string, remote: string, branch: string): Promise<void> {
  return invoke("do_push", { repoPath, remote, branch });
}

export async function pull(repoPath: string, remote: string, branch: string): Promise<void> {
  return invoke("do_pull", { repoPath, remote, branch });
}

export async function fetch(repoPath: string, remote: string): Promise<void> {
  return invoke("do_fetch", { repoPath, remote });
}

export async function getRemotes(repoPath: string): Promise<RemoteInfo[]> {
  return invoke<RemoteInfo[]>("get_remotes", { repoPath });
}

// ---- Stash ----

export async function stash(repoPath: string): Promise<void> {
  return invoke("do_stash", { repoPath });
}

export async function stashPop(repoPath: string): Promise<void> {
  return invoke("stash_pop", { repoPath });
}

export async function getStashes(repoPath: string): Promise<StashInfo[]> {
  return invoke<StashInfo[]>("get_stashes", { repoPath });
}

// ---- Tags ----

export async function getTags(repoPath: string): Promise<TagInfo[]> {
  return invoke<TagInfo[]>("get_tags", { repoPath });
}

export async function createTag(repoPath: string, name: string): Promise<void> {
  return invoke("create_tag", { repoPath, name });
}
