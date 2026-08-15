import { invoke } from "@tauri-apps/api/core";
import type {
  RepoInfo,
  CommitInfo,
  CommitFileChange,
  FileStatus,
  BranchInfo,
  StashInfo,
  RemoteInfo,
  TagInfo,
  SigningInfo,
  RebaseCommit,
  RebaseStatus,
  ConflictFile,
  SubmoduleInfo,
  CredentialInfo,
  SshKeyInfo,
  SshAgentStatus,
  SshTestResult,
  BlameLine,
  ReflogEntry,
  RepoStats,
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

export async function commit(
  repoPath: string,
  message: string,
  amend: boolean,
  sign: boolean
): Promise<string> {
  return invoke<string>("do_commit", { repoPath, message, amend, sign });
}

export async function getSigningInfo(repoPath: string): Promise<SigningInfo> {
  return invoke<SigningInfo>("get_signing_info", { repoPath });
}

export async function searchCommits(
  repoPath: string,
  query: string,
  max?: number
): Promise<CommitInfo[]> {
  return invoke<CommitInfo[]>("search_commits", { repoPath, query, max });
}

// ---- Commit inspection & operations ----

export async function getCommitDiff(
  repoPath: string,
  oid: string
): Promise<CommitFileChange[]> {
  return invoke<CommitFileChange[]>("get_commit_diff", { repoPath, oid });
}

export async function cherryPick(repoPath: string, oid: string): Promise<void> {
  return invoke("cherry_pick", { repoPath, oid });
}

export async function cherryPickMany(repoPath: string, oids: string[]): Promise<void> {
  return invoke("cherry_pick_many", { repoPath, oids });
}

export async function revertCommit(repoPath: string, oid: string): Promise<void> {
  return invoke("revert", { repoPath, oid });
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

export async function stageLines(
  repoPath: string,
  filePath: string,
  staged: boolean,
  addLines: number[],
  delLines: number[]
): Promise<void> {
  return invoke("stage_lines", {
    repoPath,
    filePath,
    staged,
    addLines,
    delLines,
  });
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

export async function createBranchAt(repoPath: string, name: string, oid: string): Promise<void> {
  return invoke("create_branch_at", { repoPath, name, oid });
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

// ---- Rebase ----

export async function getRebaseCommits(
  repoPath: string,
  branch: string,
  base: string
): Promise<RebaseCommit[]> {
  return invoke<RebaseCommit[]>("get_rebase_commits", { repoPath, branch, base });
}

export async function getRebaseStatus(repoPath: string): Promise<RebaseStatus> {
  return invoke<RebaseStatus>("get_rebase_status", { repoPath });
}

export async function startRebase(
  repoPath: string,
  branch: string,
  onto: string,
  operations: RebaseCommit[],
  backup: boolean
): Promise<void> {
  return invoke("start_rebase", { repoPath, branch, onto, operations, backup });
}

export async function rebaseContinue(repoPath: string): Promise<void> {
  return invoke("rebase_continue", { repoPath });
}

export async function rebaseAbort(repoPath: string): Promise<void> {
  return invoke("rebase_abort", { repoPath });
}

// ---- Merge conflicts ----

export async function getConflicts(repoPath: string): Promise<ConflictFile[]> {
  return invoke<ConflictFile[]>("get_conflicts", { repoPath });
}

export async function resolveConflict(
  repoPath: string,
  filePath: string,
  side: string
): Promise<void> {
  return invoke("resolve_conflict", { repoPath, filePath, side });
}

// ---- Submodules ----

export async function getSubmodules(repoPath: string): Promise<SubmoduleInfo[]> {
  return invoke<SubmoduleInfo[]>("get_submodules", { repoPath });
}

export async function submoduleUpdate(repoPath: string, name: string): Promise<void> {
  return invoke("submodule_update", { repoPath, name });
}

// ---- Credential helper ----

export async function getCredentialInfo(repoPath: string): Promise<CredentialInfo> {
  return invoke<CredentialInfo>("get_credential_info", { repoPath });
}

// ---- SSH keys ----

export async function getSshKeys(): Promise<SshKeyInfo[]> {
  return invoke<SshKeyInfo[]>("get_ssh_keys");
}

export async function generateSshKey(comment: string): Promise<string> {
  return invoke<string>("generate_ssh_key", { comment });
}

export async function getSshAgentStatus(): Promise<SshAgentStatus> {
  return invoke<SshAgentStatus>("get_ssh_agent_status");
}

export async function testSshConnection(host: string): Promise<SshTestResult> {
  return invoke<SshTestResult>("test_ssh_connection", { host });
}

// ---- Credential save/remove ----

export async function saveCredential(
  protocol: string,
  host: string,
  username: string,
  password: string
): Promise<void> {
  return invoke("save_credential", { protocol, host, username, password });
}

export async function removeCredential(protocol: string, host: string): Promise<void> {
  return invoke("remove_credential", { protocol, host });
}

export async function getGitConfig(key: string, repoPath?: string): Promise<string | null> {
  return invoke<string | null>("get_git_config", { key, repoPath: repoPath ?? null });
}

// ---- History & inspection ----

export async function getBlame(repoPath: string, filePath: string): Promise<BlameLine[]> {
  return invoke<BlameLine[]>("get_blame", { repoPath, filePath });
}

export async function getFileHistory(
  repoPath: string,
  filePath: string
): Promise<CommitInfo[]> {
  return invoke<CommitInfo[]>("get_file_history", { repoPath, filePath });
}

export async function getReflog(repoPath: string): Promise<ReflogEntry[]> {
  return invoke<ReflogEntry[]>("get_reflog", { repoPath });
}

export async function getRepoStats(repoPath: string): Promise<RepoStats> {
  return invoke<RepoStats>("get_repo_stats", { repoPath });
}

export async function readFileVersion(
  repoPath: string,
  filePath: string,
  revision: string | null
): Promise<string | null> {
  return invoke<string | null>("read_file_version", { repoPath, filePath, revision });
}

export async function deleteTag(repoPath: string, name: string): Promise<void> {
  return invoke("delete_tag", { repoPath, name });
}

// ---- Recent repositories ----

export async function getRecentRepos(): Promise<string[]> {
  return invoke<string[]>("get_recent_repos");
}

export async function addRecentRepo(path: string): Promise<string[]> {
  return invoke<string[]>("add_recent_repo", { path });
}

export async function removeRecentRepo(path: string): Promise<string[]> {
  return invoke<string[]>("remove_recent_repo", { path });
}

// ---- Repository discovery ----

export async function detectGitRepos(): Promise<string[]> {
  return invoke<string[]>("detect_git_repos");
}
