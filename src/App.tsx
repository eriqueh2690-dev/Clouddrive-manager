import { FormEvent, useMemo, useRef, useState, useEffect } from "react";
import { User } from "firebase/auth";
import { initAuth, googleSignIn, logout } from "./services/auth.ts";
import {
  fetchTransferList,
  fetchDriveQuota,
  inspectHttpUrl,
  startUrlTransfer,
  startBatchTransfer,
  startLocalUpload,
  pauseTransfer,
  resumeTransfer,
  cancelTransfer,
  TransferJobData,
  DriveQuotaData,
} from "./services/apiClient.ts";
import { formatBytes, formatSpeed } from "./utils/formatters.ts";

type IconName =
  | "archive"
  | "arrow-up"
  | "batch"
  | "check"
  | "chevron"
  | "cloud"
  | "copy"
  | "dashboard"
  | "drive"
  | "external"
  | "file"
  | "folder"
  | "folder-plus"
  | "hard-drive"
  | "link"
  | "more"
  | "pause"
  | "play"
  | "plus"
  | "search"
  | "settings"
  | "speed"
  | "torrent"
  | "trash"
  | "upload"
  | "user";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    archive: <><rect x="3" y="4" width="18" height="5" rx="2" /><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" /></>,
    "arrow-up": <><path d="m18 15-6-6-6 6" /><path d="M12 9v11" /></>,
    batch: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    cloud: <path d="M17.5 19H7a5 5 0 1 1 1.2-9.85A7 7 0 0 1 21 13a6 6 0 0 1-3.5 6Z" />,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    drive: <><path d="m9 4-6 10 3.5 6h11L21 14 15 4Z" /><path d="m9 4 6 10M3 14h18M6.5 20l6-10" /></>,
    external: <><path d="M15 3h6v6M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    "folder-plus": <><path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M12 11v6M9 14h6" /></>,
    "hard-drive": <><path d="M4 14 6.5 5h11L20 14" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 17h.01M11 17h.01" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    pause: <><path d="M9 4v16M15 4v16" /></>,
    play: <path d="m7 4 13 8-13 8Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88L4.2 6.56l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.4.25.75.6 1 1 .18.3.3.7.3 1.1v.1" /></>,
    speed: <><path d="M4.9 19a9 9 0 1 1 14.2 0" /><path d="m12 13 4-4" /><circle cx="12" cy="13" r="2" /></>,
    torrent: <><circle cx="12" cy="12" r="9" /><path d="M8 9h8M10 9v4a2 2 0 0 0 4 0V9M12 15v3" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M20 15v5H4v-5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

type TransferStatus = "Baixando" | "Enviando ao Drive" | "Concluído" | "Pausado";

type Transfer = {
  id: string | number;
  name: string;
  kind: "archive" | "file";
  status: TransferStatus;
  progress: number;
  size: string;
  transferred: string;
  speed?: string;
  eta?: string;
  color: string;
  driveLink?: string;
};

const initialTransfers: Transfer[] = [
  { id: 1, name: "ubuntu-24.04.2-desktop-amd64.iso", kind: "file", status: "Baixando", progress: 68, size: "5,9 GB", transferred: "4,0 GB", speed: "12,4 MB/s", eta: "2 min 31 s", color: "blue" },
  { id: 2, name: "arquivos-do-projeto.zip", kind: "archive", status: "Enviando ao Drive", progress: 91, size: "2,1 GB", transferred: "1,9 GB", speed: "6,1 MB/s", eta: "34 s", color: "violet" },
  { id: 3, name: "curso-design-de-produto.mp4", kind: "file", status: "Concluído", progress: 100, size: "1,4 GB", transferred: "1,4 GB", color: "green", driveLink: "https://drive.google.com" },
  { id: 4, name: "backup-fotos-2024.tar.gz", kind: "archive", status: "Pausado", progress: 34, size: "8,7 GB", transferred: "3,0 GB", color: "amber" },
];

const driveFiles = [
  { name: "curso-design-de-produto.mp4", size: "1,4 GB", date: "Hoje, 14:32", type: "Vídeo" },
  { name: "brand-assets-final.zip", size: "842 MB", date: "Ontem, 18:08", type: "Arquivo ZIP" },
  { name: "documentario-4k.mp4", size: "7,2 GB", date: "12 jun, 09:41", type: "Vídeo" },
  { name: "linux-mint-22.iso", size: "2,7 GB", date: "10 jun, 22:17", type: "Imagem de disco" },
];

