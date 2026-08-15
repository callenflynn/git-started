import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRepoStore } from "../stores/repo-store";
import * as git from "../lib/tauri";

// Each hook wraps a Tauri invoke call with React Query for
// automatic caching, refetching, and loading/error states.

export function useRepoStatus() {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["status", repoPath],
    queryFn: () => git.getStatus(repoPath!),
    enabled: !!repoPath,
    refetchInterval: 3000,
  });
}

export function useLog() {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["log", repoPath],
    queryFn: () => git.getLog(repoPath!),
    enabled: !!repoPath,
  });
}

export function useCommitDiff(oid: string | null) {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["commit-diff", repoPath, oid],
    queryFn: () => git.getCommitDiff(repoPath!, oid!),
    enabled: !!repoPath && !!oid,
  });
}

export function useCherryPick() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: (oid: string) => git.cherryPick(repoPath!, oid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
      qc.invalidateQueries({ queryKey: ["log", repoPath] });
      qc.invalidateQueries({ queryKey: ["branches", repoPath] });
    },
  });
}

export function useRevert() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: (oid: string) => git.revertCommit(repoPath!, oid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
      qc.invalidateQueries({ queryKey: ["log", repoPath] });
      qc.invalidateQueries({ queryKey: ["branches", repoPath] });
    },
  });
}

export function useBranches() {
  const repoPath = useRepoStore((s) => s.repoPath);
  const autoFetchMs = useRepoStore((s) => s.autoFetchMs);
  return useQuery({
    queryKey: ["branches", repoPath],
    queryFn: () => git.getBranches(repoPath!),
    enabled: !!repoPath,
    refetchInterval: autoFetchMs > 0 ? autoFetchMs : false,
  });
}

export function useRemotes() {
  const repoPath = useRepoStore((s) => s.repoPath);
  const autoFetchMs = useRepoStore((s) => s.autoFetchMs);
  return useQuery({
    queryKey: ["remotes", repoPath],
    queryFn: () => git.getRemotes(repoPath!),
    enabled: !!repoPath,
    refetchInterval: autoFetchMs > 0 ? autoFetchMs : false,
  });
}

export function useStashes() {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["stashes", repoPath],
    queryFn: () => git.getStashes(repoPath!),
    enabled: !!repoPath,
  });
}

export function useTags() {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["tags", repoPath],
    queryFn: () => git.getTags(repoPath!),
    enabled: !!repoPath,
  });
}

export function useDiff(filePath: string | null, staged: boolean) {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["diff", repoPath, filePath, staged],
    queryFn: () => git.getDiff(repoPath!, filePath!, staged),
    enabled: !!repoPath && !!filePath,
  });
}

export function useStageFile() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: (filePath: string) => git.stageFile(repoPath!, filePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
    },
  });
}

export function useUnstageFile() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: (filePath: string) => git.unstageFile(repoPath!, filePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
    },
  });
}

export function useStageAll() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: () => git.stageAll(repoPath!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status", repoPath] }),
  });
}

export function useUnstageAll() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: () => git.unstageAll(repoPath!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status", repoPath] }),
  });
}

export function useCommit() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: ({
      message,
      amend,
      sign,
    }: {
      message: string;
      amend: boolean;
      sign: boolean;
    }) => git.commit(repoPath!, message, amend, sign),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
      qc.invalidateQueries({ queryKey: ["log", repoPath] });
      qc.invalidateQueries({ queryKey: ["branches", repoPath] });
    },
  });
}

export function useSigningInfo() {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["signing", repoPath],
    queryFn: () => git.getSigningInfo(repoPath!),
    enabled: !!repoPath,
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: (target: string) => git.checkout(repoPath!, target),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
      qc.invalidateQueries({ queryKey: ["log", repoPath] });
      qc.invalidateQueries({ queryKey: ["branches", repoPath] });
    },
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: (name: string) => git.createBranch(repoPath!, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches", repoPath] }),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: (name: string) => git.deleteBranch(repoPath!, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches", repoPath] }),
  });
}

export function usePush() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: ({ remote, branch }: { remote: string; branch: string }) =>
      git.push(repoPath!, remote, branch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches", repoPath] }),
  });
}

export function usePull() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: ({ remote, branch }: { remote: string; branch: string }) =>
      git.pull(repoPath!, remote, branch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
      qc.invalidateQueries({ queryKey: ["log", repoPath] });
      qc.invalidateQueries({ queryKey: ["branches", repoPath] });
    },
  });
}

export function useFetch() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: (remote: string) => git.fetch(repoPath!, remote),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches", repoPath] }),
  });
}

export function useStash() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: () => git.stash(repoPath!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
      qc.invalidateQueries({ queryKey: ["stashes", repoPath] });
    },
  });
}

