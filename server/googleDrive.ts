import fs from 'node:fs';
import path from 'node:path';

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.7z': 'application/x-7z-compressed',
  '.iso': 'application/x-iso9660-image',
  '.img': 'application/octet-stream',
  '.txt': 'text/plain',
  '.srt': 'text/plain',
  '.vtt': 'text/vtt',
  '.nfo': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface UploadedDriveFile {
  id: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
  mimeType?: string;
}

export async function getOrCreateDriveFolder(
  folderName: string,
  accessToken: string,
  parentFolderId?: string
): Promise<DriveFolder> {
  try {
    const escapedName = folderName.replace(/'/g, "\\'");
    let q = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentFolderId) {
      q += ` and '${parentFolderId}' in parents`;
    }
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return { id: data.files[0].id, name: data.files[0].name };
      }
    }

    // Create folder
    const body: Record<string, any> = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentFolderId) {
      body.parents = [parentFolderId];
    }

    const createRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?fields=id,name',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Google Drive folder creation failed (${createRes.status}): ${errText}`);
    }

    const folder = await createRes.json();
    return { id: folder.id, name: folder.name };
  } catch (err: any) {
    console.error('Error in getOrCreateDriveFolder:', err);
    throw err;
  }
}

export async function uploadFileToGoogleDrive({
  filePath,
  fileName,
  fileSize,
  mimeType,
  folderId,
  accessToken,
  onProgress,
}: {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  folderId?: string;
  accessToken: string;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
}): Promise<UploadedDriveFile> {
  const resolvedMime = mimeType || getMimeType(fileName);

  // 1. Initiate Resumable Upload
  const metadata: Record<string, any> = {
    name: fileName,
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const initUrl =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink,size,mimeType';

  const initRes = await fetch(initUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': resolvedMime,
      'X-Upload-Content-Length': String(fileSize),
    },
    body: JSON.stringify(metadata),
  });

  if (!initRes.ok) {
    const errorText = await initRes.text();
    throw new Error(`Google Drive initiate upload failed (${initRes.status}): ${errorText}`);
  }

  const locationUrl = initRes.headers.get('Location');
  if (!locationUrl) {
    throw new Error('Google Drive upload did not return a Location header');
  }

  // Handle empty 0-byte file
  if (fileSize === 0) {
    const emptyRes = await fetch(locationUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': '0',
      },
    });
    if (!emptyRes.ok) {
      throw new Error(`Upload of empty file failed: ${await emptyRes.text()}`);
    }
    const emptyData = await emptyRes.json();
    return emptyData;
  }

  // 2. Upload in chunks of 16MB for high speed throughput (must be multiple of 256KB: 16 * 1024 * 1024 = 16777216 bytes)
  // For small files (< 32MB), use 8MB chunks
  const CHUNK_SIZE = fileSize > 32 * 1024 * 1024 ? 16 * 1024 * 1024 : 8 * 1024 * 1024;
  let offset = 0;
  const fileDescriptor = fs.openSync(filePath, 'r');

  try {
    while (offset < fileSize) {
      const currentChunkSize = Math.min(CHUNK_SIZE, fileSize - offset);
      const buffer = Buffer.alloc(currentChunkSize);
      fs.readSync(fileDescriptor, buffer, 0, currentChunkSize, offset);

      const start = offset;
      const end = offset + currentChunkSize - 1;

      let retries = 0;
      let success = false;
      let chunkResponse: Response | null = null;

      while (!success && retries < 3) {
        try {
          chunkResponse = await fetch(locationUrl, {
            method: 'PUT',
            headers: {
              'Content-Length': String(currentChunkSize),
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            },
            body: buffer,
          });

          // 308: Resume Incomplete (expected for intermediate chunks)
          // 200 or 201: Upload complete (for the final chunk)
          if (chunkResponse.status === 308 || chunkResponse.status === 200 || chunkResponse.status === 201) {
            success = true;
          } else {
            retries++;
            const errBody = await chunkResponse.text();
            console.warn(`Chunk upload retry ${retries} (${chunkResponse.status}): ${errBody}`);
            await new Promise((r) => setTimeout(r, 1000 * retries));
          }
        } catch (fetchErr) {
          retries++;
          console.warn(`Chunk upload network error retry ${retries}:`, fetchErr);
          await new Promise((r) => setTimeout(r, 1000 * retries));
        }
      }

      if (!success || !chunkResponse) {
        throw new Error(`Failed to upload chunk at offset ${offset} after 3 attempts`);
      }

      offset += currentChunkSize;
      if (onProgress) {
        onProgress(offset, fileSize);
      }

      if (chunkResponse.status === 200 || chunkResponse.status === 201) {
        const fileData = await chunkResponse.json();
        return fileData;
      }
    }
  } finally {
    fs.closeSync(fileDescriptor);
  }

  throw new Error('Upload stream finished without receiving Google Drive file response');
}

