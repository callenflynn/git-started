import {
  useBranches,
  useCheckout,
  useCreateBranch,
  useDeleteBranch,
  useStashes,
  useStashPop,
  useTags,
  useCreateTag,
  useDeleteTag,
  useSubmodules,
  useSubmoduleUpdate,
  useCredentialInfo,
} from "../hooks/useGit";
import { useState } from "react";
import { useLayoutStore } from "../stores/layout-store";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import {
  GitBranch,
  Globe,
  Tag,
  Archive,
  Plus,
  Trash2,
  ArrowDownToLine,
  ArrowUpRight,
  GitMerge,
  Package,
  RefreshCw,
  Key,
  CheckCircle,
} from "lucide-react";

function SectionHeader({ title, count, children }: { title: string; count?: number; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2"
         style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}>
        {title}
        {count !== undefined && (
          <span className="text-[10px] leading-none px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
            {count}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

function BranchItem({ name, isHead, selected, upstream, onSelect, onCheckout, onDelete, onRebase, onContextMenu }: {
  name: string;
  isHead: boolean;
  selected: boolean;
  upstream: string | null;
  onSelect: () => void;
  onCheckout: () => void;
  onDelete: () => void;
  onRebase?: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const cls = `group relative flex items-center gap-2 mx-1.5 my-0.5 px-2 py-1.5 rounded-md cursor-pointer branch-item${
    isHead ? " is-head" : selected ? " is-selected" : ""
  }`;

  return (
    <div
      className={cls}
      onClick={onSelect}
      onDoubleClick={onCheckout}
      onContextMenu={onContextMenu}
      title="Double-click to checkout"
    >
      <GitBranch
        size={13}
        className="shrink-0"
        style={{ color: isHead ? "var(--accent)" : "var(--text-muted)" }}
      />
      <span
        className="text-sm truncate flex-1"
        style={{
          color: isHead ? "var(--accent)" : "var(--text-primary)",
          fontWeight: isHead ? 600 : 400,
        }}
      >
        {name}
      </span>

      {upstream && (
        <span className="shrink-0 opacity-40 flex items-center" title={`Tracks ${upstream}`}>
          <ArrowUpRight size={11} style={{ color: "var(--text-muted)" }} />
        </span>
      )}

      {isHead && (
        <span className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "var(--accent)", color: "var(--text-inverse)" }}>
          HEAD
        </span>
      )}

      {!isHead && (
        <>
          {onRebase && (
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-blue-500/20"
              onClick={(e) => { e.stopPropagation(); onRebase(); }}
              title="Rebase onto another branch"
            >
              <GitMerge size={12} style={{ color: "var(--text-muted)" }} />
            </button>
          )}
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/20"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete branch"
          >
            <Trash2 size={12} style={{ color: "var(--text-muted)" }} />
          </button>
        </>
      )}
    </div>
  );
}

interface SidebarProps {
  onRebase: (branch: string, base: string) => void;
}

export function Sidebar({ onRebase }: SidebarProps) {
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth);
  const branches = useBranches();
  const stashes = useStashes();
  const tags = useTags();
  const submodules = useSubmodules();
  const credentials = useCredentialInfo();
  const checkoutMut = useCheckout();
  const createBranchMut = useCreateBranch();
  const deleteBranchMut = useDeleteBranch();
  const stashPopMut = useStashPop();
  const createTagMut = useCreateTag();
  const deleteTagMut = useDeleteTag();
  const submoduleUpdateMut = useSubmoduleUpdate();

  const [newBranch, setNewBranch] = useState("");
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    name: string;
    isHead: boolean;
  } | null>(null);

  const localBranches = branches.data?.filter((b) => !b.is_remote) ?? [];
  const remoteBranches = branches.data?.filter((b) => b.is_remote) ?? [];
  const currentBranch = branches.data?.find((b) => b.is_head);

  function handleCheckout(name: string) {
    checkoutMut.mutate(name);
  }

  function handleCreateBranch() {
    if (!newBranch.trim()) return;
    createBranchMut.mutate(newBranch.trim());
    setNewBranch("");
    setShowNewBranch(false);
  }

  function openBranchMenu(e: React.MouseEvent, name: string, isHead: boolean) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, name, isHead });
  }

  const menuItems: MenuItem[] = menu
    ? [
        {
          label: "Checkout",
          icon: <GitBranch size={14} />,
          onClick: () => checkoutMut.mutate(menu.name),
        },
        ...(menu.isHead
          ? []
          : [
              {
                label: "Rebase onto current",
                icon: <GitMerge size={14} />,
                onClick: () => onRebase(menu.name, currentBranch?.name ?? "main"),
              },
              {
                label: "Delete",
                icon: <Trash2 size={14} />,
                danger: true,
                onClick: () => deleteBranchMut.mutate(menu.name),
              },
            ]),
      ]
    : [];

  const sidebarStyle = {
    background: "var(--bg-secondary)",
    borderRight: "1px solid var(--border)",
    width: sidebarWidth,
  };

  return (
    <aside className="flex flex-col overflow-y-auto shrink-0" style={sidebarStyle}>
      {/* Local branches */}
      <SectionHeader title="Branches" count={localBranches.length}>
        <button
          className="p-1 rounded transition-colors hover:bg-white/10"
          onClick={() => setShowNewBranch(!showNewBranch)}
          title="New branch"
        >
          <Plus size={14} style={{ color: "var(--text-muted)" }} />
        </button>
      </SectionHeader>

      {showNewBranch && (
        <div className="px-3 py-2 flex gap-1" style={{ borderBottom: "1px solid var(--border)" }}>
          <input
            autoFocus
            value={newBranch}
            onChange={(e) => setNewBranch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateBranch()}
            placeholder="branch name"
            className="flex-1 text-sm px-2 py-1 rounded outline-none"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-strong)",
            }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {localBranches.map((b) => (
          <BranchItem
            key={b.name}
            name={b.name}
            isHead={b.is_head}
            selected={selectedBranch === b.name}
            upstream={b.upstream}
            onSelect={() => setSelectedBranch(b.name)}
            onCheckout={() => handleCheckout(b.name)}
            onDelete={() => deleteBranchMut.mutate(b.name)}
            onRebase={
              !b.is_head
                ? () => onRebase(b.name, currentBranch?.name ?? "main")
                : undefined
            }
            onContextMenu={(e) => openBranchMenu(e, b.name, b.is_head)}
          />
        ))}
      </div>

      {/* Remotes */}
      {remoteBranches.length > 0 && (
        <>
          <SectionHeader title="Remotes" count={remoteBranches.length}>
            <Globe size={13} style={{ color: "var(--text-muted)" }} />
          </SectionHeader>
          <div className="flex-1 overflow-y-auto">
            {remoteBranches.map((b) => (
              <BranchItem
                key={b.name}
                name={b.name}
                isHead={b.is_head}
                selected={selectedBranch === b.name}
                upstream={b.upstream}
                onSelect={() => setSelectedBranch(b.name)}
                onCheckout={() => handleCheckout(b.name)}
                onDelete={() => deleteBranchMut.mutate(b.name)}
                onContextMenu={(e) => openBranchMenu(e, b.name, b.is_head)}
              />
            ))}
          </div>
        </>
      )}

      {/* Stashes */}
      {(stashes.data?.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Stashes">
            <Archive size={13} style={{ color: "var(--text-muted)" }} />
          </SectionHeader>
          {stashes.data!.map((s) => (
            <div
              key={s.index}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors"
              style={{ background: "transparent" }}
              onClick={() => stashPopMut.mutate()}
            >
              <ArrowDownToLine size={13} style={{ color: "var(--text-muted)" }} />
              <span className="text-sm truncate"
                    style={{ color: "var(--text-secondary)" }}>
                {s.message}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Tags */}
      <>
        <SectionHeader title="Tags" count={tags.data?.length ?? 0}>
          <button
            className="p-1 rounded transition-colors hover:bg-white/10"
            onClick={() => {
              const name = window.prompt("Tag name:");
              if (name?.trim()) createTagMut.mutate(name.trim());
            }}
            title="Create tag"
          >
            <Plus size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        </SectionHeader>
        {(tags.data ?? []).map((t) => (
          <div key={t.name} className="group flex items-center gap-2 px-3 py-1.5">
            <Tag size={13} style={{ color: "var(--text-muted)" }} />
            <span className="text-sm truncate flex-1" style={{ color: "var(--text-secondary)" }}>
              {t.name}
            </span>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/20"
              onClick={() => deleteTagMut.mutate(t.name)}
              title="Delete tag"
            >
              <Trash2 size={12} style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        ))}
      </>

      {/* Submodules */}
      {(submodules.data?.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Submodules">
            <Package size={13} style={{ color: "var(--text-muted)" }} />
          </SectionHeader>
          {submodules.data!.map((sm) => (
            <div
              key={sm.name}
              className="flex items-center gap-2 px-3 py-1.5 group cursor-pointer transition-colors"
              title={`Update submodule ${sm.name}`}
              onClick={() => submoduleUpdateMut.mutate(sm.name)}
            >
              <Package size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span className="text-sm truncate flex-1"
                    style={{ color: "var(--text-secondary)" }}>
                {sm.name}
              </span>
              <span className="text-[10px] px-1 py-0.5 rounded"
                    style={{
                      background: sm.status === "initialized" ? "#22C55E/20" : "#F59E0B/20",
                      color: sm.status === "initialized" ? "#22C55E" : "#F59E0B",
                    }}>
                {sm.status}
              </span>
              <RefreshCw
                size={11}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}
              />
            </div>
          ))}
        </>
      )}

      {/* Credential helper */}
      {credentials.data?.configured && (
        <>
          <SectionHeader title="Credentials">
            <Key size={13} style={{ color: "var(--text-muted)" }} />
          </SectionHeader>
          <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle size={12} style={{ color: "#22C55E" }} />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {credentials.data.helper}
              </span>
            </div>
            {credentials.data.storage && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Storage: {credentials.data.storage}
              </span>
            )}
          </div>
        </>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  );
}
