import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { execSync } from 'node:child_process';
import torrentStream from 'torrent-stream';
import parseTorrent from 'parse-torrent';
import {
  getOrCreateDriveFolder,
  uploadFileToGoogleDrive,
  uploadStreamToGoogleDrive,
  UploadedDriveFile,
} from './googleDrive.ts';
import { Aria2DownloadJob, AriaProgress } from './aria2Engine.ts';
import {
  HttpDownloadJob,
  HttpProgress,
  inspectHttpUrl,
  HttpInspectInfo,
} from './httpEngine.ts';

export type TransferType = 'torrent' | 'direct_url' | 'local_upload';

export interface TorrentFileInfo {
  index: number;
  name: string;
  path: string;
  length: number;
  selected: boolean;
  uploadedToDrive?: boolean;
  driveFile?: UploadedDriveFile;
}

export type TorrentStatus =
  | 'initializing'
  | 'fetching_metadata'
  | 'downloading'
  | 'uploading_to_drive'
  | 'completed'
  | 'paused'
  | 'cancelled'
  | 'error';

export interface TransferJob {
  id: string;
  type: TransferType;
  name: string;
  sourceUrl?: string;
  infoHash?: string;
  status: TorrentStatus;
  statusMessage: string;
  totalBytes: number;
  downloadedBytes: number;
  downloadSpeed: number; // bytes/sec
  uploadSpeed: number; // bytes/sec
  progress: number; // 0 to 1
  peersCount: number;
  seedsCount?: number;
  etaSeconds: number | null;
  files: TorrentFileInfo[];
  destinationFolder: string;
  driveFolderId?: string;
  driveFiles: UploadedDriveFile[];
  driveUploadProgress: number; // 0 to 1
  currentUploadingFileName?: string;
  autoUploadToDrive: boolean;
  createdAt: number;
  completedAt?: number;
  error?: string;
  engineType: 'aria2_turbo' | 'torrent_stream' | 'http_stream' | 'local_upload';
}

export type TorrentJob = TransferJob;

const PUBLIC_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.bittor.pw:1337/announce',
  'udp://public.popcorn-tracker.org:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://explodie.org:6969/announce',
  'udp://ipv4.tracker.harry.lu:80/announce',
  'http://tracker.openbittorrent.com:80/announce',
  'udp://opentracker.i2p.rocks:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://tracker.internetwarriors.net:1337/announce',
  'udp://p4p.arenabg.com:1337/announce',
  'udp://movies.zsw.ca:6969/announce',
  'udp://tracker.zerobytes.xyz:1337/announce',
  'udp://tracker.leechers-paradise.org:6969/announce',
  'udp://retracker.lanta.me:2710/announce',
  'udp://tracker.srv00.com:6969/announce',
  'udp://tracker.fnix.net:6969/announce',
  'udp://tracker.skynetcloud.site:6969/announce',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
];

function enrichMagnetWithTrackers(source: string | Buffer): string | Buffer {
  if (typeof source !== 'string' || !source.startsWith('magnet:?')) {
    return source;
  }
  let enriched = source;
  for (const tr of PUBLIC_TRACKERS) {
    const encoded = encodeURIComponent(tr);
    if (!enriched.includes(encoded) && !enriched.includes(tr)) {
      enriched += `&tr=${encoded}`;
    }
  }
  return enriched;
}

let hasAria2 = false;
try {
  const checkCmd = process.platform === 'win32' ? 'where aria2c' : 'which aria2c';
  execSync(checkCmd, { stdio: 'ignore' });
  hasAria2 = true;
} catch {
  hasAria2 = false;
}

function scanDiskFiles(
  dir: string,
  rootDir: string
): Array<{ fullPath: string; relativePath: string; fileName: string; size: number }> {
  let results: Array<{ fullPath: string; relativePath: string; fileName: string; size: number }> =
    [];
  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item.endsWith('.aria2') || item.endsWith('source.torrent')) continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(scanDiskFiles(fullPath, rootDir));
    } else if (stat.size > 0) {
      results.push({
        fullPath,
        relativePath: path.relative(rootDir, fullPath),
        fileName: path.basename(fullPath),
        size: stat.size,
      });
    }
  }
  return results;
}

