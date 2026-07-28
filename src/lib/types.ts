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
