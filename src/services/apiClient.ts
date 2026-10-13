import { getAccessToken } from './auth.ts';

export type TransferType = 'torrent' | 'direct_url' | 'local_upload';

export interface TorrentFileItem {
  index: number;
  name: string;
  path: string;
  length: number;
  selected?: boolean;
  uploadedToDrive?: boolean;
  driveFile?: {
    id: string;
    name: string;
    webViewLink?: string;
    webContentLink?: string;
    size?: string;
  };
}

export interface TransferJobData {
  id: string;
  type?: TransferType;
  name: string;
  sourceUrl?: string;
  infoHash?: string;
  status:
    | 'initializing'
    | 'fetching_metadata'
    | 'downloading'
    | 'uploading_to_drive'
    | 'completed'
    | 'paused'
    | 'cancelled'
    | 'error';
  statusMessage: string;
  totalBytes: number;
  downloadedBytes: number;
  downloadSpeed: number;
  uploadSpeed: number;
  progress: number;
  peersCount: number;
  seedsCount?: number;
  etaSeconds: number | null;
  files: TorrentFileItem[];
  destinationFolder: string;
  driveFolderId?: string;
  driveFiles: Array<{
    id: string;
    name: string;
    webViewLink?: string;
    webContentLink?: string;
    size?: string;
  }>;
  driveUploadProgress: number;
  currentUploadingFileName?: string;
  autoUploadToDrive: boolean;
  createdAt: number;
  completedAt?: number;
  error?: string;
  engineType?: 'aria2_turbo' | 'torrent_stream' | 'http_stream' | 'local_upload';
}

export type TorrentJobData = TransferJobData;

export interface DriveFileItem {
  id: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
  mimeType?: string;
}

export interface DriveQuotaData {
  limit: number;
  usage: number;
  usageInDrive: number;
  usageInDriveTrash: number;
  usagePercentage: number;
  user?: {
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  };
}

export interface HttpInspectResult {
  url: string;
  fileName: string;
  totalBytes: number;
  contentType: string;
  acceptRanges: boolean;
}

// 1. Inspect HTTP URL
export async function inspectHttpUrl(
  url: string,
  headers?: Record<string, string>
): Promise<HttpInspectResult> {
  const res = await fetch('/api/http/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, headers }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao analisar link' }));
    throw new Error(err.error || 'Falha ao analisar link direto');
  }
  return res.json();
}

// 2. Start Direct URL Transfer
export async function startUrlTransfer({
  url,
  folderName = 'Torrent to Google Drive',
  fileName,
  headers,
  autoUpload = true,
}: {
  url: string;
  folderName?: string;
  fileName?: string;
  headers?: Record<string, string>;
  autoUpload?: boolean;
}): Promise<TransferJobData> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autorização do Google Drive necessária. Faça login primeiro.');
  }

  const res = await fetch('/api/transfer/add-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      url,
      folderName,
      fileName,
      headers,
      autoUpload,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao iniciar download de URL' }));
    throw new Error(err.error || 'Falha ao iniciar download de URL');
  }

  return res.json();
}

// 3. Start Batch Transfer
export async function startBatchTransfer({
  urls,
  folderName = 'Torrent to Google Drive',
  autoUpload = true,
}: {
  urls: string[];
  folderName?: string;
  autoUpload?: boolean;
}): Promise<{ jobs: TransferJobData[]; count: number }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autorização do Google Drive necessária. Faça login primeiro.');
  }

  const res = await fetch('/api/transfer/add-batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      urls,
      folderName,
      autoUpload,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao iniciar downloads em lote' }));
    throw new Error(err.error || 'Falha ao iniciar downloads em lote');
  }

  return res.json();
}

// 4. Start Local File Upload
export async function startLocalUpload({
  fileName,
  fileBase64,
  folderName = 'Torrent to Google Drive',
}: {
  fileName: string;
  fileBase64: string;
  folderName?: string;
}): Promise<TransferJobData> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autorização do Google Drive necessária. Faça login primeiro.');
  }

  const res = await fetch('/api/transfer/upload-local', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName,
      fileBase64,
      folderName,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao enviar arquivo' }));
    throw new Error(err.error || 'Falha ao enviar arquivo local');
  }

  return res.json();
}

// 5. Inspect Torrent
export async function inspectTorrent(source: {
  magnet?: string;
  torrentBase64?: string;
}): Promise<{
  name: string;
  infoHash: string;
  totalBytes: number;
  files: Array<{ index: number; name: string; path: string; length: number }>;
  trackers: string[];
}> {
  const res = await fetch('/api/torrent/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(source),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao analisar torrent' }));
    throw new Error(err.error || 'Falha ao analisar torrent');
  }
  return res.json();
}

// 6. Start Torrent Transfer
export async function startTorrentTransfer({
  magnet,
  torrentBase64,
  folderName = 'Torrent to Google Drive',
  selectedFiles,
  autoUpload = true,
}: {
  magnet?: string;
  torrentBase64?: string;
  folderName?: string;
  selectedFiles?: number[];
  autoUpload?: boolean;
}): Promise<TransferJobData> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autorização do Google Drive necessária. Faça login primeiro.');
  }

  const res = await fetch('/api/torrent/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      magnet,
      torrentBase64,
      folderName,
      selectedFiles,
      autoUpload,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao iniciar torrent' }));
    throw new Error(err.error || 'Falha ao iniciar torrent');
  }

  return res.json();
}

// 7. Fetch Unified Transfer List
export async function fetchTransferList(): Promise<TransferJobData[]> {
  const res = await fetch('/api/transfer/list');
  if (!res.ok) {
    throw new Error('Falha ao listar transferências');
  }
  return res.json();
}

export const fetchTorrentList = fetchTransferList;

// 8. Control Actions
export async function pauseTorrent(jobId: string): Promise<boolean> {
  const res = await fetch(`/api/transfer/${jobId}/pause`, { method: 'POST' });
  return res.ok;
}

export async function resumeTorrent(jobId: string): Promise<boolean> {
  const res = await fetch(`/api/transfer/${jobId}/resume`, { method: 'POST' });
  return res.ok;
}

export async function cancelTorrent(jobId: string): Promise<boolean> {
  const res = await fetch(`/api/transfer/${jobId}`, { method: 'DELETE' });
  return res.ok;
}

export async function uploadTorrentToDrive(jobId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) throw new Error('Autorização necessária');

  const res = await fetch(`/api/transfer/${jobId}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

// 9. Drive Storage Quota
export async function fetchDriveQuota(): Promise<DriveQuotaData> {
  const token = await getAccessToken();
  if (!token) throw new Error('Autorização necessária');

  const res = await fetch('/api/drive/quota', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao buscar cota do Drive' }));
    throw new Error(err.error || 'Falha ao buscar cota do Drive');
  }
  return res.json();
}

// 10. Drive Files & Folder
export async function fetchDriveFiles(folderName: string): Promise<{
  folder: { id: string; name: string };
  files: DriveFileItem[];
}> {
  const token = await getAccessToken();
  if (!token) throw new Error('Autorização necessária');

  const res = await fetch(`/api/drive/files?folderName=${encodeURIComponent(folderName)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao buscar arquivos do Drive' }));
    throw new Error(err.error || 'Falha ao buscar arquivos do Drive');
  }
  return res.json();
}

export async function deleteDriveFile(fileId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) throw new Error('Autorização necessária');

  const res = await fetch(`/api/drive/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao excluir arquivo' }));
    throw new Error(err.error || 'Falha ao excluir arquivo');
  }
  return res.json();
}