class TransferManager {
  private jobs: Map<string, TransferJob> = new Map();
  private ariaJobs: Map<string, Aria2DownloadJob> = new Map();
  private httpJobs: Map<string, HttpDownloadJob> = new Map();
  private torrentEngines: Map<string, any> = new Map();
  private userTokens: Map<string, string> = new Map(); // jobId -> accessToken

  constructor() {
    const timer = setInterval(() => this.updateTorrentStats(), 1000);
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  public getJobs(): TransferJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getJob(id: string): TransferJob | undefined {
    return this.jobs.get(id);
  }

  // 1. Inspect HTTP / HTTPS URL
  public async inspectHttp(
    url: string,
    headers?: Record<string, string>
  ): Promise<HttpInspectInfo> {
    return inspectHttpUrl(url, headers);
  }

  // 2. Inspect Torrent
  public async inspectTorrent(source: string | Buffer): Promise<{
    name: string;
    infoHash: string;
    totalBytes: number;
    files: Array<{ index: number; name: string; path: string; length: number }>;
    trackers: string[];
  }> {
    const parsed: any = await parseTorrent(source);
    const files = (parsed.files || []).map((f: any, idx: number) => ({
      index: idx,
      name: f.name || path.basename(f.path || `file-${idx}`),
      path: f.path || f.name,
      length: f.length || 0,
    }));

    const totalBytes =
      parsed.length || files.reduce((acc: number, f: any) => acc + f.length, 0);

    return {
      name: parsed.name || 'Torrent',
      infoHash: parsed.infoHash || '',
      totalBytes,
      files,
      trackers: parsed.announce || [],
    };
  }

  // 3. Add Direct HTTP / HTTPS URL Download
  public async addDirectUrl({
    url,
    destinationFolder = 'Torrent to Google Drive',
    accessToken,
    fileName,
    headers,
    autoUploadToDrive = true,
  }: {
    url: string;
    destinationFolder?: string;
    accessToken: string;
    fileName?: string;
    headers?: Record<string, string>;
    autoUploadToDrive?: boolean;
  }): Promise<TransferJob> {
    const jobId = 'http_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const downloadDir = path.join(os.tmpdir(), 'torrent-to-drive', jobId);

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    this.userTokens.set(jobId, accessToken);

    let initialName = fileName || 'Conectando ao servidor...';
    let initialTotalBytes = 0;

    const initialJob: TransferJob = {
      id: jobId,
      type: 'direct_url',
      name: initialName,
      sourceUrl: url,
      status: 'downloading',
      statusMessage: 'Iniciando download direto via stream de alta velocidade...',
      totalBytes: initialTotalBytes,
      downloadedBytes: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      progress: 0,
      peersCount: 1,
      etaSeconds: null,
      files: [],
      destinationFolder,
      driveFiles: [],
      driveUploadProgress: 0,
      autoUploadToDrive,
      createdAt: Date.now(),
      engineType: 'http_stream',
    };

    this.jobs.set(jobId, initialJob);

    // Se o upload automático para o Drive estiver ativado, usa o Modo Tubo Contínuo (Zero Disco)!
    if (autoUploadToDrive) {
      this.startDirectStreamUploadToDrive(
        jobId,
        url,
        destinationFolder,
        accessToken,
        fileName,
        headers
      ).catch((err) => {
        console.error('Direct stream upload error:', err);
      });
      return initialJob;
    }

    // Caso contrário (apenas download local no servidor), usa o motor convencional de arquivo
    const httpJob = new HttpDownloadJob({
      url,
      downloadDir,
      fileName,
      headers,
      onProgress: (p: HttpProgress) => {
        const job = this.jobs.get(jobId);
        if (!job || job.status === 'uploading_to_drive' || job.status === 'completed') return;

        job.downloadedBytes = p.downloadedBytes;
        if (p.totalBytes > 0) {
          job.totalBytes = p.totalBytes;
        }
        job.progress = p.progress;
        job.downloadSpeed = p.downloadSpeed;
        job.etaSeconds = p.etaSeconds;
        job.status = 'downloading';
        job.name = p.fileName;
        job.statusMessage =
          p.downloadSpeed > 0
            ? `Baixando link direto (${(p.downloadSpeed / 1024 / 1024).toFixed(1)} MB/s)...`
            : 'Recebendo stream de dados...';

        this.jobs.set(jobId, { ...job });
      },
      onComplete: async (file) => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.name = file.fileName;
        job.downloadedBytes = file.size;
        job.totalBytes = file.size;
        job.progress = 1;
        job.downloadSpeed = 0;
        job.etaSeconds = 0;

        job.files = [
          {
            index: 0,
            name: file.fileName,
            path: file.fileName,
            length: file.size,
            selected: true,
          },
        ];

        job.status = 'completed';
        job.statusMessage = 'Download concluído! Pronto para enviar ao Google Drive.';
        job.completedAt = Date.now();
        this.jobs.set(jobId, { ...job });
      },
      onError: (err: Error) => {
        console.error(`HTTP error for job ${jobId}:`, err);
        const job = this.jobs.get(jobId);
        if (job && job.status !== 'completed' && job.status !== 'uploading_to_drive') {
          job.status = 'error';
          job.error = err.message || 'Falha no download via HTTP';
          job.statusMessage = `Erro: ${job.error}`;
          this.jobs.set(jobId, { ...job });
        }
      },
    });

    this.httpJobs.set(jobId, httpJob);
    httpJob.start();

    return initialJob;
  }

