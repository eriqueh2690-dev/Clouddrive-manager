import React, { useState } from 'react';
import {
  Download,
  FolderSync,
  FileCheck2,
  HardDrive,
  Magnet,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  Info,
  Loader2,
  FileText,
  Globe,
  ListPlus,
  Upload,
  Sliders,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Zap,
} from 'lucide-react';
import { formatBytes } from '../utils/formatters.ts';
import {
  inspectTorrent,
  startTorrentTransfer,
  inspectHttpUrl,
  startUrlTransfer,
  startBatchTransfer,
  startLocalUpload,
  HttpInspectResult,
} from '../services/apiClient.ts';

interface Props {
  isAuthenticated: boolean;
  onLoginRequest: () => void;
  onTransferStarted: () => void;
}

const DEMO_DIRECT_LINKS = [
  {
    name: 'Ubuntu 24.04 Server ISO',
    size: '~2.6 GB',
    desc: 'Imagem oficial do Ubuntu Server para teste de alta velocidade',
    url: 'https://releases.ubuntu.com/24.04/ubuntu-24.04.1-live-server-amd64.iso',
  },
  {
    name: 'Big Buck Bunny (Video MP4)',
    size: '158 MB',
    desc: 'Arquivo de vídeo em MP4 direto do servidor de mídia aberto',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    name: 'Sample 50MB Test File',
    size: '50 MB',
    desc: 'Arquivo de teste rápido para validar upload ao Google Drive',
    url: 'https://speed.hetzner.de/100MB.bin',
  },
];

const DEMO_TORRENTS = [
  {
    name: 'Sintel - Blender Open Movie',
    size: '129.2 MB',
    desc: 'Filme livre 1080p em MP4, excelente para teste rápido',
    magnet:
      'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337',
  },
  {
    name: 'Tears of Steel (Blender 1080p)',
    size: '571.4 MB',
    desc: 'Ficção científica curta-metragem licenciada Creative Commons',
    magnet:
      'magnet:?xt=urn:btih:209c8226b299b308e24c4a0559f5762990203bc3&dn=Tears+of+Steel&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337',
  },
  {
    name: 'Big Buck Bunny (1080p MP4)',
    size: '276.1 MB',
    desc: 'Animação 3D clássica aberta da Fundação Blender',
    magnet:
      'magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337',
  },
];

type SourceMode = 'direct_url' | 'torrent' | 'batch' | 'local_upload';

