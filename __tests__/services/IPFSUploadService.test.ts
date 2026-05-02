/**
 * IPFSUploadService unit tests.
 *
 *   - validateAsset: MIME allow-list + 5 MB cap.
 *   - uploadAsset: success path returns {cid, url}.
 *   - uploadAsset: maps non-OK HTTP into `Upload failed (HTTP …)`.
 *   - uploadAsset: maps {success:false} into validator-error message.
 *   - uploadAsset: throws when validator returns no CID.
 */

jest.mock('@wallet/platform/registry', () => ({
  getStorageAdapter: () => ({
    getItem: jest.fn().mockResolvedValue({ token: 'jwt' }),
  }),
}));

jest.mock('../../src/services/BootstrapService', () => ({
  getBaseUrl: (): string => 'http://65.108.205.116:3001',
}));

import {
  uploadAsset,
  validateAsset,
  MAX_UPLOAD_BYTES,
  type ImageAsset,
} from '../../src/services/IPFSUploadService';

const realFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = realFetch;
});

const ASSET: ImageAsset = {
  uri: 'file:///tmp/cat.jpg',
  mimeType: 'image/jpeg',
  fileName: 'cat.jpg',
  fileSize: 100_000,
};

describe('IPFSUploadService.validateAsset', () => {
  it('accepts a JPEG under the size cap', () => {
    expect(validateAsset(ASSET)).toBeUndefined();
  });

  it('rejects an unsupported MIME', () => {
    expect(validateAsset({ ...ASSET, mimeType: 'image/heic' })).toBe('imageTypeNotAllowed');
  });

  it('rejects oversize assets', () => {
    expect(validateAsset({ ...ASSET, fileSize: MAX_UPLOAD_BYTES + 1 })).toBe('imageTooLarge');
  });

  it('accepts an asset without a fileSize hint (some pickers omit it)', () => {
    const { fileSize: _omit, ...rest } = ASSET;
    void _omit;
    expect(validateAsset(rest)).toBeUndefined();
  });
});

describe('IPFSUploadService.uploadAsset', () => {
  it('returns {cid, url} on a successful upload', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { cid: 'QmPdf', url: 'https://gateway.example/QmPdf' },
      }),
    });
    const result = await uploadAsset(ASSET);
    expect(result.cid).toBe('QmPdf');
    expect(result.url).toBe('https://gateway.example/QmPdf');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the validator gateway URL when the response omits one', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ cid: 'QmAbc' }),
    });
    const result = await uploadAsset(ASSET);
    expect(result.cid).toBe('QmAbc');
    expect(result.url).toBe('http://65.108.205.116:3001/api/v1/ipfs/cat/QmAbc');
  });

  it('throws on HTTP non-OK', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => 'gateway down',
    });
    await expect(uploadAsset(ASSET)).rejects.toThrow(/Upload failed \(HTTP 502\)/);
  });

  it('throws when the validator signals success:false', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'storage full' }),
    });
    await expect(uploadAsset(ASSET)).rejects.toThrow(/storage full/);
  });

  it('throws when the response carries no CID', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    await expect(uploadAsset(ASSET)).rejects.toThrow(/no CID/);
  });

  it('throws the validation error key BEFORE hitting the network', async () => {
    await expect(uploadAsset({ ...ASSET, mimeType: 'image/heic' })).rejects.toThrow(
      'imageTypeNotAllowed',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