  // Transmissão Direta HTTP -> Google Drive em Tempo Real (Zero Disco / Memória Buffer 16MB)
  private async startDirectStreamUploadToDrive(
    jobId: string,
    url: string,
    destinationFolder: string,
    accessToken: string,
    customFileName?: string,
    customHeaders?: Record<string, string>
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'uploading_to_drive';
      job.statusMessage = 'Inspecionando link e preparando canal de transmissão (Zero Disco)...';
      this.jobs.set(jobId, { ...job });

      let inspected: HttpInspectInfo | null = null;
      try {
        inspected = await inspectHttpUrl(url, customHeaders);
      } catch {}

      const fileName = customFileName || inspected?.fileName || `download-${Date.now()}`;
      const totalBytes = inspected?.totalBytes || 0;

      job.name = fileName;
      job.totalBytes = totalBytes;
      job.files = [
        {
          index: 0,
          name: fileName,
          path: fileName,
          length: totalBytes,
          selected: true,
        },
      ];

      const driveFolder = await getOrCreateDriveFolder(destinationFolder, accessToken);
      job.driveFolderId = driveFolder.id;
      job.currentUploadingFileName = fileName;
      job.statusMessage = 'Iniciando transmissão contínua direta para o Google Drive...';
      this.jobs.set(jobId, { ...job });

      const reqHeaders: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
        ...(customHeaders || {}),
      };