/**
 * Upload direto via Stream contínuo (Modo Tubo / Zero Disco).
 * Envia blocos de 16MB direto da memória para o Google Drive sem salvar nada no HD do servidor!
 */
export async function uploadStreamToGoogleDrive({
  stream,
  fileName,
  fileSize,
  mimeType,
  folderId,
  accessToken,
  onProgress,
}: {
  stream: NodeJS.ReadableStream;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  folderId?: string;
  accessToken: string;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
}): Promise<UploadedDriveFile> {
  const resolvedMime = mimeType || getMimeType(fileName);

  // 1. Iniciar Resumable Upload
  const metadata: Record<string, any> = { name: fileName };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const initUrl =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink,size,mimeType';

  const initHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': resolvedMime,
  };
  if (fileSize > 0) {
    initHeaders['X-Upload-Content-Length'] = String(fileSize);
  }

  const initRes = await fetch(initUrl, {
    method: 'POST',
    headers: initHeaders,
    body: JSON.stringify(metadata),
  });

  if (!initRes.ok) {
    const errorText = await initRes.text();
    throw new Error(`Google Drive initiate upload failed (${initRes.status}): ${errorText}`);
  }

  const locationUrl = initRes.headers.get('Location');
  if (!locationUrl) {
    throw new Error('Google Drive upload did not return a Location header');
  }

  // 2. Transmissão em blocos de 16MB com controle de backpressure (pausa/retomada)
  const CHUNK_SIZE = 16 * 1024 * 1024; // 16MB múltiplos de 256KB
  let offset = 0;
  let bufferedChunks: Buffer[] = [];
  let bufferedLength = 0;
  let finalUploadedData: UploadedDriveFile | null = null;

  async function uploadChunk(chunkBuffer: Buffer, isLastChunk: boolean): Promise<UploadedDriveFile | null> {
    const currentChunkSize = chunkBuffer.length;
    if (currentChunkSize === 0 && !isLastChunk) return null;

    const start = offset;
    const end = offset + currentChunkSize - 1;
    const totalSizeStr = fileSize > 0 ? String(fileSize) : (isLastChunk ? String(end + 1) : '*');

    let retries = 0;
    let success = false;
    let chunkResponse: Response | null = null;

    while (!success && retries < 4) {
      try {
        chunkResponse = await fetch(locationUrl!, {
          method: 'PUT',
          headers: {
            'Content-Length': String(currentChunkSize),
            'Content-Range': `bytes ${start}-${end}/${totalSizeStr}`,
          },
          body: chunkBuffer,
        });

        if (chunkResponse.status === 308 || chunkResponse.status === 200 || chunkResponse.status === 201) {
          success = true;
        } else {
          retries++;
          const errBody = await chunkResponse.text();
          console.warn(`Stream chunk upload retry ${retries} (${chunkResponse.status}): ${errBody}`);
          await new Promise((r) => setTimeout(r, 1000 * retries));
        }
      } catch (fetchErr) {
        retries++;
        console.warn(`Stream chunk upload network retry ${retries}:`, fetchErr);
        await new Promise((r) => setTimeout(r, 1000 * retries));
      }
    }

    if (!success || !chunkResponse) {
      throw new Error(`Falha ao enviar bloco de dados da memória no offset ${offset}`);
    }

    offset += currentChunkSize;
    if (onProgress) {
      onProgress(offset, fileSize > 0 ? fileSize : offset);
    }

    if (chunkResponse.status === 200 || chunkResponse.status === 201) {
      return (await chunkResponse.json()) as UploadedDriveFile;
    }
    return null;
  }

  return new Promise<UploadedDriveFile>((resolve, reject) => {
    let processing = false;
    let streamEnded = false;

    async function processQueue() {
      if (processing) return;
      processing = true;

      try {
        while (bufferedLength >= CHUNK_SIZE) {
          // Extrair exatamente CHUNK_SIZE
          const combined = Buffer.concat(bufferedChunks);
          const chunkToSend = combined.subarray(0, CHUNK_SIZE);
          const remainder = combined.subarray(CHUNK_SIZE);

          bufferedChunks = remainder.length > 0 ? [remainder] : [];
          bufferedLength = remainder.length;

          const isLast = streamEnded && bufferedLength === 0 && (fileSize <= 0 || offset + CHUNK_SIZE >= fileSize);
          const result = await uploadChunk(chunkToSend, isLast);
          if (result) {
            finalUploadedData = result;
          }
        }

        // Se o fluxo terminou, enviar o resto pendente
        if (streamEnded && bufferedLength > 0) {
          const finalBuffer = Buffer.concat(bufferedChunks);
          bufferedChunks = [];
          bufferedLength = 0;
          const result = await uploadChunk(finalBuffer, true);
          if (result) {
            finalUploadedData = result;
          }
        }

        if (streamEnded && bufferedLength === 0) {
          if (finalUploadedData) {
            resolve(finalUploadedData);
          } else {
            // Caso especial de confirmação final
            const statusRes = await fetch(locationUrl!, {
              method: 'PUT',
              headers: {
                'Content-Range': `bytes */${fileSize > 0 ? fileSize : offset}`,
              },
            });
            if (statusRes.ok) {
              resolve((await statusRes.json()) as UploadedDriveFile);
            } else {
              reject(new Error('Envio concluído mas resposta final do Drive não recebida'));
            }
          }
          return;
        }

        // Retomar fluxo de entrada se buffer esvaziou
        if (!streamEnded && bufferedLength < CHUNK_SIZE) {
          if (typeof (stream as any).resume === 'function') {
            (stream as any).resume();
          }
        }
      } catch (err) {
        reject(err);
      } finally {
        processing = false;
      }
    }

    stream.on('data', (chunk: Buffer) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bufferedChunks.push(buf);
      bufferedLength += buf.length;

      // Se acumulou bastante dados, pausa stream para evitar consumo de RAM
      if (bufferedLength >= CHUNK_SIZE * 2) {
        if (typeof (stream as any).pause === 'function') {
          (stream as any).pause();
        }
      }

      processQueue().catch(reject);
    });

    stream.on('end', () => {
      streamEnded = true;
      processQueue().catch(reject);
    });

    stream.on('error', (err: any) => {
      reject(err);
    });
  });
}

