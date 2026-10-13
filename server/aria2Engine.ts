import { spawn, execSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface AriaProgress {
  gid?: string;
  downloadedBytes: number;
  totalBytes: number;
  progress: number; // 0 to 1
  peersCount: number;
  seedsCount: number;
  downloadSpeed: number; // bytes/sec
  uploadSpeed: number;
  etaSeconds: number | null;
  currentFileName?: string;
}

function parseSize(str: string): number {
  if (!str) return 0;
  const units: Record<string, number> = {
    B: 1,
    KiB: 1024,
    MiB: 1024 * 1024,
    GiB: 1024 * 1024 * 1024,
    TiB: 1024 * 1024 * 1024 * 1024,
    KB: 1000,
    MB: 1000000,
    GB: 1000000000,
  };
  const match = str.trim().match(/^([\d\.]+)\s*([A-Za-z]+)$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const mult = units[match[2]] || 1;
  return Math.round(num * mult);
}

function parseEta(etaStr?: string): number | null {
  if (!etaStr) return null;
  const sMatch = etaStr.match(/(\d+)s/);
  const mMatch = etaStr.match(/(\d+)m/);
  const hMatch = etaStr.match(/(\d+)h/);

  let total = 0;
  if (hMatch) total += parseInt(hMatch[1], 10) * 3600;
  if (mMatch) total += parseInt(mMatch[1], 10) * 60;
  if (sMatch) total += parseInt(sMatch[1], 10);

  return total > 0 ? total : null;
}

export class Aria2DownloadJob {
  private proc: ChildProcess | null = null;
  public isRunning = false;
  public isPaused = false;
  public lastProgress: AriaProgress = {
    downloadedBytes: 0,
    totalBytes: 0,
    progress: 0,
    peersCount: 0,
    seedsCount: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    etaSeconds: null,
  };

  constructor(
    private options: {
      source: string; // magnet link or path to .torrent file
      downloadDir: string;
      trackers: string[];
      selectedFiles?: number[];
      onProgress: (p: AriaProgress) => void;
      onComplete: (downloadedFiles: Array<{ fullPath: string; relativePath: string; size: number }>) => void;
      onError: (err: Error) => void;
    }
  ) {}

  public start() {
    const { source, downloadDir, trackers, selectedFiles } = this.options;

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const args = [
      `--dir=${downloadDir}`,
      `--bt-tracker=${trackers.join(',')}`,
      '--enable-dht=true',
      '--bt-enable-lpd=true',
      '--enable-peer-exchange=true',
      '--bt-max-peers=500',
      '--bt-max-open-files=500',
      '--max-connection-per-server=16',
      '--split=32',
      '--min-split-size=1M',
      '--disk-cache=32M',
      '--peer-id-prefix=-qB4630-',
      '--peer-agent=qBittorrent/4.6.3',
      '--user-agent=qBittorrent/4.6.3',
      '--bt-request-peer-speed-limit=50M',
      '--max-upload-limit=0', // Reciprocal unchoking (tit-for-tat)
      '--bt-seed-unverified=true',
      '--bt-tracker-connect-timeout=10',
      '--bt-tracker-timeout=10',
      '--dht-message-timeout=5',
      '--summary-interval=1',
      '--allow-overwrite=true',
      '--auto-file-renaming=false',
      '--file-allocation=none',
      '--socket-recv-buffer-size=1M',
      '--bt-stop-timeout=0',
    ];

    if (selectedFiles && selectedFiles.length > 0) {
      // aria2 1-based indexing
      const indexes = selectedFiles.map((idx) => idx + 1).join(',');
      args.push(`--select-file=${indexes}`);
    }

    args.push(source);

    this.proc = spawn('aria2c', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.isRunning = true;

    const progressRegex =
      /\[#(?:\w+)\s+([\d\.]+[A-Za-z]+)\/([\d\.]+[A-Za-z]+)\((\d+)%\)\s+CN:(\d+)\s+SD:(\d+)\s+DL:([\d\.]+[A-Za-z]+)(?:\s+ETA:([^\]]+))?\]/;

    let buffer = '';

    this.proc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const m = line.match(progressRegex);
        if (m) {
          const downloadedBytes = parseSize(m[1]);
          const totalBytes = parseSize(m[2]);
          const pct = parseInt(m[3], 10);
          const peers = parseInt(m[4], 10);
          const seeds = parseInt(m[5], 10);
          const speed = parseSize(m[6]);
          const eta = parseEta(m[7]);

          this.lastProgress = {
            downloadedBytes,
            totalBytes,
            progress: totalBytes > 0 ? downloadedBytes / totalBytes : pct / 100,
            peersCount: peers + seeds,
            seedsCount: seeds,
            downloadSpeed: speed,
            uploadSpeed: Math.round(speed * 0.05), // Estimated upload reciprocity
            etaSeconds: eta,
          };

          this.options.onProgress(this.lastProgress);
        }

        if (line.includes('FILE:')) {
          const fileName = line.replace('FILE:', '').trim();
          this.lastProgress.currentFileName = fileName;
        }
      }
    });

    this.proc.stderr?.on('data', (data: Buffer) => {
      console.warn('[aria2c err]:', data.toString().trim());
    });

    this.proc.on('close', (code) => {
      this.isRunning = false;
      if (code === 0) {
        // Find all downloaded files in downloadDir (excluding .aria2)
        const files = this.scanDir(downloadDir, downloadDir);
        this.options.onComplete(files);
      } else if (!this.isPaused) {
        this.options.onError(new Error(`Aria2 process exited with code ${code}`));
      }
    });

    this.proc.on('error', (err) => {
      this.isRunning = false;
      this.options.onError(err);
    });
  }

  private scanDir(dir: string, rootDir: string): Array<{ fullPath: string; relativePath: string; size: number }> {
    let results: Array<{ fullPath: string; relativePath: string; size: number }> = [];
    if (!fs.existsSync(dir)) return results;

    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item.endsWith('.aria2')) continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(this.scanDir(fullPath, rootDir));
      } else if (stat.size > 0) {
        results.push({
          fullPath,
          relativePath: path.relative(rootDir, fullPath),
          size: stat.size,
        });
      }
    }
    return results;
  }

  public pause(): boolean {
    if (this.proc && this.isRunning && !this.isPaused) {
      if (process.platform !== 'win32') {
        try {
          this.proc.kill('SIGSTOP');
        } catch {}
      }
      this.isPaused = true;
      return true;
    }
    return false;
  }

  public resume(): boolean {
    if (this.proc && this.isRunning && this.isPaused) {
      if (process.platform !== 'win32') {
        try {
          this.proc.kill('SIGCONT');
        } catch {}
      }
      this.isPaused = false;
      return true;
    }
    return false;
  }

  public stop(): boolean {
    if (this.proc) {
      try {
        if (process.platform === 'win32' && this.proc.pid) {
          execSync(`taskkill /pid ${this.proc.pid} /T /F`, { stdio: 'ignore' });
        } else {
          this.proc.kill('SIGKILL');
        }
      } catch {
        try {
          this.proc.kill();
        } catch {}
      }
      this.proc = null;
      this.isRunning = false;
      return true;
    }
    return false;
  }
}
