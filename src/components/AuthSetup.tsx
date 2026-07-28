import { useState } from "react";
import {
  useSshKeys,
  useSshAgentStatus,
  useGenerateSshKey,
  useTestSshConnection,
  useSaveCredential,
  useCredentialInfo,
} from "../hooks/useGit";
import {
  Key,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Copy,
  Loader2,
  Shield,
  Globe,
} from "lucide-react";

type Tab = "ssh" | "pat";

function SshTab() {
  const keys = useSshKeys();
  const agent = useSshAgentStatus();
  const genKey = useGenerateSshKey();
  const testConn = useTestSshConnection();

  const [showGenerate, setShowGenerate] = useState(false);
  const [comment, setComment] = useState("");
  const [testHost, setTestHost] = useState("github.com");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function handleGenerate() {
    if (!comment.trim()) return;
    genKey.mutate(comment.trim(), {
      onSuccess: () => {
        setShowGenerate(false);
        setComment("");
      },
    });
  }

  function handleCopy(pubKey: string) {
    navigator.clipboard.writeText(pubKey);
    setCopiedKey(pubKey);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function handleTest() {
    if (!testHost.trim()) return;
    testConn.mutate(testHost.trim());
  }

  const sshKeys = keys.data ?? [];
  const agentStatus = agent.data;

  return (
    <div className="flex flex-col gap-4">
      {/* SSH Agent status */}
      <div className="flex items-center gap-2">
        {agentStatus?.has_agent ? (
          <CheckCircle size={14} style={{ color: "#22C55E" }} />
        ) : (
          <XCircle size={14} style={{ color: "#EF4444" }} />
        )}
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          SSH Agent: {agentStatus?.has_agent ? "Running" : "Not detected"}
        </span>
        <button
          className="p-1 rounded hover:bg-white/10 transition-colors"
          onClick={() => agent.refetch()}
          title="Refresh"
        >
          <RefreshCw size={12} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {agentStatus?.loaded_keys && agentStatus.loaded_keys.length > 0 && (
        <div className="px-3 py-2 rounded" style={{ background: "var(--bg-card)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Loaded keys:
          </span>
          {agentStatus.loaded_keys.map((k) => (
            <div key={k} className="text-xs font-mono truncate"
                 style={{ color: "var(--text-secondary)" }}>
              {k}
            </div>
          ))}
        </div>
      )}

      {/* Existing keys */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            SSH Keys
          </span>
          <button
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-white/10"
            style={{ color: "var(--accent)" }}
            onClick={() => setShowGenerate(!showGenerate)}
          >
            <Plus size={12} />
            Generate New
          </button>
        </div>

        {sshKeys.length === 0 ? (
          <div className="px-3 py-4 text-sm text-center rounded"
               style={{ color: "var(--text-muted)", background: "var(--bg-card)" }}>
            No SSH keys found in ~/.ssh/
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sshKeys.map((key) => (
              <div
                key={key.path}
                className="flex items-center gap-2 px-3 py-2 rounded"
                style={{ background: "var(--bg-card)" }}
              >
                <Key size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate"
                       style={{ color: "var(--text-primary)" }}>
                    {key.filename}
                  </div>
                  <div className="text-xs font-mono truncate"
                       style={{ color: "var(--text-muted)" }}>
                    {key.fingerprint}
                  </div>
                </div>
                <button
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  onClick={() => handleCopy(key.public_key)}
                  title="Copy public key"
                >
                  {copiedKey === key.public_key ? (
                    <CheckCircle size={13} style={{ color: "#22C55E" }} />
                  ) : (
                    <Copy size={13} style={{ color: "var(--text-muted)" }} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate new key */}
      {showGenerate && (
        <div className="px-3 py-3 rounded" style={{ background: "var(--bg-card)" }}>
          <div className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
            Generate ed25519 keypair
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="your@email.com"
              className="flex-1 text-sm px-2 py-1 rounded outline-none"
              style={{
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-strong)",
              }}
            />
            <button
              className="px-3 py-1 rounded text-sm font-medium transition-colors"
              style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
              onClick={handleGenerate}
              disabled={!comment.trim() || genKey.isPending}
            >
              {genKey.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                "Generate"
              )}
            </button>
          </div>
          {genKey.isError && (
            <div className="mt-2 text-xs" style={{ color: "#EF4444" }}>
              {genKey.error?.message}
            </div>
          )}
          {genKey.isSuccess && (
            <div className="mt-2 text-xs" style={{ color: "#22C55E" }}>
              Key generated. Copy the public key above and add it to your git host.
            </div>
          )}
        </div>
      )}

      {/* Test connection */}
      <div>
        <div className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
          Test Connection
        </div>
        <div className="flex gap-2">
          <input
            value={testHost}
            onChange={(e) => setTestHost(e.target.value)}
            placeholder="github.com"
            className="flex-1 text-sm px-2 py-1 rounded outline-none"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-strong)",
            }}
          />
          <button
            className="px-3 py-1 rounded text-sm font-medium transition-colors"
            style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            onClick={handleTest}
            disabled={!testHost.trim() || testConn.isPending}
          >
            {testConn.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              "Test"
            )}
          </button>
        </div>
        {testConn.data && (
          <div
            className="mt-2 px-3 py-2 rounded text-xs font-mono"
            style={{
              background: testConn.data.success ? "#22C55E15" : "#EF444415",
              color: testConn.data.success ? "#22C55E" : "#EF4444",
            }}
          >
            {testConn.data.message}
          </div>
        )}
        {testConn.isError && (
          <div className="mt-2 text-xs" style={{ color: "#EF4444" }}>
            {testConn.error?.message}
          </div>
        )}
      </div>
    </div>
  );
}

function PatTab() {
  const [provider, setProvider] = useState<"github" | "gitlab" | "custom">("github");
  const [host, setHost] = useState("github.com");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  const saveMut = useSaveCredential();

  const hosts: Record<string, string> = {
    github: "github.com",
    gitlab: "gitlab.com",
    custom: "",
  };

  function handleProviderChange(p: "github" | "gitlab" | "custom") {
    setProvider(p);
    setHost(hosts[p]);
    setSaved(false);
  }

  function handleSave() {
    if (!host.trim() || !username.trim() || !token.trim()) return;
    saveMut.mutate(
      {
        protocol: "https",
        host: host.trim(),
        username: username.trim(),
        password: token.trim(),
      },
      {
        onSuccess: () => setSaved(true),
      }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
          Git Provider
        </div>
        <div className="flex gap-2">
          {(["github", "gitlab", "custom"] as const).map((p) => (
            <button
              key={p}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors capitalize"
              style={{
                background: provider === p ? "var(--accent)" : "var(--bg-card)",
                color: provider === p ? "var(--text-inverse)" : "var(--text-primary)",
                border: `1px solid ${provider === p ? "var(--accent)" : "var(--border)"}`,
              }}
              onClick={() => handleProviderChange(p)}
            >
              {p === "custom" ? "Custom" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
          Host
        </div>
        <div className="flex items-center gap-2">
          <Globe size={14} style={{ color: "var(--text-muted)" }} />
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="github.com"
            className="flex-1 text-sm px-2 py-1 rounded outline-none"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-strong)",
            }}
          />
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
          Username
        </div>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={provider === "github" ? "GitHub username" : provider === "gitlab" ? "GitLab username" : "Username"}
          className="w-full text-sm px-2 py-1 rounded outline-none"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-strong)",
          }}
        />
      </div>

      <div>
        <div className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
          Personal Access Token
        </div>
        <input
          type="password"
          value={token}
          onChange={(e) => { setToken(e.target.value); setSaved(false); }}
          placeholder={
            provider === "github"
              ? "ghp_xxxxxxxxxxxx"
              : provider === "gitlab"
              ? "glpat-xxxxxxxxxxxx"
              : "Token"
          }
          className="w-full text-sm px-2 py-1 rounded outline-none"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-strong)",
          }}
        />
        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {provider === "github" && (
            <>Create at <span className="font-mono">github.com → Settings → Developer Settings → Personal Access Tokens</span>. Need <span className="font-mono">repo</span> scope.</>
          )}
          {provider === "gitlab" && (
            <>Create at <span className="font-mono">gitlab.com → Preferences → Access Tokens</span>. Need <span className="font-mono">read_repository</span> + <span className="font-mono">write_repository</span>.</>
          )}
          {provider === "custom" && (
            <>Enter the token for your self-hosted git server.</>
          )}
        </div>
      </div>

      <button
        className="flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors"
        style={{
          background: saved ? "#22C55E" : "var(--accent)",
          color: "var(--text-inverse)",
        }}
        onClick={handleSave}
        disabled={!host.trim() || !username.trim() || !token.trim() || saveMut.isPending}
      >
        {saveMut.isPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : saved ? (
          <>
            <CheckCircle size={14} />
            Saved
          </>
        ) : (
          <>
            <Shield size={14} />
            Save Credential
          </>
        )}
      </button>

      {saveMut.isError && (
        <div className="text-xs" style={{ color: "#EF4444" }}>
          {saveMut.error?.message}
        </div>
      )}
    </div>
  );
}

