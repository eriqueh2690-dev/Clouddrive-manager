import React, { useState, useEffect } from 'react';
import {
  fetchDriveFiles,
  deleteDriveFile,
  fetchDriveQuota,
  DriveFileItem,
  DriveQuotaData,
} from '../services/apiClient.ts';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';
import { formatBytes } from '../utils/formatters.ts';
import {
  Folder,
  HardDrive,
  ExternalLink,
  Download,
  Trash2,
  RefreshCw,
  FileText,
  Film,
  Music,
  Archive,
  Image,
  AlertCircle,
  FolderOpen,
  Search,
  PieChart,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  isAuthenticated: boolean;
  onLoginRequest: () => void;
  folderName: string;
  onFolderNameChange: (newFolder: string) => void;
}

export const DriveExplorer: React.FC<Props> = ({
  isAuthenticated,
  onLoginRequest,
  folderName,
  onFolderNameChange,
}) => {
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [folderInfo, setFolderInfo] = useState<{ id: string; name: string } | null>(null);
  const [quota, setQuota] = useState<DriveQuotaData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadFilesAndQuota = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const [data, quotaData] = await Promise.all([
        fetchDriveFiles(folderName),
        fetchDriveQuota().catch(() => null),
      ]);
      setFiles(data.files || []);
      setFolderInfo(data.folder);
      if (quotaData) {
        setQuota(quotaData);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar arquivos do Google Drive');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadFilesAndQuota();
    }
  }, [isAuthenticated, folderName]);

  const handleDeletePrompt = (file: DriveFileItem) => {
    setFileToDelete(file);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(fileToDelete.id);
      setFileToDelete(null);
      await loadFilesAndQuota();
    } catch (err: any) {
      alert(`Falha ao excluir arquivo: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileIcon = (mimeType?: string, name?: string) => {
    const ext = name ? name.split('.').pop()?.toLowerCase() : '';
    if (
      mimeType?.includes('video') ||
      ['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext || '')
    ) {
      return <Film className="w-4 h-4 text-rose-400" />;
    }
    if (
      mimeType?.includes('audio') ||
      ['mp3', 'flac', 'wav', 'ogg'].includes(ext || '')
    ) {
      return <Music className="w-4 h-4 text-emerald-400" />;
    }
    if (
      mimeType?.includes('zip') ||
      mimeType?.includes('tar') ||
      ['zip', 'rar', '7z', 'iso'].includes(ext || '')
    ) {
      return <Archive className="w-4 h-4 text-amber-400" />;
    }
    if (mimeType?.includes('image') || ['jpg', 'png', 'webp'].includes(ext || '')) {
      return <Image className="w-4 h-4 text-sky-400" />;
    }
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  const filteredFiles = files.filter(
    (f) =>
      !searchQuery.trim() || f.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  if (!isAuthenticated) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-10 text-center shadow-xl backdrop-blur-md">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-800/80 text-blue-400 rounded-2xl flex items-center justify-center">
          <HardDrive className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-white">
          Conecte sua conta do Google Drive
        </h3>
        <p className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
          Faça login para visualizar e gerenciar os arquivos salvos pelo aplicativo na sua pasta do
          Google Drive.
        </p>
        <button
          type="button"
          onClick={onLoginRequest}
          className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
        >
          Conectar Google Drive
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Google Drive Storage Quota Card */}
      {quota && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                <PieChart className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Armazenamento do Google Drive
                </span>
                <span className="text-sm font-bold text-white">
                  {formatBytes(quota.usage)} de{' '}
                  {quota.limit > 0 ? formatBytes(quota.limit) : 'Ilimitado'}{' '}
                  <span className="text-xs text-slate-400 font-normal">
                    ({quota.usagePercentage}% em uso)
                  </span>
                </span>
              </div>
            </div>

            {quota.user?.displayName && (
              <div className="text-xs text-slate-400 flex items-center gap-2">
                {quota.user.photoLink && (
                  <img
                    src={quota.user.photoLink}
                    alt={quota.user.displayName}
                    className="w-5 h-5 rounded-full border border-blue-400/40"
                  />
                )}
                <span>Conta: {quota.user.displayName}</span>
              </div>
            )}
          </div>

          {/* Storage Quota Progress Bar */}
          <div className="w-full bg-slate-950/80 h-2 rounded-full overflow-hidden border border-slate-800/80">
            <div
              className={`h-full transition-all duration-500 ${
                quota.usagePercentage > 90
                  ? 'bg-rose-500'
                  : quota.usagePercentage > 75
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-cyan-400 to-blue-500'
              }`}
              style={{ width: `${Math.min(100, quota.usagePercentage)}%` }}
            />
          </div>
        </div>
      )}

      {/* Folder Header Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Pasta no Google Drive
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <input
                type="text"
                value={folderName}
                onChange={(e) => onFolderNameChange(e.target.value)}
                onBlur={loadFilesAndQuota}
                className="font-bold text-white text-base bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg px-2.5 py-1"
                placeholder="Torrent to Google Drive"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {folderInfo?.id && (
            <a
              href={`https://drive.google.com/drive/folders/${folderInfo.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir no Google Drive</span>
            </a>
          )}
          <button
            type="button"
            onClick={loadFilesAndQuota}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Atualizar pasta"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Files List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Arquivos na Pasta</span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                {filteredFiles.length} de {files.length}
              </span>
            </h3>
            <span className="text-xs text-slate-400">
              Total:{' '}
              {formatBytes(
                files.reduce((acc, f) => acc + (f.size ? parseInt(f.size, 10) : 0), 0)
              )}
            </span>
          </div>

          {/* Search bar inside Drive files */}
          <div className="relative sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar arquivo..."
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-blue-500 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
            <p className="text-sm">Carregando arquivos do Google Drive...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Folder className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-300 font-medium">Nenhum arquivo nesta pasta</p>
            <p className="text-xs text-slate-500 mt-1">
              Os arquivos que você baixar de links diretos ou torrents aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="p-3.5 sm:px-4 hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-slate-800/80 rounded-lg shrink-0">
                    {getFileIcon(file.mimeType, file.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-200 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400 font-mono">
                      {formatBytes(file.size ? parseInt(file.size, 10) : 0)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                      title="Abrir no Google Drive"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {file.webContentLink && (
                    <a
                      href={file.webContentLink}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                      title="Baixar diretamente"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeletePrompt(file)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Excluir arquivo do Google Drive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Destructive Delete */}
      <ConfirmDeleteModal
        isOpen={Boolean(fileToDelete)}
        title="Excluir arquivo do Google Drive?"
        description="Esta ação removerá permanentemente o arquivo da sua conta do Google Drive. Esta ação não pode ser desfeita."
        itemName={fileToDelete?.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setFileToDelete(null)}
        isLoading={isDeleting}
      />
    </div>
  );
};
