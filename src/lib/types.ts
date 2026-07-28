export type ThemeName = "dark" | "amoled" | "light";

export interface RepoInfo {
  path: string;
  name: string;
  head_branch: string;
  is_dirty: boolean;
}

export interface CommitInfo {
  oid: string;
  short_oid: string;
  message: string;
  author: string;
  author_email: string;
  timestamp: number;
  parent_oids: string[];
  branch_names: string[];
}

export interface FileStatus {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
  staged: boolean;
  old_path?: string;
}

export interface BranchInfo {
  name: string;
  is_head: boolean;
  is_remote: boolean;
  upstream: string | null;
}

export interface StashInfo {
  index: number;
  message: string;
  branch: string;
  timestamp: number;
}

export interface RemoteInfo {
  name: string;
  url: string;
}

export interface TagInfo {
  name: string;
  oid: string;
  message: string | null;
}

export interface SigningInfo {
  enabled: boolean;
  format: string;
  key_id: string;
}

export interface RebaseCommit {
  oid: string;
  short_oid: string;
  message: string;
  author: string;
  timestamp: number;
  operation: string;
  new_message: string | null;
}

export interface RebaseStatus {
  in_progress: boolean;
  current_head: string | null;
}

export interface ConflictFile {
  path: string;
  ancestor: string | null;
  ours: string | null;
  theirs: string | null;
}

export interface SubmoduleInfo {
  name: string;
  path: string;
  url: string;
  head_oid: string;
  status: string;
}

export interface CredentialInfo {
  helper: string;
  storage: string;
  configured: boolean;
}

export interface SshKeyInfo {
  path: string;
  filename: string;
  public_key: string;
  fingerprint: string;
  exists: boolean;
}

export interface SshAgentStatus {
  has_agent: boolean;
  loaded_keys: string[];
  error: string | null;
}

export interface SshTestResult {
  success: boolean;
  message: string;
}
