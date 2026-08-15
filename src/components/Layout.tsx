import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { ResizeHandle } from "./ResizeHandle";
import { useRepoStore } from "../stores/repo-store";
import { useLayoutStore } from "../stores/layout-store";

interface LayoutProps {
  children: ReactNode;
  onRebase?: (branch: string, base: string) => void;
}

export function Layout({ children, onRebase }: LayoutProps) {
  const repoPath = useRepoStore((s) => s.repoPath);
  const setSidebarWidth = useLayoutStore((s) => s.setSidebarWidth);
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);

  if (!repoPath) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        {sidebarVisible && (
          <>
            <Sidebar onRebase={onRebase ?? (() => {})} />
            <ResizeHandle
              direction="vertical"
              onDelta={(d) => setSidebarWidth((w) => w + d)}
              title="Resize sidebar"
            />
          </>
        )}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
