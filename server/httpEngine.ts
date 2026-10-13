import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export interface HttpProgress {
  downloadedBytes: number;
  totalBytes: number;
  progress: number; // 0 to 1
  downloadSpeed: number; // bytes/sec
  etaSeconds: number | null;
  fileName: string;
}

export interface HttpInspectInfo {
  url: string;
  fileName: string;
  totalBytes: number;
  contentType: string;
  acceptRanges: boolean;
}

/**
 * Extracts a suggested filename from Content-Disposition header or URL path
 */
export function extractFileName(dispositionHeader: string | null | undefined, urlStr: string): string {
  if (dispositionHeader) {
    // Check filename*=UTF-8''...
    const utf8Match = dispositionHeader.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        return decodeURIComponent(utf8Match[1].trim());
      } catch {}
    }
    // Check filename="..." or filename=...
    const match = dispositionHeader.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) {
      return path.basename(match[1].trim());
    }
  }

  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname;
    const base = path.basename(pathname);
    if (base && base.includes('.')) {
      return decodeURIComponent(base);
    }
    if (base && base.length > 0) {
      return decodeURIComponent(base);
    }
  } catch {}

  return `download-${Date.now()}`;
}

/**
 * Inspect an HTTP/HTTPS URL using HEAD (or GET range) to get metadata
 */
export async function inspectHttpUrl(
  urlStr: string,
  headers?: Record<string, string>
): Promise<HttpInspectInfo> {
  const parsed = new URL(urlStr);
  const isHttps = parsed.protocol === 'https:';
  const client = isHttps ? https : http;

  const requestHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: '*/*',
    ...(headers || {}),
  };

  return new Promise<HttpInspectInfo>((resolve, reject) => {
    const doRequest = (method: 'HEAD' | 'GET', redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Muitos redirecionamentos'));
        return;
      }

      const reqHeaders = { ...requestHeaders };
      if (method === 'GET') {
        reqHeaders['Range'] = 'bytes=0-0'; // just 1 byte to get content-range
      }

      const req = client.request(
        urlStr,
        {
          method,
          headers: reqHeaders,
          timeout: 15000,
        },
        (res) => {
          // Follow redirects (301, 302, 303, 307, 308)
          if (
            res.statusCode &&
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            const redirectUrl = new URL(res.headers.location, urlStr).toString();
            res.resume();
            return inspectHttpUrl(redirectUrl, headers)
              .then(resolve)
              .catch(reject);
          }

          if (res.statusCode && res.statusCode >= 400 && method === 'HEAD') {
            // Some servers reject HEAD requests; fallback to GET with Range
            res.resume();
            return doRequest('GET', redirectCount);
          }

          const disposition = res.headers['content-disposition'] as string | undefined;
          const fileName = extractFileName(disposition, urlStr);
          const contentType = (res.headers['content-type'] as string) || 'application/octet-stream';
          const acceptRanges = res.headers['accept-ranges'] === 'bytes' || res.statusCode === 206;

          let totalBytes = 0;
          if (res.headers['content-range']) {
            const rangeMatch = (res.headers['content-range'] as string).match(/\/(\d+)/);
            if (rangeMatch) {
              totalBytes = parseInt(rangeMatch[1], 10);
            }
          }
          if (!totalBytes && res.headers['content-length']) {
            totalBytes = parseInt(res.headers['content-length'] as string, 10) || 0;
          }

          res.resume();
          resolve({
            url: urlStr,
            fileName,
            totalBytes,
            contentType,
            acceptRanges,
          });
        }
      );

      req.on('error', (err) => {
        if (method === 'HEAD') {
          doRequest('GET', redirectCount);
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy(new Error('Tempo limite excedido ao inspecionar URL'));
      });

      req.end();
    };

    doRequest('HEAD');
  });
}

export interface HttpDownloadOptions {
  url: string;
  downloadDir: string;
  fileName?: string;
  headers?: Record<string, string>;
  onProgress: (p: HttpProgress) => void;
  onComplete: (file: { fullPath: string; fileName: string; size: number }) => void;
  onError: (err: Error) => void;
}

