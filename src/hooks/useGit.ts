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

export function useBranches() {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["branches", repoPath],
    queryFn: () => git.getBranches(repoPath!),
    enabled: !!repoPath,
  });
}

export function useRemotes() {
  const repoPath = useRepoStore((s) => s.repoPath);
  return useQuery({
    queryKey: ["remotes", repoPath],
    queryFn: () => git.getRemotes(repoPath!),
    enabled: !!repoPath,
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
    mutationFn: ({ message, amend }: { message: string; amend: boolean }) =>
      git.commit(repoPath!, message, amend),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
      qc.invalidateQueries({ queryKey: ["log", repoPath] });
      qc.invalidateQueries({ queryKey: ["branches", repoPath] });
    },
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
