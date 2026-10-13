import express, { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { transferManager } from './transferManager.ts';
import {
  getOrCreateDriveFolder,
  listDriveFiles,
  deleteDriveFile,
  getDriveStorageQuota,
} from './googleDrive.ts';

export const apiRouter = express.Router();

apiRouter.use(express.json({ limit: '100mb' }));
apiRouter.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Helper to extract bearer token
function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}

// ==========================================
// 1. HTTP / DIRECT URL ROUTES
// ==========================================

// Pre-flight inspection of an HTTP/HTTPS URL
apiRouter.post('/http/inspect', async (req: Request, res: Response) => {
  try {
    const { url, headers } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'URL é obrigatória' });
      return;
    }

    const info = await transferManager.inspectHttp(url.trim(), headers);
    res.json(info);
  } catch (err: any) {
    console.error('HTTP inspect error:', err);
    res.status(500).json({ error: err.message || 'Falha ao inspecionar link direto' });
  }
});

// Add direct URL download
apiRouter.post('/transfer/add-url', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Token do Google Drive necessário. Por favor, conecte sua conta.' });
      return;
    }

    const {
      url,
      folderName = 'Torrent to Google Drive',
      fileName,
      headers,
      autoUpload = true,
    } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'URL é obrigatória' });
      return;
    }

    const job = await transferManager.addDirectUrl({
      url: url.trim(),
      destinationFolder: folderName,
      accessToken: token,
      fileName: fileName?.trim() || undefined,
      headers,
      autoUploadToDrive: Boolean(autoUpload),
    });

    res.json(job);
  } catch (err: any) {
    console.error('Add URL download error:', err);
    res.status(500).json({ error: err.message || 'Falha ao iniciar download de link direto' });
  }
});

// Add batch URLs download
apiRouter.post('/transfer/add-batch', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Token do Google Drive necessário. Por favor, conecte sua conta.' });
      return;
    }

    const {
      urls,
      folderName = 'Torrent to Google Drive',
      autoUpload = true,
    } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({ error: 'Lista de URLs é obrigatória' });
      return;
    }

    const jobs = await transferManager.addBatchUrls({
      urls,
      destinationFolder: folderName,
      accessToken: token,
      autoUploadToDrive: Boolean(autoUpload),
    });

    res.json({ jobs, count: jobs.length });
  } catch (err: any) {
    console.error('Add batch URLs error:', err);
    res.status(500).json({ error: err.message || 'Falha ao adicionar links em lote' });
  }
});

// Upload local file directly to Google Drive (with temporary file disk buffer)
apiRouter.post('/transfer/upload-local', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Token do Google Drive necessário. Por favor, conecte sua conta.' });
      return;
    }

    const {
      fileName,
      fileBase64,
      folderName = 'Torrent to Google Drive',
    } = req.body;

    if (!fileName || !fileBase64) {
      res.status(400).json({ error: 'Nome do arquivo e conteúdo são obrigatórios' });
      return;
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const tempDir = path.join(os.tmpdir(), 'torrent-to-drive-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(
      tempDir,
      `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${path.basename(fileName)}`
    );
    fs.writeFileSync(tempFilePath, buffer);

    const job = await transferManager.addLocalUpload({
      fileName,
      fileSize: buffer.length,
      localFilePath: tempFilePath,
      destinationFolder: folderName,
      accessToken: token,
    });

    res.json(job);
  } catch (err: any) {
    console.error('Local upload error:', err);
    res.status(500).json({ error: err.message || 'Falha no upload do arquivo local' });
  }
});

// ==========================================
// 2. TORRENT SPECIFIC ROUTES (Backwards-compatible)
// ==========================================

apiRouter.post('/torrent/inspect', async (req: Request, res: Response) => {
  try {
    const { magnet, torrentBase64 } = req.body;
    let source: string | Buffer;

    if (torrentBase64) {
      source = Buffer.from(torrentBase64, 'base64');
    } else if (magnet) {
      source = magnet.trim();
    } else {
      res.status(400).json({ error: 'Forneça um link magnet ou um arquivo .torrent' });
      return;
    }

    const info = await transferManager.inspectTorrent(source);
    res.json(info);
  } catch (err: any) {
    console.error('Torrent inspect error:', err);
    res.status(500).json({ error: err.message || 'Falha ao inspecionar torrent' });
  }
});