      const streamResponse = await new Promise<http.IncomingMessage>((resolve, reject) => {
        const doReq = (targetUrl: string, redirs = 0) => {
          if (redirs > 8) {
            return reject(new Error('Muitos redirecionamentos'));
          }
          const p = new URL(targetUrl);
          const c = p.protocol === 'https:' ? https : http;
          const req = c.get(targetUrl, { headers: reqHeaders }, (res) => {
            if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
              const nextUrl = new URL(res.headers.location, targetUrl).toString();
              return doReq(nextUrl, redirs + 1);
            }
            if (res.statusCode && res.statusCode >= 400) {
              return reject(new Error(`Servidor remoto respondeu com código HTTP ${res.statusCode}`));
            }
            resolve(res);
          });
          req.on('error', reject);
        };
        doReq(url);
      });

      let lastTime = Date.now();
      let lastUploadedBytes = 0;

      const uploaded = await uploadStreamToGoogleDrive({
        stream: streamResponse,
        fileName,
        fileSize: totalBytes,
        folderId: driveFolder.id,
        accessToken,
        onProgress: (uploadedBytes) => {
          const now = Date.now();
          const elapsed = (now - lastTime) / 1000;
          if (elapsed >= 0.8) {
            job.downloadSpeed = Math.round((uploadedBytes - lastUploadedBytes) / elapsed);
            lastTime = now;
            lastUploadedBytes = uploadedBytes;
          }
          job.downloadedBytes = uploadedBytes;
          if (totalBytes > 0) {
            job.progress = Math.min(1, uploadedBytes / totalBytes);
            job.driveUploadProgress = job.progress;
            const remaining = totalBytes - uploadedBytes;
            job.etaSeconds = job.downloadSpeed > 0 ? Math.max(0, Math.round(remaining / job.downloadSpeed)) : null;
          }
          job.statusMessage =
            totalBytes > 0
              ? `Transmitindo ao vivo pro Drive: ${(uploadedBytes / 1024 / 1024).toFixed(1)} de ${(totalBytes / 1024 / 1024).toFixed(1)} MB (${(job.progress * 100).toFixed(0)}%)`
              : `Transmitindo ao vivo pro Drive: ${(uploadedBytes / 1024 / 1024).toFixed(1)} MB enviados`;

          this.jobs.set(jobId, { ...job });
        },
      });

      job.files[0].uploadedToDrive = true;
      job.files[0].driveFile = uploaded;
      job.driveFiles.push(uploaded);
      job.status = 'completed';
      job.statusMessage = 'Arquivo enviado com sucesso direto para o Google Drive!';
      job.progress = 1;
      job.driveUploadProgress = 1;
      job.completedAt = Date.now();
      job.currentUploadingFileName = undefined;
      this.jobs.set(jobId, { ...job });
    } catch (err: any) {
      console.error(`Direct stream error for job ${jobId}:`, err);
      job.status = 'error';
      job.error = err.message || 'Falha na transmissão contínua';
      job.statusMessage = `Erro: ${job.error}`;
      this.jobs.set(jobId, { ...job });
    }
  }

  // 4. Add Batch URLs
  public async addBatchUrls({
    urls,
    destinationFolder = 'Torrent to Google Drive',
    accessToken,
    autoUploadToDrive = true,
  }: {
    urls: string[];
    destinationFolder?: string;
    accessToken: string;
    autoUploadToDrive?: boolean;
  }): Promise<TransferJob[]> {
    const jobs: TransferJob[] = [];
    for (const url of urls) {
      const trimmed = url.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('magnet:?')) {
        const j = await this.addTorrent({
          source: trimmed,
          destinationFolder,
          accessToken,
          autoUploadToDrive,
        });
        jobs.push(j);
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const j = await this.addDirectUrl({
          url: trimmed,
          destinationFolder,
          accessToken,
          autoUploadToDrive,
        });
        jobs.push(j);
      }
    }
    return jobs;
  }

  // 5. Add Direct Local File Upload (from computer to Google Drive)
  public async addLocalUpload({
    fileName,
    fileSize,
    localFilePath,
    destinationFolder = 'Torrent to Google Drive',
    accessToken,
  }: {
    fileName: string;
    fileSize: number;
    localFilePath: string;
    destinationFolder?: string;
    accessToken: string;
  }): Promise<TransferJob> {
    const jobId = 'upload_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    this.userTokens.set(jobId, accessToken);

    const job: TransferJob = {
      id: jobId,
      type: 'local_upload',
      name: fileName,
      status: 'downloading',
      statusMessage: 'Arquivo local preparado para envio ao Google Drive...',
      totalBytes: fileSize,
      downloadedBytes: fileSize,
      downloadSpeed: 0,
      uploadSpeed: 0,
      progress: 1,
      peersCount: 0,
      etaSeconds: 0,
      files: [
        {
          index: 0,
          name: fileName,
          path: fileName,
          length: fileSize,
          selected: true,
        },
      ],
      destinationFolder,
      driveFiles: [],
      driveUploadProgress: 0,
      autoUploadToDrive: true,
      createdAt: Date.now(),
      engineType: 'local_upload',
    };

    this.jobs.set(jobId, job);

    // Trigger upload immediately
    this.triggerDirectFileUpload(jobId, localFilePath, fileName, fileSize, accessToken).catch(
      (err) => {
        console.error('Local upload error:', err);
      }
    );

    return job;
  }

  // Internal helper for direct local file upload
  private async triggerDirectFileUpload(
    jobId: string,
    filePath: string,
    fileName: string,
    fileSize: number,
    token: string
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'uploading_to_drive';
    job.statusMessage = `Localizando pasta "${job.destinationFolder}" no Google Drive...`;
    this.jobs.set(jobId, { ...job });

    try {
      const driveFolder = await getOrCreateDriveFolder(job.destinationFolder, token);
      job.driveFolderId = driveFolder.id;
      job.currentUploadingFileName = fileName;
      job.statusMessage = `Enviando "${fileName}" em chunks de alta velocidade...`;
      this.jobs.set(jobId, { ...job });

      const uploaded = await uploadFileToGoogleDrive({
        filePath,
        fileName,
        fileSize,
        folderId: driveFolder.id,
        accessToken: token,
        onProgress: (chunkUploaded) => {
          if (fileSize > 0) {
            job.driveUploadProgress = Math.min(1, chunkUploaded / fileSize);
            this.jobs.set(jobId, { ...job });
          }
        },
      });

      job.files[0].uploadedToDrive = true;
      job.files[0].driveFile = uploaded;
      job.driveFiles.push(uploaded);
      job.status = 'completed';
      job.statusMessage = `Arquivo salvo com sucesso no Google Drive!`;
      job.driveUploadProgress = 1;
      job.completedAt = Date.now();
      job.currentUploadingFileName = undefined;

      // Clean temp file
      try {
        fs.unlinkSync(filePath);
      } catch {}
    } catch (err: any) {
      console.error(`Upload error for job ${jobId}:`, err);
      job.status = 'error';
      job.error = err.message || 'Falha no envio ao Google Drive';
      job.statusMessage = `Erro: ${job.error}`;
    }

    this.jobs.set(jobId, { ...job });
  }

  // 6. Add Torrent
  public async addTorrent({
    source,
    destinationFolder = 'Torrent to Google Drive',
    accessToken,
    selectedFileIndices,
    autoUploadToDrive = true,
  }: {
    source: string | Buffer;
    destinationFolder?: string;
    accessToken: string;
    selectedFileIndices?: number[];
    autoUploadToDrive?: boolean;
  }): Promise<TransferJob> {
    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const downloadDir = path.join(os.tmpdir(), 'torrent-to-drive', jobId);

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    this.userTokens.set(jobId, accessToken);

    let initialName = 'Conectando ao Swarm P2P...';
    let initialInfoHash = '';
    let initialTotalBytes = 0;
    let initialFiles: TorrentFileInfo[] = [];

    try {
      const inspected = await this.inspectTorrent(source);
      if (inspected.name) initialName = inspected.name;
      if (inspected.infoHash) initialInfoHash = inspected.infoHash;
      if (inspected.totalBytes) initialTotalBytes = inspected.totalBytes;
      if (inspected.files && inspected.files.length > 0) {
        initialFiles = inspected.files.map((f) => ({
          index: f.index,
          name: f.name,
          path: f.path,
          length: f.length,
          selected:
            !selectedFileIndices ||
            selectedFileIndices.length === 0 ||
            selectedFileIndices.includes(f.index),
        }));
      }
    } catch {}

    const initialJob: TransferJob = {
      id: jobId,
      type: 'torrent',
      name: initialName,
      infoHash: initialInfoHash,
      status: 'downloading',
      statusMessage: hasAria2
        ? 'Iniciando Motor Turbo C++ Aria2 (Multi-Threaded)...'
        : 'Conectando à rede BitTorrent...',
      totalBytes: initialTotalBytes,
      downloadedBytes: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      progress: 0,
      peersCount: 0,
      etaSeconds: null,
      files: initialFiles,
      destinationFolder,
      driveFiles: [],
      driveUploadProgress: 0,
      autoUploadToDrive,
      createdAt: Date.now(),
      engineType: hasAria2 ? 'aria2_turbo' : 'torrent_stream',
    };

    this.jobs.set(jobId, initialJob);

    // Primary Turbo Engine: Aria2
    if (hasAria2) {
      let ariaSource: string;
      if (Buffer.isBuffer(source)) {
        const torrentFilePath = path.join(downloadDir, 'source.torrent');
        fs.writeFileSync(torrentFilePath, source);
        ariaSource = torrentFilePath;
      } else {
        ariaSource = enrichMagnetWithTrackers(source) as string;
      }

      const ariaJob = new Aria2DownloadJob({
        source: ariaSource,
        downloadDir,
        trackers: PUBLIC_TRACKERS,
        selectedFiles: selectedFileIndices,
        onProgress: (p: AriaProgress) => {
          const job = this.jobs.get(jobId);
          if (!job || job.status === 'uploading_to_drive' || job.status === 'completed') return;

          job.downloadedBytes = p.downloadedBytes;
          if (p.totalBytes > 0) {
            job.totalBytes = p.totalBytes;
          }
          job.progress = job.totalBytes > 0 ? Math.min(1, job.downloadedBytes / job.totalBytes) : p.progress;
          job.downloadSpeed = p.downloadSpeed;
          job.uploadSpeed = p.uploadSpeed;
          job.peersCount = p.peersCount;
          job.seedsCount = p.seedsCount;
          job.etaSeconds = p.etaSeconds;
          job.status = 'downloading';
          job.statusMessage =
            p.downloadSpeed > 0
              ? `Baixando em alta velocidade (${(p.downloadSpeed / 1024 / 1024).toFixed(1)} MB/s) • ${p.peersCount} conexões (${p.seedsCount || 0} seeds)`
              : p.seedsCount === 0
              ? `Conectado a ${p.peersCount} pares (aguardando liberação de dados pelos seeds)...`
              : `Conectado a ${p.peersCount} conexões (${p.seedsCount} seeds)...`;

          if (p.currentFileName && (!job.name || job.name.includes('Conectando'))) {
            job.name = path.basename(p.currentFileName);
          }

          this.jobs.set(jobId, { ...job });
        },
        onComplete: async () => {
          const job = this.jobs.get(jobId);
          if (!job) return;

          job.downloadedBytes = job.totalBytes;
          job.progress = 1;
          job.downloadSpeed = 0;
          job.etaSeconds = 0;

          if (job.autoUploadToDrive) {
            await this.triggerDriveUpload(jobId);
          } else {
            job.status = 'completed';
            job.statusMessage = 'Download concluído! Pronto para enviar ao Google Drive.';
            job.completedAt = Date.now();
            this.jobs.set(jobId, { ...job });
          }
        },
        onError: (err: Error) => {
          console.error(`Aria2 error for job ${jobId}:`, err);
          const job = this.jobs.get(jobId);
          if (job && job.status !== 'completed' && job.status !== 'uploading_to_drive') {
            job.status = 'error';
            job.error = err.message || 'Falha no download via Aria2';
            job.statusMessage = `Erro: ${job.error}`;
            this.jobs.set(jobId, { ...job });
          }
        },
      });

      this.ariaJobs.set(jobId, ariaJob);
      ariaJob.start();
      return initialJob;
    }

    // Fallback Engine: torrent-stream
    const enrichedSource = enrichMagnetWithTrackers(source);
    try {
      const engine: any = torrentStream(enrichedSource, {
        path: downloadDir,
        trackers: PUBLIC_TRACKERS,
        dht: true,
        connections: 250,
        uploads: 15,
      });

      this.torrentEngines.set(jobId, engine);

      engine.on('ready', async () => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.name = engine.torrent.name || job.name;
        job.infoHash = engine.torrent.infoHash || job.infoHash;
        job.totalBytes = engine.torrent.length || job.totalBytes;
        job.status = 'downloading';
        job.statusMessage = 'Baixando blocos do torrent...';

        const fileList: TorrentFileInfo[] = engine.files.map((file: any, index: number) => {
          const isSelected =
            !selectedFileIndices ||
            selectedFileIndices.length === 0 ||
            selectedFileIndices.includes(index);

          if (!isSelected) {
            file.deselect();
          } else {
            file.select();
          }

          return {
            index,
            name: file.name,
            path: file.path,
            length: file.length,
            selected: isSelected,
          };
        });

        job.files = fileList;

        const selectedBytes = fileList
          .filter((f) => f.selected)
          .reduce((acc, f) => acc + f.length, 0);

        if (selectedBytes > 0) {
          job.totalBytes = selectedBytes;
        }

        this.jobs.set(jobId, { ...job });
      });

      engine.on('download', () => {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'downloading') return;

        const swarm = engine.swarm;
        if (swarm) {
          job.downloadedBytes = swarm.downloaded;
          job.downloadSpeed = swarm.downloadSpeed();
          job.uploadSpeed = swarm.uploadSpeed();
          job.peersCount = swarm.wires.length;

          if (job.totalBytes > 0) {
            job.progress = Math.min(1, job.downloadedBytes / job.totalBytes);
            if (job.downloadSpeed > 0) {
              const remainingBytes = Math.max(0, job.totalBytes - job.downloadedBytes);
              job.etaSeconds = Math.round(remainingBytes / job.downloadSpeed);
            }
          }
        }
      });

      engine.on('idle', async () => {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'downloading') return;

        job.downloadedBytes = job.totalBytes;
        job.progress = 1;
        job.downloadSpeed = 0;
        job.etaSeconds = 0;

        if (job.autoUploadToDrive) {
          await this.triggerDriveUpload(jobId);
        } else {
          job.status = 'completed';
          job.statusMessage = 'Download concluído! Pronto para transferir ao Google Drive.';
          job.completedAt = Date.now();
        }
      });

      engine.on('error', (err: any) => {
        console.error(`Torrent engine error for job ${jobId}:`, err);
        const job = this.jobs.get(jobId);
        if (job) {
          job.status = 'error';
          job.error = err.message || 'Erro no enxame';
          job.statusMessage = `Erro: ${job.error}`;
        }
      });
    } catch (err: any) {
      console.error(`Error starting torrent job ${jobId}:`, err);
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = err.message || 'Falha ao iniciar torrent';
        job.statusMessage = `Falha: ${job.error}`;
      }
    }

    return initialJob;
  }

  // 7. Upload to Google Drive
  public async triggerDriveUpload(jobId: string, customToken?: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    const token = customToken || this.userTokens.get(jobId);
    if (!token) {
      job.status = 'error';
      job.error = 'Token de acesso ao Google Drive necessário para upload';
      job.statusMessage = 'Conecte sua conta do Google Drive para concluir o envio';
      return;
    }

    job.status = 'uploading_to_drive';
    job.statusMessage = `Criando / localizando pasta no Google Drive "${job.destinationFolder}"...`;
    this.jobs.set(jobId, { ...job });

    try {
      const driveFolder = await getOrCreateDriveFolder(job.destinationFolder, token);
      job.driveFolderId = driveFolder.id;
      job.statusMessage = `Conectado à pasta "${driveFolder.name}". Enviando arquivos em alta velocidade...`;

      const downloadDir = path.join(os.tmpdir(), 'torrent-to-drive', jobId);
      const diskFiles = scanDiskFiles(downloadDir, downloadDir);

      if (diskFiles.length === 0) {
        throw new Error('Nenhum arquivo baixado encontrado no disco para envio.');
      }

      job.files = diskFiles.map((df, idx) => ({
        index: idx,
        name: df.fileName,
        path: df.relativePath,
        length: df.size,
        selected: true,
      }));

      const totalUploadBytes = diskFiles.reduce((acc, f) => acc + f.size, 0);
      let cumulativeUploadedBytes = 0;

      for (let i = 0; i < diskFiles.length; i++) {
        const fileInfo = diskFiles[i];
        job.currentUploadingFileName = fileInfo.fileName;
        job.statusMessage = `Enviando arquivo ${i + 1}/${diskFiles.length}: ${fileInfo.fileName} para o Google Drive...`;
        this.jobs.set(jobId, { ...job });

        const uploadedFile = await uploadFileToGoogleDrive({
          filePath: fileInfo.fullPath,
          fileName: fileInfo.fileName,
          fileSize: fileInfo.size,
          folderId: driveFolder.id,
          accessToken: token,
          onProgress: (chunkUploaded) => {
            const currentTotal = cumulativeUploadedBytes + chunkUploaded;
            if (totalUploadBytes > 0) {
              job.driveUploadProgress = Math.min(1, currentTotal / totalUploadBytes);
            }
          },
        });

        if (job.files[i]) {
          job.files[i].uploadedToDrive = true;
          job.files[i].driveFile = uploadedFile;
        }
        job.driveFiles.push(uploadedFile);

        cumulativeUploadedBytes += fileInfo.size;
        if (totalUploadBytes > 0) {
          job.driveUploadProgress = Math.min(1, cumulativeUploadedBytes / totalUploadBytes);
        }
        this.jobs.set(jobId, { ...job });
      }

      job.status = 'completed';
      job.statusMessage = `Transferência de ${job.driveFiles.length} arquivo(s) concluída com sucesso no Google Drive!`;
      job.driveUploadProgress = 1;
      job.completedAt = Date.now();
      job.currentUploadingFileName = undefined;

      // Clean up local temp files on disk
      try {
        fs.rmSync(downloadDir, { recursive: true, force: true });
      } catch (rmErr) {
        console.warn('Could not clean local temp files:', rmErr);
      }

      // Clean up engines
      const aria = this.ariaJobs.get(jobId);
      if (aria) {
        aria.stop();
        this.ariaJobs.delete(jobId);
      }

      const http = this.httpJobs.get(jobId);
      if (http) {
        this.httpJobs.delete(jobId);
      }

      const engine = this.torrentEngines.get(jobId);
      if (engine) {
        engine.destroy();
        this.torrentEngines.delete(jobId);
      }
    } catch (err: any) {
      console.error(`Google Drive upload failed for job ${jobId}:`, err);
      job.status = 'error';
      job.error = err.message || 'Erro no upload ao Google Drive';
      job.statusMessage = `Erro no envio ao Google Drive: ${job.error}`;
    }

    this.jobs.set(jobId, { ...job });
  }

  // 8. Pause Job
  public pauseJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // HTTP Job
    const http = this.httpJobs.get(jobId);
    if (http) {
      const ok = http.pause();
      if (ok) {
        job.status = 'paused';
        job.statusMessage = 'Download pausado';
        job.downloadSpeed = 0;
        return true;
      }
    }

    // Aria Job
    const aria = this.ariaJobs.get(jobId);
    if (aria) {
      const ok = aria.pause();
      if (ok) {
        job.status = 'paused';
        job.statusMessage = 'Download pausado';
        job.downloadSpeed = 0;
        return true;
      }
    }

    // Torrent Stream Job
    const engine = this.torrentEngines.get(jobId);
    if (engine && job.status === 'downloading') {
      job.files.forEach((f) => {
        const ef = engine.files[f.index];
        if (ef) ef.deselect();
      });
      job.status = 'paused';
      job.statusMessage = 'Download pausado';
      job.downloadSpeed = 0;
      return true;
    }
    return false;
  }

  // 9. Resume Job
  public resumeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // HTTP Job
    const http = this.httpJobs.get(jobId);
    if (http) {
      const ok = http.resume();
      if (ok) {
        job.status = 'downloading';
        job.statusMessage = 'Retomando download via HTTP...';
        return true;
      }
    }

    // Aria Job
    const aria = this.ariaJobs.get(jobId);
    if (aria) {
      const ok = aria.resume();
      if (ok) {
        job.status = 'downloading';
        job.statusMessage = 'Retomando download em alta velocidade...';
        return true;
      }
    }

    // Torrent Stream Job
    const engine = this.torrentEngines.get(jobId);
    if (engine && job.status === 'paused') {
      job.files.forEach((f) => {
        if (f.selected) {
          const ef = engine.files[f.index];
          if (ef) ef.select();
        }
      });
      job.status = 'downloading';
      job.statusMessage = 'Baixando blocos do torrent...';
      return true;
    }
    return false;
  }

  // 10. Cancel Job
  public cancelJob(jobId: string): boolean {
    const http = this.httpJobs.get(jobId);
    if (http) {
      http.cancel();
      this.httpJobs.delete(jobId);
    }

    const aria = this.ariaJobs.get(jobId);
    if (aria) {
      aria.stop();
      this.ariaJobs.delete(jobId);
    }

    const engine = this.torrentEngines.get(jobId);
    if (engine) {
      engine.destroy();
      this.torrentEngines.delete(jobId);
    }

    const downloadDir = path.join(os.tmpdir(), 'torrent-to-drive', jobId);
    try {
      fs.rmSync(downloadDir, { recursive: true, force: true });
    } catch {}

    this.jobs.delete(jobId);
    this.userTokens.delete(jobId);
    return true;
  }

  private updateTorrentStats() {
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'downloading' && job.engineType === 'torrent_stream') {
        const engine = this.torrentEngines.get(jobId);
        if (engine && engine.swarm) {
          job.peersCount = engine.swarm.wires.length;
          job.downloadSpeed = engine.swarm.downloadSpeed();
          job.uploadSpeed = engine.swarm.uploadSpeed();
          job.downloadedBytes = engine.swarm.downloaded;

          if (job.totalBytes > 0) {
            job.progress = Math.min(1, job.downloadedBytes / job.totalBytes);
            if (job.downloadSpeed > 0) {
              const remaining = Math.max(0, job.totalBytes - job.downloadedBytes);
              job.etaSeconds = Math.round(remaining / job.downloadSpeed);
            }
          }
        }
      }
    }
  }
}

export const transferManager = new TransferManager();
export const torrentManager = transferManager;