export function useStashPop() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: () => git.stashPop(repoPath!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
      qc.invalidateQueries({ queryKey: ["stashes", repoPath] });
    },
  });
}

// ---- Rebase hooks ----

export function useRebaseCommits(branch: string, base: string) {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["rebase-commits", repoPath, branch, base],
    queryFn: () => git.getRebaseCommits(repoPath!, branch, base),
    enabled: !!repoPath && !!branch && !!base,
  });
}

export function useRebaseStatus() {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["rebase-status", repoPath],
    queryFn: () => git.getRebaseStatus(repoPath!),
    enabled: !!repoPath,
  });
}

export function useStartRebase() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: ({
      onto,
      operations,
    }: {
      onto: string;
      operations: import("../lib/types").RebaseCommit[];
    }) => git.startRebase(repoPath!, onto, operations),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log", repoPath] });
      qc.invalidateQueries({ queryKey: ["branches", repoPath] });
      qc.invalidateQueries({ queryKey: ["rebase-status", repoPath] });
    },
  });
}

export function useRebaseContinue() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: () => git.rebaseContinue(repoPath!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log", repoPath] });
      qc.invalidateQueries({ queryKey: ["branches", repoPath] });
      qc.invalidateQueries({ queryKey: ["rebase-status", repoPath] });
    },
  });
}

export function useRebaseAbort() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: () => git.rebaseAbort(repoPath!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
      qc.invalidateQueries({ queryKey: ["log", repoPath] });
      qc.invalidateQueries({ queryKey: ["branches", repoPath] });
      qc.invalidateQueries({ queryKey: ["rebase-status", repoPath] });
    },
  });
}

// ---- Conflict hooks ----

export function useConflicts() {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["conflicts", repoPath],
    queryFn: () => git.getConflicts(repoPath!),
    enabled: !!repoPath,
  });
}

export function useResolveConflict() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: ({ filePath, side }: { filePath: string; side: string }) =>
      git.resolveConflict(repoPath!, filePath, side),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
      qc.invalidateQueries({ queryKey: ["conflicts", repoPath] });
    },
  });
}

// ---- Submodule hooks ----

export function useSubmodules() {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["submodules", repoPath],
    queryFn: () => git.getSubmodules(repoPath!),
    enabled: !!repoPath,
  });
}

export function useSubmoduleUpdate() {
  const qc = useQueryClient();
  const repoPath = useRepoStore((s) => s.repoPath);
  return useMutation({
    mutationFn: (name: string) => git.submoduleUpdate(repoPath!, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["submodules", repoPath] }),
  });
}

// ---- Credential hooks ----

export function useCredentialInfo() {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["credentials", repoPath],
    queryFn: () => git.getCredentialInfo(repoPath!),
    enabled: !!repoPath,
  });
}

// ---- Commit search hook ----

export function useSearchCommits(query: string) {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["search-commits", repoPath, query],
    queryFn: () => git.searchCommits(repoPath!, query),
    enabled: !!repoPath && query.trim().length > 0,
  });
}

// ---- Auth hooks ----

export function useSshKeys() {
  return useQuery({
    queryKey: ["ssh-keys"],
    queryFn: () => git.getSshKeys(),
  });
}

export function useSshAgentStatus() {
  return useQuery({
    queryKey: ["ssh-agent"],
    queryFn: () => git.getSshAgentStatus(),
  });
}

export function useGenerateSshKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment: string) => git.generateSshKey(comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ssh-keys"] }),
  });
}

export function useTestSshConnection() {
  return useMutation({
    mutationFn: (host: string) => git.testSshConnection(host),
  });
}

export function useSaveCredential() {
  return useMutation({
    mutationFn: ({
      protocol,
      host,
      username,
      password,
    }: {
      protocol: string;
      host: string;
      username: string;
      password: string;
    }) => git.saveCredential(protocol, host, username, password),
  });
}

export function useRemoveCredential() {
  return useMutation({
    mutationFn: ({ protocol, host }: { protocol: string; host: string }) =>
      git.removeCredential(protocol, host),
  });
}

export function useGitConfig(key: string) {
  return useQuery({
    queryKey: ["git-config", key],
    queryFn: () => git.getGitConfig(key),
  });
}

// ---- Recent repositories ----

export function useRecentRepos() {
  return useQuery({
    queryKey: ["recent-repos"],
    queryFn: () => git.getRecentRepos(),
  });
}

export function useAddRecentRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => git.addRecentRepo(path),
    onSuccess: (repos) => {
      qc.setQueryData(["recent-repos"], repos);
    },
  });
}

export function useRemoveRecentRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => git.removeRecentRepo(path),
    onSuccess: (repos) => {
      qc.setQueryData(["recent-repos"], repos);
    },
  });
}

// ---- Repository discovery ----

export function useDetectGitRepos() {
  return useMutation({
    mutationFn: () => git.detectGitRepos(),
  });
}
