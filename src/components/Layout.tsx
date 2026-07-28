import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { useRepoStore } from "../stores/repo-store";

interface LayoutProps {
  children: ReactNode;
  onRebase?: (branch: string, base: string) => void;
}

export function Layout({ children, onRebase }: LayoutProps) {
  const repoPath = useRepoStore((s) => s.repoPath);

  if (!repoPath) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar onRebase={onRebase ?? (() => {})} />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