export const NewTransferCard: React.FC<Props> = ({
  isAuthenticated,
  onLoginRequest,
  onTransferStarted,
}) => {
  const [sourceMode, setSourceMode] = useState<SourceMode>('direct_url');

  // Shared options
  const [folderName, setFolderName] = useState('Torrent to Google Drive');
  const [autoUpload, setAutoUpload] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Direct URL state
  const [directUrl, setDirectUrl] = useState('');
  const [customFileName, setCustomFileName] = useState('');
  const [isInspectingUrl, setIsInspectingUrl] = useState(false);
  const [urlInspectInfo, setUrlInspectInfo] = useState<HttpInspectResult | null>(null);
  const [showAdvancedHeaders, setShowAdvancedHeaders] = useState(false);
  const [customReferer, setCustomReferer] = useState('');
  const [customUserAgent, setCustomUserAgent] = useState('');

  // 2. Torrent state
  const [magnetInput, setMagnetInput] = useState('');
  const [torrentFile, setTorrentFile] = useState<File | null>(null);
  const [torrentBase64, setTorrentBase64] = useState<string | null>(null);
  const [isInspectingTorrent, setIsInspectingTorrent] = useState(false);
  const [torrentInspectData, setTorrentInspectData] = useState<{
    name: string;
    infoHash: string;
    totalBytes: number;
    files: Array<{ index: number; name: string; path: string; length: number }>;
  } | null>(null);
  const [selectedFileIndices, setSelectedFileIndices] = useState<number[]>([]);

  // 3. Batch URLs state
  const [batchUrlsInput, setBatchUrlsInput] = useState('');

  // 4. Local file upload state
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localFileBase64, setLocalFileBase64] = useState<string | null>(null);

  // Listen for native Android events (magnet links and .torrent files opened from outside)
  React.useEffect(() => {
    const handleNativeMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'NATIVE_MAGNET_RECEIVED' && event.data.magnet) {
        setMagnetInput(event.data.magnet);
        setSourceMode('torrent');
        setSuccessMsg('Link Magnet recebido diretamente do Android!');
      } else if (event.data.type === 'NATIVE_TORRENT_RECEIVED' && event.data.base64) {
        setTorrentBase64(event.data.base64);
        setSourceMode('torrent');
        setSuccessMsg('Arquivo .torrent recebido do Android!');
        inspectTorrent({ torrentBase64: event.data.base64 })
          .then((data) => {
            setTorrentInspectData(data);
            setSelectedFileIndices(data.files.map((f) => f.index));
          })
          .catch(() => {});
      }
    };

    window.addEventListener('message', handleNativeMessage);
    return () => window.removeEventListener('message', handleNativeMessage);
  }, []);

  // --- Handlers for Direct URL ---
  const handleInspectUrl = async () => {
    if (!directUrl.trim()) {
      setError('Por favor informe a URL para inspecionar');
      return;
    }
    setError(null);
    setIsInspectingUrl(true);
    try {
      const headers: Record<string, string> = {};
      if (customReferer.trim()) headers['Referer'] = customReferer.trim();
      if (customUserAgent.trim()) headers['User-Agent'] = customUserAgent.trim();

      const info = await inspectHttpUrl(directUrl.trim(), Object.keys(headers).length ? headers : undefined);
      setUrlInspectInfo(info);
      if (!customFileName && info.fileName) {
        setCustomFileName(info.fileName);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao inspecionar URL');
    } finally {
      setIsInspectingUrl(false);
    }
  };

  // --- Handlers for Torrent ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.torrent')) {
      setError('Por favor selecione um arquivo válido com extensão .torrent');
      return;
    }

    setTorrentFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setTorrentBase64(base64);
      try {
        setIsInspectingTorrent(true);
        const data = await inspectTorrent({ torrentBase64: base64 });
        setTorrentInspectData(data);
        setSelectedFileIndices(data.files.map((f) => f.index));
      } catch (err: any) {
        console.warn('Inspect failed:', err);
      } finally {
        setIsInspectingTorrent(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInspectTorrent = async () => {
    if (!magnetInput.trim() && !torrentBase64) {
      setError('Cole um link magnet ou envie um arquivo .torrent primeiro');
      return;
    }
    setError(null);
    setIsInspectingTorrent(true);

    try {
      const data = await inspectTorrent(
        torrentBase64 ? { torrentBase64 } : { magnet: magnetInput.trim() }
      );
      setTorrentInspectData(data);
      setSelectedFileIndices(data.files.map((f) => f.index));
    } catch (err: any) {
      setError(err.message || 'Falha ao analisar metadados do torrent');
    } finally {
      setIsInspectingTorrent(false);
    }
  };

  const handleToggleFile = (index: number) => {
    if (selectedFileIndices.includes(index)) {
      setSelectedFileIndices(selectedFileIndices.filter((i) => i !== index));
    } else {
      setSelectedFileIndices([...selectedFileIndices, index]);
    }
  };

  const handleSelectAllFiles = () => {
    if (!torrentInspectData) return;
    if (selectedFileIndices.length === torrentInspectData.files.length) {
      setSelectedFileIndices([]);
    } else {
      setSelectedFileIndices(torrentInspectData.files.map((f) => f.index));
    }
  };

  // --- Handlers for Local File ---
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setLocalFileBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // --- Submit Handler ---
  const handleSubmit = async () => {
    if (!isAuthenticated) {
      onLoginRequest();
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (sourceMode === 'direct_url') {
        if (!directUrl.trim()) {
          throw new Error('Informe uma URL de download HTTP/HTTPS válida');
        }

        const headers: Record<string, string> = {};
        if (customReferer.trim()) headers['Referer'] = customReferer.trim();
        if (customUserAgent.trim()) headers['User-Agent'] = customUserAgent.trim();

        await startUrlTransfer({
          url: directUrl.trim(),
          folderName: folderName.trim() || 'Torrent to Google Drive',
          fileName: customFileName.trim() || undefined,
          headers: Object.keys(headers).length ? headers : undefined,
          autoUpload,
        });

        setDirectUrl('');
        setCustomFileName('');
        setUrlInspectInfo(null);
      } else if (sourceMode === 'torrent') {
        if (!magnetInput.trim() && !torrentBase64) {
          throw new Error('Informe um link magnet ou selecione um arquivo .torrent');
        }

        await startTorrentTransfer({
          magnet: magnetInput.trim() || undefined,
          torrentBase64: torrentBase64 || undefined,
          folderName: folderName.trim() || 'Torrent to Google Drive',
          selectedFiles:
            torrentInspectData && selectedFileIndices.length > 0 ? selectedFileIndices : undefined,
          autoUpload,
        });

        setMagnetInput('');
        setTorrentFile(null);
        setTorrentBase64(null);
        setTorrentInspectData(null);
      } else if (sourceMode === 'batch') {
        const urls = batchUrlsInput
          .split('\n')
          .map((u) => u.trim())
          .filter((u) => u.length > 0);

        if (urls.length === 0) {
          throw new Error('Insira ao menos uma URL ou link magnet (um por linha)');
        }

        const res = await startBatchTransfer({
          urls,
          folderName: folderName.trim() || 'Torrent to Google Drive',
          autoUpload,
        });

        setBatchUrlsInput('');
        setSuccessMsg(`${res.count} download(s) adicionados à fila com sucesso!`);
      } else if (sourceMode === 'local_upload') {
        if (!localFile || !localFileBase64) {
          throw new Error('Selecione um arquivo do seu computador');
        }

        await startLocalUpload({
          fileName: localFile.name,
          fileBase64: localFileBase64,
          folderName: folderName.trim() || 'Torrent to Google Drive',
        });

        setLocalFile(null);
        setLocalFileBase64(null);
      }

      onTransferStarted();
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar transferência');
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedBatchUrls = batchUrlsInput
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  return (
    <div className="space-y-6">
      {/* Auth Banner if not signed in */}
      {!isAuthenticated && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg backdrop-blur-md">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                Conecte seu Google Drive para transferir
              </h3>
              <p className="text-sm text-slate-300 mt-0.5">
                O aplicativo baixa qualquer arquivo em alta velocidade e envia diretamente para o
                seu armazenamento em nuvem do Google Drive.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLoginRequest}
            className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm rounded-xl shadow-md transition-all shrink-0 cursor-pointer text-center"
          >
            Conectar Google Drive
          </button>
        </div>
      )}

      {/* Main Transfer Config Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800/80 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-cyan-500 text-white rounded-xl shadow-md shadow-blue-500/20">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Gerenciador de Downloads em Nuvem</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-medium">
                  Direto para o Drive
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Baixe Links Diretos (HTTP/HTTPS), Torrents (P2P), Lotes e envie arquivos locais
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 font-medium shrink-0">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Motor Turbo de Alta Velocidade + Stream Resumível</span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 p-1.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setSourceMode('direct_url');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              sourceMode === 'direct_url'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Link Direto URL</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSourceMode('torrent');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              sourceMode === 'torrent'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Magnet className="w-4 h-4 text-purple-400" />
            <span>Torrent & Magnet</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSourceMode('batch');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              sourceMode === 'batch'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <ListPlus className="w-4 h-4 text-amber-400" />
            <span>Download em Lote</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSourceMode('local_upload');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              sourceMode === 'local_upload'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Upload do PC</span>
          </button>
        </div>

        {/* Error or Success feedback */}
        {error && (
          <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <div className="flex-1">{successMsg}</div>
          </div>
        )}

        {/* MODE 1: DIRECT HTTP / HTTPS URL */}
        {sourceMode === 'direct_url' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  Link de Download Direto (HTTP / HTTPS)
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  ISOs, MP4, MKV, ZIP, TAR, RAR, PDF, etc.
                </span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={directUrl}
                  onChange={(e) => {
                    setDirectUrl(e.target.value);
                    setUrlInspectInfo(null);
                  }}
                  placeholder="https://exemplo.com/arquivo-grande.iso"
                  className="w-full bg-slate-950/70 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition-all font-mono"
                />
                {directUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setDirectUrl('');
                      setUrlInspectInfo(null);
                    }}
                    className="absolute top-2.5 right-3 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Inspect Button & Pre-flight Metadata */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleInspectUrl}
                disabled={isInspectingUrl || !directUrl.trim()}
                className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 px-3.5 py-2 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isInspectingUrl ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                ) : (
                  <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>{isInspectingUrl ? 'Analisando cabeçalhos...' : 'Inspecionar Link e Tamanho'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdvancedHeaders(!showAdvancedHeaders)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Cabeçalhos Avançados (Referer / User-Agent)</span>
                {showAdvancedHeaders ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>

            {/* URL Inspection Results Card */}
            {urlInspectInfo && (
              <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">{urlInspectInfo.fileName}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 font-mono">
                    <span>Tamanho: {formatBytes(urlInspectInfo.totalBytes)}</span>
                    <span>•</span>
                    <span>Tipo: {urlInspectInfo.contentType}</span>
                    {urlInspectInfo.acceptRanges && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400">Suporta Retomada (Range)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Headers inputs */}
            {showAdvancedHeaders && (
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3 animate-in fade-in">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Nome Personalizado do Arquivo (opcional)
                  </label>
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="meu-arquivo.iso"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 font-mono"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Referer HTTP (opcional)
                    </label>
                    <input
                      type="text"
                      value={customReferer}
                      onChange={(e) => setCustomReferer(e.target.value)}
                      placeholder="https://siteorigem.com"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      User-Agent personalizado (opcional)
                    </label>
                    <input
                      type="text"
                      value={customUserAgent}
                      onChange={(e) => setCustomUserAgent(e.target.value)}
                      placeholder="Mozilla/5.0..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sample direct links */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Exemplos Rápidos de Links Diretos
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DEMO_DIRECT_LINKS.map((demo) => (
                  <button
                    key={demo.name}
                    type="button"
                    onClick={() => {
                      setDirectUrl(demo.url);
                      setUrlInspectInfo(null);
                    }}
                    className="text-left p-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200 group-hover:text-cyan-400 truncate">
                        {demo.name}
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono shrink-0 ml-1">
                        {demo.size}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{demo.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: TORRENT & MAGNET */}
        {sourceMode === 'torrent' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Magnet input */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Magnet className="w-4 h-4 text-purple-400" />
                  Link Magnet
                </span>
                <span className="text-xs text-slate-400 font-normal">Ex: magnet:?xt=urn:btih:...</span>
              </label>
              <div className="relative">
                <textarea
                  value={magnetInput}
                  onChange={(e) => {
                    setMagnetInput(e.target.value);
                    setTorrentFile(null);
                    setTorrentBase64(null);
                  }}
                  rows={3}
                  placeholder="Cole seu link magnet aqui..."
                  className="w-full bg-slate-950/70 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition-all font-mono resize-none"
                />
                {magnetInput && (
                  <button
                    type="button"
                    onClick={() => setMagnetInput('')}
                    className="absolute top-3 right-3 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                OU ARQUIVO .TORRENT
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* .torrent File Upload */}
            <div>
              <label className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-800 hover:border-purple-500/50 bg-slate-950/40 hover:bg-slate-950/70 rounded-xl cursor-pointer transition-all group">
                <input
                  type="file"
                  accept=".torrent"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
                <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-purple-400 transition-colors mb-2" />
                <div className="text-center">
                  {torrentFile ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
                      <FileCheck2 className="w-4 h-4" />
                      {torrentFile.name} ({formatBytes(torrentFile.size)})
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                        Clique para selecionar ou arraste o arquivo .torrent
                      </span>
                      <p className="text-xs text-slate-500 mt-1">Arquivos locais .torrent</p>
                    </>
                  )}
                </div>
              </label>
            </div>

            {/* Inspect Button */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleInspectTorrent}
                disabled={isInspectingTorrent || (!magnetInput.trim() && !torrentBase64)}
                className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 px-3.5 py-2 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isInspectingTorrent ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Info className="w-3.5 h-3.5 text-purple-400" />
                )}
                {isInspectingTorrent ? 'Analisando metadados...' : 'Pré-visualizar Arquivos do Torrent'}
              </button>
            </div>

            {/* Torrent Inspected files */}
            {torrentInspectData && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{torrentInspectData.name}</h4>
                    <p className="text-xs text-slate-400">
                      Tamanho total: {formatBytes(torrentInspectData.totalBytes)} •{' '}
                      {torrentInspectData.files.length} arquivo(s)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllFiles}
                    className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer font-medium"
                  >
                    {selectedFileIndices.length === torrentInspectData.files.length
                      ? 'Desmarcar todos'
                      : 'Marcar todos'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {torrentInspectData.files.map((file) => {
                    const isChecked = selectedFileIndices.includes(file.index);
                    return (
                      <label
                        key={file.index}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900/80 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFile(file.index)}
                            className="w-3.5 h-3.5 text-blue-600 rounded bg-slate-800 border-slate-700"
                          />
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span
                            className={`truncate ${
                              isChecked ? 'text-slate-200' : 'text-slate-500 line-through'
                            }`}
                          >
                            {file.name}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono shrink-0">
                          {formatBytes(file.length)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick legal torrent samples */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Exemplos Rápidos de Torrents
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DEMO_TORRENTS.map((demo) => (
                  <button
                    key={demo.name}
                    type="button"
                    onClick={() => {
                      setMagnetInput(demo.magnet);
                      setTorrentFile(null);
                      setTorrentBase64(null);
                      setTorrentInspectData(null);
                    }}
                    className="text-left p-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200 group-hover:text-purple-400 truncate">
                        {demo.name}
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono shrink-0 ml-1">
                        {demo.size}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{demo.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODE 3: BATCH DOWNLOADS */}
        {sourceMode === 'batch' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ListPlus className="w-4 h-4 text-amber-400" />
                  Links em Lote (URLs HTTP/HTTPS ou Magnets)
                </span>
                <span className="text-xs text-amber-400 font-mono font-medium">
                  {parsedBatchUrls.length} link(s) detectado(s)
                </span>
              </label>
              <textarea
                value={batchUrlsInput}
                onChange={(e) => setBatchUrlsInput(e.target.value)}
                rows={5}
                placeholder="Insira uma URL por linha:&#10;https://exemplo.com/arquivo1.zip&#10;https://exemplo.com/arquivo2.mp4&#10;magnet:?xt=urn:btih:..."
                className="w-full bg-slate-950/70 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 transition-all font-mono resize-none"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Cole múltiplos links de uma vez. Todos serão enfileirados e baixados automaticamente
                para o Google Drive.
              </p>
            </div>
          </div>
        )}

        {/* MODE 4: LOCAL FILE UPLOAD */}
        {sourceMode === 'local_upload' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  Enviar Arquivo do Computador para o Google Drive
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  Upload resumível em blocos de alta velocidade
                </span>
              </label>
              <label className="relative flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-950/40 hover:bg-slate-950/70 rounded-xl cursor-pointer transition-all group">
                <input type="file" onChange={handleLocalFileSelect} className="sr-only" />
                <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-emerald-400 transition-colors mb-2" />
                <div className="text-center">
                  {localFile ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
                      <FileCheck2 className="w-5 h-5" />
                      {localFile.name} ({formatBytes(localFile.size)})
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                        Clique para selecionar ou arraste qualquer arquivo local
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        Vídeos, fotos, documentos, zips e executáveis
                      </p>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* SHARED DESTINATION & AUTO-UPLOAD OPTIONS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t border-slate-800/80">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Pasta de Destino no Google Drive
            </label>
            <div className="flex items-center bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5">
              <HardDrive className="w-4 h-4 text-blue-400 mr-2.5 shrink-0" />
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Torrent to Google Drive"
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Criada automaticamente no seu Drive se não existir.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Opção de Upload
            </label>
            <label className="flex items-center gap-3 p-2.5 bg-slate-950/40 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-950/80 transition-colors">
              <input
                type="checkbox"
                checked={autoUpload}
                onChange={(e) => setAutoUpload(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded bg-slate-800 border-slate-700 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-300">
                Fazer upload automático para o Drive assim que terminar download
              </span>
            </label>
          </div>
        </div>

        {/* ACTION SUBMIT BUTTON */}
        <div className="pt-5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (sourceMode === 'direct_url' && !directUrl.trim()) ||
              (sourceMode === 'torrent' && !magnetInput.trim() && !torrentBase64) ||
              (sourceMode === 'batch' && parsedBatchUrls.length === 0) ||
              (sourceMode === 'local_upload' && !localFile)
            }
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-900/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-base"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processando Transferência para o Google Drive...</span>
              </>
            ) : sourceMode === 'direct_url' ? (
              <>
                <Download className="w-5 h-5" />
                <span>Iniciar Download Direto para o Google Drive</span>
              </>
            ) : sourceMode === 'torrent' ? (
              <>
                <Download className="w-5 h-5" />
                <span>Iniciar Transferência Torrent para o Google Drive</span>
              </>
            ) : sourceMode === 'batch' ? (
              <>
                <ListPlus className="w-5 h-5" />
                <span>Iniciar {parsedBatchUrls.length} Downloads em Lote</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Enviar Arquivo para o Google Drive</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