const modes = [
  { id: "link", label: "Link direto", icon: "link" as IconName },
  { id: "torrent", label: "Torrent", icon: "torrent" as IconName },
  { id: "batch", label: "Em lote", icon: "batch" as IconName },
  { id: "upload", label: "Dispositivo", icon: "upload" as IconName },
];

export default function App() {
  const [activePage, setActivePage] = useState<"dashboard" | "add" | "drive">("add");
  const [mode, setMode] = useState("link");
  const [filter, setFilter] = useState("Todos");
  const [transfers, setTransfers] = useState<Transfer[]>(initialTransfers);
  const [url, setUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [folder, setFolder] = useState("Torrent to Google Drive");
  const [notice, setNotice] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auth & Quota state
  const [user, setUser] = useState<User | null>(null);
  const [, setToken] = useState<string | null>(null);
  const [quota, setQuota] = useState<DriveQuotaData | null>(null);

  useEffect(() => {
    // Inicializa autenticação Google Firebase
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        fetchDriveQuota().then((q) => setQuota(q)).catch(() => {});
      },
      () => {
        setUser(null);
        setToken(null);
        setQuota(null);
      }
    );

    // Polling de transferências reais do backend
    const pollJobs = async () => {
      try {
        const liveJobs = await fetchTransferList();
        if (liveJobs && liveJobs.length > 0) {
          const mapped: Transfer[] = liveJobs.map((j: TransferJobData) => {
            let statusLabel: TransferStatus = "Baixando";
            let color = "blue";
            if (j.status === "completed") {
              statusLabel = "Concluído";
              color = "green";
            } else if (j.status === "paused") {
              statusLabel = "Pausado";
              color = "amber";
            } else if (j.status === "uploading_to_drive") {
              statusLabel = "Enviando ao Drive";
              color = "violet";
            }
            return {
              id: j.id,
              name: j.name,
              kind: j.name.endsWith(".zip") || j.name.endsWith(".tar.gz") ? "archive" : "file",
              status: statusLabel,
              progress: Math.round(j.progress),
              size: formatBytes(j.totalBytes),
              transferred: formatBytes(j.downloadedBytes),
              speed: j.downloadSpeed > 0 ? formatSpeed(j.downloadSpeed) : undefined,
              eta: j.etaSeconds ? `${Math.round(j.etaSeconds)}s` : undefined,
              color,
              driveLink: j.driveFiles?.[0]?.webViewLink,
            };
          });
          setTransfers(mapped);
        }
      } catch {
        // Modo offline / preview
      }
    };

    pollJobs();
    const interval = setInterval(pollJobs, 2500);

    // Ouvinte nativo Android (caso receba magnet ou torrent via Intent)
    const handleNativeIntent = (e: any) => {
      if (e.detail?.magnet) {
        setUrl(e.detail.magnet);
        setMode("torrent");
        setActivePage("add");
      }
    };
    window.addEventListener("NATIVE_MAGNET_RECEIVED" as any, handleNativeIntent);

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
      window.removeEventListener("NATIVE_MAGNET_RECEIVED" as any, handleNativeIntent);
    };
  }, []);

  const handleAuthClick = async () => {
    if (user) {
      await logout();
      setUser(null);
      setQuota(null);
    } else {
      try {
        const res = await googleSignIn();
        if (res) {
          setUser(res.user);
          setToken(res.accessToken);
          fetchDriveQuota().then((q) => setQuota(q)).catch(() => {});
        }
      } catch (err) {
        console.error("Login failed:", err);
      }
    }
  };

  const visibleTransfers = useMemo(() => {
    if (filter === "Ativos") return transfers.filter((item) => item.status !== "Concluído");
    if (filter === "Concluídos") return transfers.filter((item) => item.status === "Concluído");
    return transfers;
  }, [filter, transfers]);

  const activeCount = transfers.filter((t) => t.status === "Baixando" || t.status === "Enviando ao Drive").length;

  const totalSpeed = useMemo(() => {
    const hasActive = transfers.some((t) => t.status === "Baixando");
    return hasActive ? "18,5 MB/s" : "0,0 MB/s";
  }, [transfers]);

  const toggleTransfer = async (id: string | number) => {
    const current = transfers.find((item) => item.id === id);
    if (!current) return;
    const isPaused = current.status === "Pausado";
    try {
      if (isPaused) {
        await resumeTransfer(String(id));
      } else {
        await pauseTransfer(String(id));
      }
    } catch {
      // Optimistic update
    }
    setTransfers((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, status: isPaused ? "Baixando" : "Pausado" }
          : item
      )
    );
  };

  const removeTransfer = async (id: string | number) => {
    try {
      await cancelTransfer(String(id));
    } catch {
      // Optimistic update
    }
    setTransfers((items) => items.filter((item) => item.id !== id));
  };

  const handleInspect = async () => {
    if (!url) {
      setNotice("Insira um link para inspecionar.");
      return;
    }
    setNotice("Inspecionando arquivo...");
    try {
      const res = await inspectHttpUrl(url);
      setNotice(`Arquivo: ${res.fileName} (${formatBytes(res.contentLength)})`);
    } catch {
      setNotice("Não foi possível obter os cabeçalhos do link.");
    }
  };

  const addTransfer = async (event: FormEvent) => {
    event.preventDefault();
    const source = mode === "batch" ? batchUrls.split("\n").filter(Boolean)[0] : url;
    if ((!source && mode !== "upload") || (mode === "upload" && selectedFiles.length === 0)) {
      setNotice("Adicione um link válido para continuar.");
      return;
    }
    setNotice("Iniciando transferência para o Google Drive...");
    let apiSuccess = false;

    try {
      if (mode === "upload") {
        for (const file of selectedFiles) {
          await startLocalUpload(file, folder);
        }
        apiSuccess = true;
      } else if (mode === "batch") {
        const urls = batchUrls.split("\n").map((u) => u.trim()).filter(Boolean);
        await startBatchTransfer(urls, folder);
        apiSuccess = true;
      } else {
        await startUrlTransfer(url, folder);
        apiSuccess = true;
      }
    } catch {
      apiSuccess = false;
    }

    const name =
      selectedFiles[0]?.name ||
      source?.split("/").pop()?.split("?")[0] ||
      "novo-arquivo.zip";

    setTransfers((items) => [
      {
        id: Date.now(),
        name,
        kind: "archive",
        status: "Baixando",
        progress: 4,
        size: "Calculando...",
        transferred: "0 MB",
        speed: "Iniciando",
        eta: "—",
        color: "blue",
      },
      ...items,
    ]);

    setUrl("");
    setBatchUrls("");
    setSelectedFiles([]);
    setNotice(
      apiSuccess
        ? "Transferência adicionada ao Google Drive!"
        : "Adicionada à lista localmente."
    );
    setTimeout(() => setActivePage("dashboard"), 900);
  };

  const storagePercent = quota && quota.limit > 0 ? Math.round((quota.usage / quota.limit) * 100) : 45;
  const storageLabel = quota ? `${formatBytes(quota.usage)} de ${formatBytes(quota.limit)} usados` : "45 GB de 100 GB usados";

  return (
    <div className="app-shell">
      {/* Sidebar Desktop */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Icon name="cloud" size={22} /></div>
          <span>CloudDrive</span>
        </div>

        <nav className="main-nav" aria-label="Navegação principal">
          <span className="nav-label">Workspace</span>
          <button className={`nav-item ${activePage === "dashboard" ? "active" : ""}`} onClick={() => setActivePage("dashboard")}>
            <Icon name="dashboard" /> Visão geral
          </button>
          <button className={`nav-item ${activePage === "add" ? "active" : ""}`} onClick={() => setActivePage("add")}>
            <Icon name="plus" /> Nova transferência
          </button>
          <button className={`nav-item ${activePage === "drive" ? "active" : ""}`} onClick={() => setActivePage("drive")}>
            <Icon name="drive" /> Meu Google Drive
          </button>
          <button className="nav-item" onClick={() => setActivePage("dashboard")}>
            <Icon name="hard-drive" /> Histórico
          </button>
          <span className="nav-label secondary">Gerenciar</span>
          <button className="nav-item" onClick={() => handleAuthClick()}>
            <Icon name="settings" /> {user ? "Desconectar Conta" : "Configurações"}
          </button>
        </nav>

        <div className="sidebar-storage">
          <div className="storage-title">
            <span><Icon name="drive" size={17} /> Armazenamento</span>
            <b>{storagePercent}%</b>
          </div>
          <div className="storage-track"><span style={{ width: `${storagePercent}%` }} /></div>
          <p>{storageLabel}</p>
          <button className="manage-link" onClick={() => setActivePage("drive")}>
            Gerenciar armazenamento <Icon name="chevron" size={14} />
          </button>
        </div>

        <div className="profile">
          <div className="avatar">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="User" style={{ width: "100%", height: "100%", borderRadius: "inherit" }} />
            ) : (
              user?.displayName?.substring(0, 2).toUpperCase() || "AM"
            )}
          </div>
          <div>
            <strong>{user?.displayName || "André Martins"}</strong>
            <span>{user?.email || "andre@gmail.com"}</span>
          </div>
          <button className="icon-button" aria-label="Mais opções" onClick={handleAuthClick}>
            <Icon name="more" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main">
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark"><Icon name="cloud" size={20} /></div>
            <span>CloudDrive</span>
          </div>
          <div className="speed-pill">
            <span className="live-dot" />
            <Icon name="speed" size={18} />
            <div><small>Velocidade total</small><strong>{totalSpeed}</strong></div>
          </div>
          <button className="google-button" onClick={handleAuthClick}>
            <Icon name="drive" size={18} />
            {user ? "Drive conectado" : "Conectar Google Drive"}
            <Icon name="chevron" size={14} />
          </button>
        </header>

        {activePage !== "drive" ? (
          <div className={`content ${activePage === "add" ? "add-page" : ""}`}>
            {activePage === "dashboard" && (
              <section className="page-heading">
                <div>
                  <span className="eyebrow">PAINEL DE CONTROLE</span>
                  <h1>Olá, {user?.displayName?.split(" ")[0] || "André"}</h1>
                  <p>Envie qualquer arquivo da internet direto para o seu Drive.</p>
                </div>
                <div className="summary">
                  <div><span>{activeCount}</span><p>Em andamento</p></div>
                  <i />
                  <div><span>{totalSpeed.replace(" MB/s", "")} <small>MB/s</small></span><p>Velocidade atual</p></div>
                </div>
              </section>
            )}

            {activePage === "add" && (
              <section className="new-transfer-card">
                <div className="card-heading">
                  <div className="heading-icon"><Icon name="plus" /></div>
                  <div><h2>Nova transferência</h2><p>Escolha como deseja adicionar seus arquivos</p></div>
                </div>

                <div className="mode-tabs">
                  {modes.map((item) => (
                    <button key={item.id} className={mode === item.id ? "active" : ""} onClick={() => { setMode(item.id); setNotice(""); }}>
                      <Icon name={item.icon} size={18} /> {item.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={addTransfer}>
                  <div className="transfer-form">
                    {mode === "link" && (
                      <div className="input-group">
                        <label htmlFor="url">URL do arquivo</label>
                        <div className="input-with-icon">
                          <Icon name="link" size={18} />
                          <input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole aqui o link HTTP ou HTTPS..." />
                        </div>
                        <small>Links diretos para arquivos .zip, .iso, vídeos e outros formatos.</small>
                      </div>
                    )}
                    {mode === "torrent" && (
                      <div className="input-group">
                        <label htmlFor="magnet">Magnet link ou arquivo .torrent</label>
                        <div className="input-with-icon">
                          <Icon name="torrent" size={18} />
                          <input id="magnet" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="magnet:?xt=urn:btih:..." />
                        </div>
                        <small>Ou arraste um arquivo .torrent para esta área.</small>
                      </div>
                    )}
                    {mode === "batch" && (
                      <div className="input-group">
                        <label htmlFor="batch">Lista de URLs</label>
                        <textarea id="batch" value={batchUrls} onChange={(e) => setBatchUrls(e.target.value)} placeholder={"https://exemplo.com/arquivo-01.zip\nhttps://exemplo.com/arquivo-02.mp4"} />
                        <small>Adicione uma URL por linha.</small>
                      </div>
                    )}
                    {mode === "upload" && (
                      <button type="button" className="dropzone" onClick={() => fileRef.current?.click()}>
                        <input ref={fileRef} type="file" multiple hidden onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setSelectedFiles(files);
                          setNotice(`${files.length} arquivo(s) selecionado(s).`);
                        }} />
                        <span><Icon name="upload" /></span>
                        <strong>Selecione arquivos do dispositivo</strong>
                        <small>ou arraste e solte aqui</small>
                      </button>
                    )}
                    <div className="input-group folder-field">
                      <label htmlFor="folder">Pasta de destino</label>
                      <div className="input-with-icon">
                        <Icon name="folder" size={18} />
                        <input id="folder" value={folder} onChange={(e) => setFolder(e.target.value)} />
                      </div>
                      <small><Icon name="drive" size={13} /> Google Drive</small>
                    </div>
                  </div>
                  <div className="form-footer">
                    <span className={notice ? "notice visible" : "notice"}>{notice}</span>
                    <div>
                      {mode === "link" && (
                        <button type="button" className="secondary-button" onClick={handleInspect}>
                          <Icon name="search" size={17} /> Inspecionar
                        </button>
                      )}
                      <button type="submit" className="primary-button">
                        <Icon name="arrow-up" size={17} /> Iniciar transferência
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {activePage === "dashboard" && (
              <section className="transfers-section">
                <div className="section-heading">
                  <div><h2>Transferências</h2><span>{transfers.length} arquivos</span></div>
                  <div className="filters">
                    {["Todos", "Ativos", "Concluídos"].map((item) => (
                      <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="transfer-list">
                  {visibleTransfers.map((transfer) => (
                    <article className="transfer-row" key={transfer.id}>
                      <div className={`file-icon ${transfer.color}`}><Icon name={transfer.kind} /></div>
                      <div className="transfer-info">
                        <div className="transfer-name">
                          <strong>{transfer.name}</strong>
                          <span className={`status ${transfer.status.toLowerCase().replaceAll(" ", "-")}`}>
                            {transfer.status === "Baixando" && <i />}
                            {transfer.status === "Concluído" && <Icon name="check" size={12} />}
                            {transfer.status}
                          </span>
                        </div>
                        <div className="progress-track"><span style={{ width: `${transfer.progress}%` }} /></div>
                        <div className="transfer-meta">
                          <span>{transfer.transferred} de {transfer.size}</span>
                          <span>{transfer.progress}%</span>
                          {transfer.speed && <span>{transfer.speed}</span>}
                          {transfer.eta && <span>Restam {transfer.eta}</span>}
                        </div>
                      </div>
                      <div className="row-actions">
                        {transfer.status === "Concluído" ? (
                          <a href={transfer.driveLink || "https://drive.google.com"} target="_blank" rel="noreferrer" className="drive-link" style={{ textDecoration: "none" }}>
                            <Icon name="external" size={15} /> Abrir no Drive
                          </a>
                        ) : (
                          <button className="action-button" aria-label={transfer.status === "Pausado" ? "Retomar" : "Pausar"} onClick={() => toggleTransfer(transfer.id)}>
                            <Icon name={transfer.status === "Pausado" ? "play" : "pause"} size={17} />
                          </button>
                        )}
                        <button className="action-button danger" aria-label="Excluir" onClick={() => removeTransfer(transfer.id)}>
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                    </article>
                  ))}
                  {visibleTransfers.length === 0 && (
                    <div className="empty-state">
                      <Icon name="check" />
                      <strong>Nenhuma transferência nesta categoria</strong>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="content drive-page">
            <section className="page-heading">
              <div>
                <span className="eyebrow">ARQUIVOS NA NUVEM</span>
                <h1>Meu Google Drive</h1>
                <p>Arquivos enviados pelo CloudDrive Manager.</p>
              </div>
              <button className="primary-button" onClick={() => setActivePage("add")}>
                <Icon name="folder-plus" size={18} /> Nova pasta
              </button>
            </section>
            <div className="drive-toolbar">
              <div className="search-field">
                <Icon name="search" size={18} />
                <input placeholder="Buscar arquivos no Drive..." />
              </div>
              <button className="secondary-button">Mais recentes <Icon name="chevron" size={14} /></button>
            </div>
            <section className="drive-grid">
              {driveFiles.map((file) => (
                <article className="drive-file" key={file.name}>
                  <div className="drive-file-top">
                    <span><Icon name={file.type === "Arquivo ZIP" ? "archive" : "file"} /></span>
                    <button className="icon-button"><Icon name="more" /></button>
                  </div>
                  <strong>{file.name}</strong>
                  <p>{file.type}</p>
                  <div><span>{file.size}</span><span>{file.date}</span></div>
                </article>
              ))}
            </section>
          </div>
        )}
      </main>

      {/* Bottom Navigation for Mobile / Android */}
      <nav className="bottom-nav" aria-label="Navegação do aplicativo">
        <button className={activePage === "dashboard" ? "active" : ""} onClick={() => setActivePage("dashboard")}>
          <span><Icon name="dashboard" size={20} /></span>
          Início
        </button>
        <button
          className={activePage === "add" ? "active add-active" : ""}
          onClick={() => {
            setActivePage("add");
            setMode("link");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className="bottom-add"><Icon name="plus" size={22} /></span>
          Adicionar
        </button>
        <button className={activePage === "drive" ? "active" : ""} onClick={() => setActivePage("drive")}>
          <span><Icon name="drive" size={20} /></span>
          Arquivos
        </button>
      </nav>
    </div>
  );
}