export function AuthSetup({ onDone }: { onDone?: () => void }) {
  const [tab, setTab] = useState<Tab>("ssh");
  const credentials = useCredentialInfo();

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6"
         style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-lg mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <Key size={24} style={{ color: "var(--accent)" }} />
          <div>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Authentication Setup
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Configure how git-started connects to your remotes
            </p>
          </div>
        </div>

        {/* Credential helper status */}
        {credentials.data?.configured && (
          <div className="flex items-center gap-2 px-3 py-2 rounded mb-4"
               style={{ background: "#22C55E15" }}>
            <CheckCircle size={14} style={{ color: "#22C55E" }} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Credential helper: <span className="font-mono font-medium">{credentials.data.helper}</span>
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg"
             style={{ background: "var(--bg-card)" }}>
          <button
            className="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              background: tab === "ssh" ? "var(--accent)" : "transparent",
              color: tab === "ssh" ? "var(--text-inverse)" : "var(--text-secondary)",
            }}
            onClick={() => setTab("ssh")}
          >
            SSH Key
          </button>
          <button
            className="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              background: tab === "pat" ? "var(--accent)" : "transparent",
              color: tab === "pat" ? "var(--text-inverse)" : "var(--text-secondary)",
            }}
            onClick={() => setTab("pat")}
          >
            Personal Access Token
          </button>
        </div>

        {/* Tab content */}
        <div className="px-4 py-4 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
          {tab === "ssh" ? <SshTab /> : <PatTab />}
        </div>

        {onDone && (
          <button
            className="mt-6 w-full px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            onClick={onDone}
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
