/**
 * Google Drive Storage Service
 *
 * Reads and writes files to a user's connected Google Drive.
 * Uses the Drive REST API v3 directly via fetch — no extra SDK needed.
 *
 * All content is stored in QMD format under a "Synthex" root folder.
 * Default root: 1ltNpRqa8dVa-e_qqd0gPFCeuVpiqn__B (configurable per user)
 */

const DRIVE_API    = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

// Default Synthex root folder ID (owner's Drive)
export const DEFAULT_SYNTHEX_FOLDER_ID = '1ltNpRqa8dVa-e_qqd0gPFCeuVpiqn__B';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink: string;
  thumbnailLink?: string;
  parents?: string[];
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveUploadResult {
  id: string;
  name: string;
  webViewLink: string;
  mimeType: string;
}

export class GoogleDriveService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  // ---------------------------------------------------------------------------
  // Folder operations
  // ---------------------------------------------------------------------------

  /** Find a folder by name within a parent (or Drive root). Returns null if not found. */
  async findFolder(name: string, parentId?: string): Promise<DriveFolder | null> {
    const q = [
      `name = ${JSON.stringify(name)}`,
      `mimeType = 'application/vnd.google-apps.folder'`,
      `trashed = false`,
      parentId ? `'${parentId}' in parents` : `'root' in parents`,
    ].join(' and ');

    const res = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
      { headers: this.authHeaders }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.files?.[0] ?? null;
  }

  /** Create a folder. Returns the new folder's id and name. */
  async createFolder(name: string, parentId?: string): Promise<DriveFolder> {
    const res = await fetch(`${DRIVE_API}/files?fields=id,name`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create Drive folder "${name}": ${res.status} ${err.slice(0, 200)}`);
    }
    return res.json();
  }

  /** Find or create a folder by name within a parent. */
  async getOrCreateFolder(name: string, parentId?: string): Promise<DriveFolder> {
    const existing = await this.findFolder(name, parentId);
    if (existing) return existing;
    return this.createFolder(name, parentId);
  }

  /**
   * Resolve (or create) a nested folder path under a root folder.
   * e.g. resolvePath(['campaigns', 'q1-2026', 'posts'], rootId)
   */
  async resolvePath(segments: string[], rootId: string): Promise<string> {
    let currentId = rootId;
    for (const segment of segments) {
      const folder = await this.getOrCreateFolder(segment, currentId);
      currentId = folder.id;
    }
    return currentId;
  }

  // ---------------------------------------------------------------------------
  // File operations
  // ---------------------------------------------------------------------------

  /** Upload a text file (e.g. QMD .md) to a folder. Returns the created file metadata. */
  async uploadTextFile(
    name: string,
    content: string,
    folderId: string,
    mimeType = 'text/markdown'
  ): Promise<DriveUploadResult> {
    const metadata = JSON.stringify({
      name,
      mimeType,
      parents: [folderId],
    });

    // Multipart upload: metadata + file body
    const boundary = '-------314159265358979';
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      `Content-Type: ${mimeType}`,
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n');

    const res = await fetch(
      `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink,mimeType`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body,
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to upload file to Drive: ${res.status} ${err.slice(0, 200)}`);
    }
    return res.json();
  }

  /** Update an existing file's content (by file ID). */
  async updateTextFile(fileId: string, content: string, mimeType = 'text/markdown'): Promise<DriveUploadResult> {
    const res = await fetch(
      `${DRIVE_UPLOAD}/files/${fileId}?uploadType=media&fields=id,name,webViewLink,mimeType`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': mimeType,
        },
        body: content,
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to update Drive file: ${res.status} ${err.slice(0, 200)}`);
    }
    return res.json();
  }

  /** Get a text file's content by file ID. */
  async getFileContent(fileId: string): Promise<string> {
    const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`Failed to read Drive file ${fileId}: ${res.status}`);
    return res.text();
  }

  /** List files in a folder (non-recursive). */
  async listFiles(
    folderId: string,
    opts?: { pageToken?: string; pageSize?: number; mimeType?: string }
  ): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    const conditions = [
      `'${folderId}' in parents`,
      `trashed = false`,
    ];
    if (opts?.mimeType) conditions.push(`mimeType = '${opts.mimeType}'`);

    const params = new URLSearchParams({
      q: conditions.join(' and '),
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)',
      pageSize: String(opts?.pageSize ?? 100),
      orderBy: 'modifiedTime desc',
      ...(opts?.pageToken ? { pageToken: opts.pageToken } : {}),
    });

    const res = await fetch(`${DRIVE_API}/files?${params}`, { headers: this.authHeaders });
    if (!res.ok) throw new Error(`Failed to list Drive files: ${res.status}`);
    return res.json();
  }

  /** Delete a file. */
  async deleteFile(fileId: string): Promise<void> {
    const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete Drive file ${fileId}: ${res.status}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Synthex folder structure
  // ---------------------------------------------------------------------------

  /**
   * Get or create the full Synthex folder structure under the user's root.
   * Returns the IDs of the key folders.
   */
  async ensureSynthexStructure(rootFolderId = DEFAULT_SYNTHEX_FOLDER_ID): Promise<{
    root: string;
    campaigns: string;
    content: string;
    media: string;
    reports: string;
  }> {
    const [campaigns, content, media, reports] = await Promise.all([
      this.getOrCreateFolder('campaigns', rootFolderId),
      this.getOrCreateFolder('content',   rootFolderId),
      this.getOrCreateFolder('media',     rootFolderId),
      this.getOrCreateFolder('reports',   rootFolderId),
    ]);

    return {
      root:      rootFolderId,
      campaigns: campaigns.id,
      content:   content.id,
      media:     media.id,
      reports:   reports.id,
    };
  }

  /**
   * Save a QMD document to the user's Drive.
   * Resolves the correct subfolder, then uploads the file.
   * Returns the Drive file ID and web link.
   */
  async saveQMDToPath(
    filename: string,
    content: string,
    pathSegments: string[],
    rootFolderId = DEFAULT_SYNTHEX_FOLDER_ID
  ): Promise<DriveUploadResult> {
    const folderId = await this.resolvePath(pathSegments, rootFolderId);
    return this.uploadTextFile(filename, content, folderId);
  }
}

// ---------------------------------------------------------------------------
// Factory: build service from an encrypted access token stored in DB
// ---------------------------------------------------------------------------

import { decryptField } from '@/lib/security/field-encryption';

/**
 * Build a GoogleDriveService from an encrypted access token
 * as stored in PlatformConnection.accessToken.
 */
export function driveServiceFromEncryptedToken(encryptedToken: string): GoogleDriveService {
  const accessToken = decryptField(encryptedToken);
  if (!accessToken) throw new Error('Failed to decrypt Drive access token');
  return new GoogleDriveService(accessToken);
}
