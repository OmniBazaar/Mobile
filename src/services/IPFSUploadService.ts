/**
 * IPFSUploadService — Mobile-specific IPFS upload helper.
 *
 * The Wallet's `IPFSUploadClient.upload(file)` takes a browser `File`,
 * which RN doesn't natively expose. RN's FormData accepts a
 * `{ uri, name, type }` triple directly though, and the validator
 * endpoint (`POST /api/v1/ipfs/upload`) accepts the same multipart
 * shape regardless.
 *
 * This helper wraps the upload so screens (`CreateListingScreen`,
 * `ChatRoomScreen`) can pass an `expo-image-picker` `ImagePickerAsset`
 * directly. Single round-trip; no XHR — fetch is sufficient because we
 * don't surface upload-progress on Mobile (the modal already shows a
 * busy spinner).
 *
 * Validation mirrors `IPFSUploadClient.validate`: MIME allow-list +
 * 5 MB size cap.
 *
 * @module services/IPFSUploadService
 */

import { getBaseUrl } from './BootstrapService';
import { logger } from '../utils/logger';

/** Allowed MIME types — matches Wallet's ALLOWED_MIME set. */
const ALLOWED_MIMES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** 5 MB cap; mirrors Wallet's MAX_IMAGE_BYTES. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Result returned by a successful upload. */
export interface IPFSUploadResult {
  cid: string;
  url: string;
}

/** Source asset shape (matches `expo-image-picker` ImagePickerAsset). */
export interface ImageAsset {
  /** file:// URI on Android; file:// or ph:// on iOS. */
  uri: string;
  /** MIME type — `image/jpeg`, `image/png`, etc. */
  mimeType?: string;
  /** Optional file name. */
  fileName?: string;
  /** Optional size in bytes (some pickers omit this). */
  fileSize?: number;
}

/**
 * Validate an asset before upload. Returns an error key when invalid,
 * `undefined` when OK. The same key strings the Wallet uses, so callers
 * can reuse i18n copy.
 *
 * @param asset - Image asset.
 * @returns Error key or undefined.
 */
export function validateAsset(asset: ImageAsset): string | undefined {
  const mime = asset.mimeType ?? 'image/jpeg';
  if (!ALLOWED_MIMES.has(mime)) return 'imageTypeNotAllowed';
  if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_UPLOAD_BYTES) {
    return 'imageTooLarge';
  }
  return undefined;
}

/**
 * Read the JWT from secure storage. Mirrors the Wallet pattern but uses
 * the platform StorageAdapter directly so we don't have to import the
 * full ChallengeAuthClient.
 *
 * @returns JWT or empty string.
 */
async function readToken(): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getStorageAdapter } = require('@wallet/platform/registry') as {
      getStorageAdapter: () => {
        getItem: <T>(k: string) => Promise<T | undefined>;
      };
    };
    const auth = await getStorageAdapter().getItem<{ token?: string }>('omniauth');
    return auth?.token ?? '';
  } catch {
    return '';
  }
}

/**
 * Upload an asset to the validator's IPFS gateway.
 *
 * @param asset - File-like image asset (camera roll or capture).
 * @returns Resolved CID + gateway URL.
 * @throws When validation fails or the upload errors.
 */
export async function uploadAsset(asset: ImageAsset): Promise<IPFSUploadResult> {
  const invalid = validateAsset(asset);
  if (invalid !== undefined) {
    throw new Error(invalid);
  }
  const token = await readToken();
  const apiBase = getBaseUrl().replace(/\/+$/, '');
  const fd = new FormData();
  // RN FormData accepts the {uri, name, type} triple — see
  // https://reactnative.dev/docs/network#sending-multipart-data
  // Wrap in a typed cast because RN's FormData typing is imprecise.
  fd.append(
    'file',
    {
      uri: asset.uri,
      name: asset.fileName ?? `upload-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob,
  );
  const resp = await fetch(`${apiBase}/api/v1/ipfs/upload`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token !== '' && { Authorization: `Bearer ${token}` }),
    },
    body: fd,
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    logger.warn('[ipfs] upload failed', { status: resp.status, body: txt.slice(0, 200) });
    throw new Error(`Upload failed (HTTP ${resp.status})`);
  }
  const body = (await resp.json()) as {
    success?: boolean;
    cid?: string;
    url?: string;
    hash?: string;
    data?: { cid?: string; url?: string; hash?: string };
    error?: string;
  };
  if (body.success === false) {
    throw new Error(body.error ?? 'Validator rejected the upload.');
  }
  const cid = body.data?.cid ?? body.cid ?? body.data?.hash ?? body.hash ?? '';
  if (cid === '') throw new Error('Validator returned no CID.');
  const url = body.data?.url ?? body.url ?? `${apiBase}/api/v1/ipfs/cat/${cid}`;
  return { cid, url };
}