export class HttpDownloadJob {
  public isRunning = false;
  public isPaused = false;
  private isCancelled = false;
  private currentReq: http.ClientRequest | null = null;
  private currentRes: http.IncomingMessage | null = null;
  private fileStream: fs.WriteStream | null = null;

  private downloadedBytes = 0;
  private totalBytes = 0;
  private finalFileName = '';
  private fullFilePath = '';

  private speedSamples: Array<{ time: number; bytes: number }> = [];
  private lastSpeed = 0;

  constructor(private options: HttpDownloadOptions) {}

  public async start() {
    this.isCancelled = false;
    this.isPaused = false;
    this.isRunning = true;

    const { url, downloadDir, fileName: customFileName, headers } = this.options;

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    try {
      // 1. Inspect URL first if we don't have filename or size
      let detectedName = customFileName;
      try {
        const info = await inspectHttpUrl(url, headers);
        if (!detectedName) {
          detectedName = info.fileName;
        }
        if (info.totalBytes > 0) {
          this.totalBytes = info.totalBytes;
        }
      } catch (inspectErr) {
        // Fallback: extract from URL
        if (!detectedName) {
          detectedName = extractFileName(null, url);
        }
      }

      this.finalFileName = detectedName || `download-${Date.now()}`;
      this.fullFilePath = path.join(downloadDir, this.finalFileName);

      // Check if partially downloaded
      if (fs.existsSync(this.fullFilePath)) {
        const stat = fs.statSync(this.fullFilePath);
        this.downloadedBytes = stat.size;
      } else {
        this.downloadedBytes = 0;
      }

      this.executeStreamDownload(url, headers);
    } catch (err: any) {
      this.isRunning = false;
      this.options.onError(err);
    }
  }

  private executeStreamDownload(
    currentUrl: string,
    customHeaders?: Record<string, string>,
    redirectCount = 0
  ) {
    if (this.isCancelled) return;

    if (redirectCount > 8) {
      this.isRunning = false;
      this.options.onError(new Error('Excedido o limite de redirecionamentos HTTP'));
      return;
    }

    const parsed = new URL(currentUrl);
    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: '*/*',
      ...(customHeaders || {}),
    };

    const isResume = this.downloadedBytes > 0;
    if (isResume) {
      requestHeaders['Range'] = `bytes=${this.downloadedBytes}-`;
    }

