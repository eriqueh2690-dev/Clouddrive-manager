import React, { useState } from 'react';
import {
  TransferJobData,
  pauseTorrent,
  resumeTorrent,
  cancelTorrent,
  uploadTorrentToDrive,
} from '../services/apiClient.ts';
import { formatBytes, formatSpeed, formatEta } from '../utils/formatters.ts';
import {
  DownloadCloud,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Users,
  Clock,
  HardDrive,
  RefreshCw,
  Globe,
  Magnet,
  Upload,
  Search,
  Filter,
} from 'lucide-react';

interface Props {
  jobs: TransferJobData[];
  onRefresh: () => void;
  onGoToNewTransfer: () => void;
}

type FilterType = 'all' | 'active' | 'completed' | 'direct_url' | 'torrent' | 'local_upload';

export const TransfersList: React.FC<Props> = ({ jobs, onRefresh, onGoToNewTransfer }) => {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedJobId(expandedJobId === id ? null : id);
  };

  const handlePause = async (id: string) => {
    setActionLoadingId(id);
    try {
      await pauseTorrent(id);
      onRefresh();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoadingId(id);
    try {
      await resumeTorrent(id);
      onRefresh();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Deseja realmente cancelar e remover esta transferência?')) return;
    setActionLoadingId(id);
    try {
      await cancelTorrent(id);
      onRefresh();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUploadToDrive = async (id: string) => {
    setActionLoadingId(id);
    try {
      await uploadTorrentToDrive(id);
      onRefresh();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter and search
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      !searchQuery.trim() || job.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    if (filter === 'active') {
      return (
        job.status === 'downloading' ||
        job.status === 'uploading_to_drive' ||
        job.status === 'fetching_metadata'
      );
    }
    if (filter === 'completed') return job.status === 'completed';
    if (filter === 'direct_url') return job.type === 'direct_url';
    if (filter === 'torrent') return job.type === 'torrent' || !job.type;
    if (filter === 'local_upload') return job.type === 'local_upload';
    return true;
  });

  if (jobs.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center shadow-xl backdrop-blur-md">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-800/80 text-blue-400 rounded-2xl flex items-center justify-center">
          <DownloadCloud className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-white">Nenhuma transferência em andamento</h3>
        <p className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
          Adicione um link direto (HTTP/HTTPS), link magnet ou arquivo local para iniciar o download
          e salvamento direto no seu Google Drive.
        </p>
        <button
          type="button"
          onClick={onGoToNewTransfer}
          className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
        >
          Iniciar Novo Download
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Count */}
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">Fila de Transferências</h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
              {filteredJobs.length} de {jobs.length}
            </span>
          </div>

          {/* Search Input & Refresh Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nome..."
                className="w-full bg-slate-950/70 border border-slate-800 focus:border-blue-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden"
              />
            </div>

            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
          </span>

          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({jobs.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('active')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filter === 'active'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Ativos (
            {
              jobs.filter(
                (j) =>
                  j.status === 'downloading' ||
                  j.status === 'uploading_to_drive' ||
                  j.status === 'fetching_metadata'
              ).length
            }
            )
          </button>

          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filter === 'completed'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Salvos no Drive ({jobs.filter((j) => j.status === 'completed').length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('direct_url')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filter === 'direct_url'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Links Diretos ({jobs.filter((j) => j.type === 'direct_url').length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('torrent')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filter === 'torrent'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Torrents ({jobs.filter((j) => j.type === 'torrent' || !j.type).length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('local_upload')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filter === 'local_upload'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Uploads ({jobs.filter((j) => j.type === 'local_upload').length})
          </button>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-4">
        {filteredJobs.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
            Nenhuma transferência corresponde ao filtro selecionado.
          </div>
        ) : (
          filteredJobs.map((job) => {
            const isExpanded = expandedJobId === job.id;
            const isCompleted = job.status === 'completed';
            const isDownloading = job.status === 'downloading';
            const isUploading = job.status === 'uploading_to_drive';
            const isPaused = job.status === 'paused';
            const isError = job.status === 'error';
            const isFetching =
              job.status === 'fetching_metadata' || job.status === 'initializing';

            return (
              <div
                key={job.id}
                className={`bg-slate-900/90 border rounded-2xl overflow-hidden shadow-xl transition-all duration-200 ${
                  isCompleted
                    ? 'border-emerald-500/30'
                    : isUploading
                    ? 'border-blue-500/40 shadow-blue-950/20'
                    : isError
                    ? 'border-red-500/30'
                    : 'border-slate-800'
                }`}
              >
                {/* Header card */}
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {/* Type Badge */}
                        {job.type === 'direct_url' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                            <Globe className="w-3 h-3" />
                            Link Direto URL
                          </span>
                        )}
                        {(job.type === 'torrent' || !job.type) && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                            <Magnet className="w-3 h-3" />
                            Torrent P2P
                          </span>
                        )}
                        {job.type === 'local_upload' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <Upload className="w-3 h-3" />
                            Upload Local
                          </span>
                        )}

                        {/* Status Badges */}
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Salvo no Google Drive
                          </span>
                        )}
                        {isUploading && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
                            <UploadCloud className="w-3.5 h-3.5" />
                            Enviando ao Drive ({Math.round(job.driveUploadProgress * 100)}%)
                          </span>
                        )}
                        {isDownloading && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            <DownloadCloud className="w-3.5 h-3.5" />
                            Baixando ({Math.round(job.progress * 100)}%)
                          </span>
                        )}
                        {job.engineType === 'aria2_turbo' && !isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            ⚡ Turbo C++
                          </span>
                        )}
                        {isFetching && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Conectando...
                          </span>
                        )}
                        {isPaused && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300">
                            <Pause className="w-3.5 h-3.5" />
                            Pausado
                          </span>
                        )}
                        {isError && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Falha
                          </span>
                        )}

                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <HardDrive className="w-3 h-3 text-slate-500" />
                          Pasta: {job.destinationFolder}
                        </span>
                      </div>

                      <h3
                        className="text-base font-semibold text-white truncate max-w-xl"
                        title={job.name}
                      >
                        {job.name}
                      </h3>
                    </div>

                    {/* Quick Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isDownloading && (
                        <button
                          type="button"
                          onClick={() => handlePause(job.id)}
                          disabled={actionLoadingId === job.id}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Pausar download"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}

                      {isPaused && (
                        <button
                          type="button"
                          onClick={() => handleResume(job.id)}
                          disabled={actionLoadingId === job.id}
                          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                          title="Continuar download"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}

                      {!isCompleted && !isUploading && job.progress >= 1 && (
                        <button
                          type="button"
                          onClick={() => handleUploadToDrive(job.id)}
                          disabled={actionLoadingId === job.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          Transferir p/ Drive
                        </button>
                      )}

                      {job.driveFiles && job.driveFiles.length > 0 && job.driveFiles[0].webViewLink && (
                        <a
                          href={job.driveFiles[0].webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ver no Drive
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCancel(job.id)}
                        disabled={actionLoadingId === job.id}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                        title="Excluir / Cancelar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bars & metrics */}
                  <div className="mt-4 space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                        <span>
                          {isUploading
                            ? `Enviando ao Drive: ${formatBytes(
                                job.driveUploadProgress * job.totalBytes
                              )} / ${formatBytes(job.totalBytes)}`
                            : `${formatBytes(job.downloadedBytes)} de ${formatBytes(
                                job.totalBytes
                              )}`}
                        </span>
                        <span>
                          {isUploading
                            ? `${Math.round(job.driveUploadProgress * 100)}%`
                            : `${Math.round(job.progress * 100)}%`}
                        </span>
                      </div>

                      {/* Download Progress Bar */}
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isCompleted
                              ? 'bg-emerald-500'
                              : isUploading
                              ? 'bg-emerald-500'
                              : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                          }`}
                          style={{ width: `${Math.round(job.progress * 100)}%` }}
                        />
                      </div>

                      {/* Google Drive Upload Progress Bar */}
                      {isUploading && (
                        <div className="pt-1.5">
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-full transition-all duration-300"
                              style={{ width: `${Math.round(job.driveUploadProgress * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status metrics bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                      <div className="flex items-center gap-4 flex-wrap">
                        {isDownloading && (
                          <>
                            <span className="flex items-center gap-1 font-mono text-cyan-400 font-medium">
                              <DownloadCloud className="w-3.5 h-3.5" />
                              {formatSpeed(job.downloadSpeed)}
                            </span>
                            {job.peersCount > 0 && (
                              <span className="flex items-center gap-1 font-mono text-slate-400">
                                <Users className="w-3.5 h-3.5" />
                                {job.peersCount} conexões{' '}
                                {job.seedsCount !== undefined ? `(${job.seedsCount} seeds)` : ''}
                              </span>
                            )}
                            <span className="flex items-center gap-1 font-mono text-slate-400">
                              <Clock className="w-3.5 h-3.5" />
                              ETA: {formatEta(job.etaSeconds)}
                            </span>
                          </>
                        )}

                        {isDownloading && job.statusMessage && (
                          <span className="text-[11px] text-slate-400 truncate max-w-sm hidden lg:inline-block">
                            {job.statusMessage}
                          </span>
                        )}

                        {isUploading && job.currentUploadingFileName && (
                          <span className="text-blue-300 text-xs truncate max-w-xs">
                            Arquivo: {job.currentUploadingFileName}
                          </span>
                        )}

                        {job.statusMessage && !isDownloading && (
                          <span
                            className={`text-xs ${
                              isError
                                ? 'text-red-400'
                                : isCompleted
                                ? 'text-emerald-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {job.statusMessage}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpand(job.id)}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer ml-auto"
                      >
                        <span>
                          {job.files ? `${job.files.length} arquivo(s)` : 'Detalhes'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible files list */}
                {isExpanded && job.files && job.files.length > 0 && (
                  <div className="bg-slate-950/80 border-t border-slate-800/80 p-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Arquivos do Pacote
                    </div>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {job.files.map((file, idx) => {
                        const isUploaded =
                          file.uploadedToDrive ||
                          (job.driveFiles &&
                            job.driveFiles.some((df) => df.name === file.name));
                        const driveLink =
                          job.driveFiles?.find((df) => df.name === file.name)?.webViewLink ||
                          file.driveFile?.webViewLink;

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/50 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              {isUploaded ? (
                                <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
                              )}
                              <span className="truncate text-slate-200 font-mono">
                                {file.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-slate-400 font-mono">
                                {formatBytes(file.length)}
                              </span>
                              {driveLink ? (
                                <a
                                  href={driveLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                                >
                                  <span>Ver no Drive</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : isUploaded ? (
                                <span className="text-emerald-400 font-medium">No Drive</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
