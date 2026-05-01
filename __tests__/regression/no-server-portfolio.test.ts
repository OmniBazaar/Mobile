/**
 * Regression guard — Wallet home must NOT call the validator's
 * /api/v1/wallet/portfolio/:address endpoint.
 *
 * Architectural mandate (ADD_MOBILE_APP.md §53): every blockchain
 * balance call originates from the user's mobile IP. The validator
 * portfolio endpoint is allowed only as a last-resort fallback when
 * client-side multicall fails — never as the primary source.
 *
 * The previous Mobile/src/services/PortfolioClient.ts called the slow
 * validator endpoint as the primary; the new ClientPortfolioService
 * + usePortfolio drive everything client-side. This test fails if a
 * future change reintroduces the regression.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../src');

/**
 * Recursively gather every .ts / .tsx file under `dir`.
 *
 * @param dir - Absolute directory path.
 * @returns Array of absolute file paths.
 */
async function listSources(dir: string): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (cur === undefined) break;
    const entries = await fs.readdir(cur, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && /\.tsx?$/.test(e.name)) {
        out.push(full);
      }
    }
  }
  return out;
}

describe('regression: no validator-side portfolio aggregation in hooks/screens', () => {
  it('only ClientPortfolioService imports the legacy validator client', async () => {
    const files = await listSources(ROOT);
    const offenders: string[] = [];
    for (const f of files) {
      const content = await fs.readFile(f, 'utf8');
      // Allow the file itself if it's the legacy client (used as a
      // last-resort fallback by a future Sprint), or the test file.
      if (f.endsWith('PortfolioClient.ts')) continue;
      if (content.includes("from '../services/PortfolioClient'")) {
        offenders.push(path.relative(ROOT, f));
      }
      if (content.includes("from './PortfolioClient'") && !f.endsWith('PortfolioClient.ts')) {
        offenders.push(path.relative(ROOT, f));
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Forbidden import of validator-side PortfolioClient detected:\n  ${offenders.join('\n  ')}\n` +
          'Use ClientPortfolioService.getClientPortfolio() instead.',
      );
    }
  });
});