    const req = client.request(
      currentUrl,
      {
        method: 'GET',
        headers: requestHeaders,
      },
      (res) => {
        this.currentRes = res;

        // Follow Redirects
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          const redirectUrl = new URL(res.headers.location, currentUrl).toString();
          res.resume();
          return this.executeStreamDownload(redirectUrl, customHeaders, redirectCount + 1);
        }

        // Check if server rejected Range or doesn't support it
        let startFromZero = false;
        if (isResume && res.statusCode === 200) {
          // Server doesn't support Range, restarts from beginning
          startFromZero = true;
          this.downloadedBytes = 0;
        } else if (res.statusCode && res.statusCode >= 400) {
          this.isRunning = false;
          this.options.onError(
            new Error(`Erro HTTP ${res.statusCode} ao baixar arquivo: ${res.statusMessage}`)
          );
          return;
        }

        // Update totalBytes if known
        if (res.headers['content-range']) {
          const match = (res.headers['content-range'] as string).match(/\/(\d+)/);
          if (match) {
            this.totalBytes = parseInt(match[1], 10);
          }
        } else if (res.headers['content-length']) {
          const cl = parseInt(res.headers['content-length'] as string, 10);
          if (cl) {
            this.totalBytes = startFromZero || !isResume ? cl : this.downloadedBytes + cl;
          }
        }

        // Check if content disposition has better filename
        const disposition = res.headers['content-disposition'] as string | undefined;
        if (disposition && (!this.options.fileName || this.finalFileName.startsWith('download-'))) {
          const betterName = extractFileName(disposition, currentUrl);
          if (betterName && betterName !== this.finalFileName) {
            const oldPath = this.fullFilePath;
            this.finalFileName = betterName;
            this.fullFilePath = path.join(this.options.downloadDir, this.finalFileName);
            if (fs.existsSync(oldPath)) {
              try {
                fs.renameSync(oldPath, this.fullFilePath);
              } catch {}
            }
          }
        }

        // Open write stream (append if resuming, or create new)
        const fileFlags = isResume && !startFromZero ? 'a' : 'w';
        this.fileStream = fs.createWriteStream(this.fullFilePath, { flags: fileFlags });

        res.on('data', (chunk: Buffer) => {
          if (this.isCancelled) {
            res.destroy();
            return;
          }

          this.downloadedBytes += chunk.length;
          this.updateSpeed(chunk.length);

          const progress =
            this.totalBytes > 0
              ? Math.min(1, this.downloadedBytes / this.totalBytes)
              : 0;

          const eta =
            this.lastSpeed > 0 && this.totalBytes > this.downloadedBytes
              ? Math.round((this.totalBytes - this.downloadedBytes) / this.lastSpeed)
              : null;

          this.options.onProgress({
            downloadedBytes: this.downloadedBytes,
            totalBytes: this.totalBytes,
            progress,
            downloadSpeed: this.lastSpeed,
            etaSeconds: eta,
            fileName: this.finalFileName,
          });
        });

        res.pipe(this.fileStream);

        this.fileStream.on('finish', () => {
          if (this.isPaused || this.isCancelled) return;
          this.isRunning = false;

          let size = this.downloadedBytes;
          try {
            if (fs.existsSync(this.fullFilePath)) {
              size = fs.statSync(this.fullFilePath).size;
            }
          } catch {}

          this.options.onComplete({
            fullPath: this.fullFilePath,
            fileName: this.finalFileName,
            size,
          });
        });

        res.on('error', (err) => {
          if (this.isPaused || this.isCancelled) return;
          this.isRunning = false;
          this.options.onError(err);
        });

        this.fileStream.on('error', (err) => {
          this.isRunning = false;
          this.options.onError(err);
        });
      }
    );

    this.currentReq = req;

    req.on('error', (err) => {
      if (this.isPaused || this.isCancelled) return;
      this.isRunning = false;
      this.options.onError(err);
    });

    req.end();
  }

  private updateSpeed(bytesAdded: number) {
    const now = Date.now();
    this.speedSamples.push({ time: now, bytes: bytesAdded });
    // Keep last 3 seconds
    const cutoff = now - 3000;
    this.speedSamples = this.speedSamples.filter((s) => s.time >= cutoff);

    if (this.speedSamples.length > 1) {
      const totalSampleBytes = this.speedSamples.reduce((acc, s) => acc + s.bytes, 0);
      const timeDiff = (now - this.speedSamples[0].time) / 1000;
      this.lastSpeed = timeDiff > 0 ? Math.round(totalSampleBytes / timeDiff) : 0;
    }
  }

  public pause(): boolean {
    if (this.isRunning && !this.isPaused) {
      this.isPaused = true;
      this.isRunning = false;
      if (this.currentRes) {
        this.currentRes.destroy();
      }
      if (this.currentReq) {
        this.currentReq.destroy();
      }
      if (this.fileStream) {
        this.fileStream.end();
      }
      return true;
    }
    return false;
  }

  public resume(): boolean {
    if (this.isPaused) {
      this.isPaused = false;
      this.isRunning = true;
      this.executeStreamDownload(this.options.url, this.options.headers);
      return true;
    }
    return false;
  }

  public cancel(): boolean {
    this.isCancelled = true;
    this.isRunning = false;
    this.isPaused = false;

    if (this.currentRes) {
      this.currentRes.destroy();
    }
    if (this.currentReq) {
      this.currentReq.destroy();
    }
    if (this.fileStream) {
      this.fileStream.end();
    }

    try {
      if (fs.existsSync(this.fullFilePath)) {
        fs.unlinkSync(this.fullFilePath);
      }
    } catch {}

    return true;
  }
}