export async function listDriveFiles(folderId: string, accessToken: string): Promise<UploadedDriveFile[]> {
  const q = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink,webContentLink,size,mimeType)&orderBy=createdTime desc&spaces=drive`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to list files (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.files || [];
}

export async function deleteDriveFile(fileId: string, accessToken: string): Promise<boolean> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to delete file (${res.status}): ${errText}`);
  }
  return true;
}

export interface DriveQuotaInfo {
  limit: number; // in bytes, 0 or -1 if unlimited
  usage: number; // in bytes
  usageInDrive: number;
  usageInDriveTrash: number;
  usagePercentage: number;
  user?: {
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  };
}

export async function getDriveStorageQuota(accessToken: string): Promise<DriveQuotaInfo> {
  const url = 'https://www.googleapis.com/drive/v3/about?fields=storageQuota,user';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch Drive storage quota (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const quota = data.storageQuota || {};
  const limit = quota.limit ? parseInt(quota.limit, 10) : 0;
  const usage = quota.usage ? parseInt(quota.usage, 10) : 0;
  const usageInDrive = quota.usageInDrive ? parseInt(quota.usageInDrive, 10) : 0;
  const usageInDriveTrash = quota.usageInDriveTrash ? parseInt(quota.usageInDriveTrash, 10) : 0;
  const usagePercentage = limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 0;

  return {
    limit,
    usage,
    usageInDrive,
    usageInDriveTrash,
    usagePercentage,
    user: data.user,
  };
}