apiRouter.post('/torrent/add', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const {
      magnet,
      torrentBase64,
      folderName = 'Torrent to Google Drive',
      selectedFiles,
      autoUpload = true,
    } = req.body;

    if (!token) {
      res.status(401).json({ error: 'Token do Google Drive necessário. Por favor, conecte sua conta.' });
      return;
    }

    let source: string | Buffer;
    if (torrentBase64) {
      source = Buffer.from(torrentBase64, 'base64');
    } else if (magnet) {
      source = magnet.trim();
    } else {
      res.status(400).json({ error: 'Forneça um link magnet ou um arquivo .torrent' });
      return;
    }

    const job = await transferManager.addTorrent({
      source,
      destinationFolder: folderName,
      accessToken: token,
      selectedFileIndices: Array.isArray(selectedFiles) ? selectedFiles : undefined,
      autoUploadToDrive: Boolean(autoUpload),
    });

    res.json(job);
  } catch (err: any) {
    console.error('Add torrent error:', err);
    res.status(500).json({ error: err.message || 'Falha ao adicionar torrent' });
  }
});

// Aliases for torrent status/list
apiRouter.get('/torrent/list', (_req: Request, res: Response) => {
  res.json(transferManager.getJobs());
});

apiRouter.get('/torrent/status/:id', (req: Request, res: Response) => {
  const job = transferManager.getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Transferência não encontrada' });
    return;
  }
  res.json(job);
});

apiRouter.post('/torrent/:id/upload', async (req: Request, res: Response) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Token de autorização do Google Drive necessário.' });
    return;
  }

  const job = transferManager.getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Trabalho não encontrado' });
    return;
  }

  transferManager.triggerDriveUpload(req.params.id, token).catch((err) => {
    console.error('Trigger drive upload failed:', err);
  });

  res.json({ success: true, message: 'Upload para o Drive iniciado' });
});

apiRouter.post('/torrent/:id/pause', (req: Request, res: Response) => {
  const ok = transferManager.pauseJob(req.params.id);
  res.json({ success: ok });
});

apiRouter.post('/torrent/:id/resume', (req: Request, res: Response) => {
  const ok = transferManager.resumeJob(req.params.id);
  res.json({ success: ok });
});

apiRouter.delete('/torrent/:id', (req: Request, res: Response) => {
  const ok = transferManager.cancelJob(req.params.id);
  res.json({ success: ok });
});

// ==========================================
// 3. UNIFIED TRANSFER MANAGEMENT ROUTES
// ==========================================

apiRouter.get('/transfer/list', (_req: Request, res: Response) => {
  res.json(transferManager.getJobs());
});

apiRouter.get('/transfer/status/:id', (req: Request, res: Response) => {
  const job = transferManager.getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Transferência não encontrada' });
    return;
  }
  res.json(job);
});

apiRouter.post('/transfer/:id/upload', async (req: Request, res: Response) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Token do Google Drive necessário.' });
    return;
  }

  const job = transferManager.getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Transferência não encontrada' });
    return;
  }

  transferManager.triggerDriveUpload(req.params.id, token).catch((err) => {
    console.error('Drive upload trigger failed:', err);
  });

  res.json({ success: true, message: 'Envio ao Drive iniciado' });
});

apiRouter.post('/transfer/:id/pause', (req: Request, res: Response) => {
  const ok = transferManager.pauseJob(req.params.id);
  res.json({ success: ok });
});

apiRouter.post('/transfer/:id/resume', (req: Request, res: Response) => {
  const ok = transferManager.resumeJob(req.params.id);
  res.json({ success: ok });
});

apiRouter.delete('/transfer/:id', (req: Request, res: Response) => {
  const ok = transferManager.cancelJob(req.params.id);
  res.json({ success: ok });
});

// ==========================================
// 4. GOOGLE DRIVE ROUTES & STORAGE QUOTA
// ==========================================

// Get user Drive storage quota
apiRouter.get('/drive/quota', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Não autorizado: token do Google Drive ausente' });
      return;
    }

    const quota = await getDriveStorageQuota(token);
    res.json(quota);
  } catch (err: any) {
    console.error('Drive quota error:', err);
    res.status(500).json({ error: err.message || 'Falha ao buscar cota do Drive' });
  }
});

// List files in destination folder
apiRouter.get('/drive/files', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Não autorizado: token do Google Drive ausente' });
      return;
    }

    const folderName = (req.query.folderName as string) || 'Torrent to Google Drive';
    const folder = await getOrCreateDriveFolder(folderName, token);
    const files = await listDriveFiles(folder.id, token);

    res.json({ folder, files });
  } catch (err: any) {
    console.error('Drive files error:', err);
    res.status(500).json({ error: err.message || 'Falha ao listar arquivos do Drive' });
  }
});

// Delete a file
apiRouter.delete('/drive/files/:fileId', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Não autorizado: token do Google Drive ausente' });
      return;
    }

    await deleteDriveFile(req.params.fileId, token);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete Drive file error:', err);
    res.status(500).json({ error: err.message || 'Falha ao excluir arquivo do Drive' });
  }
});
