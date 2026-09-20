import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

test('model discovery isolates endpoints, key changes, and late responses', () => {
  const home = mkdtempSync(join(tmpdir(), 'graft-cache-isolation-'))
  try {
    const code = `
      const { setProviderKey } = await import('./scripts/graft-providers.js');
      const { fetchProviderModels, getCachedProviderModelIdsFor, resetProviderModelCache } = await import('./src/services/graft/providerModels.ts');
      const { strict: assert } = await import('node:assert');
      resetProviderModelCache();
      setProviderKey('nvidia_nim', 'fixture-first');
      process.env.GRAFT_OPENAI_UPSTREAM_URL = 'https://previous-provider.invalid/v1';
      let finishFirst;
      let first = true;
      globalThis.fetch = async (url, init) => {
        assert.equal(String(url), 'https://integrate.api.nvidia.com/v1/models');
        assert.equal(init.redirect, 'error');
        if (first) {
          first = false;
          return new Promise(resolve => { finishFirst = () => resolve(Response.json({data:[{id:'old-model'}]})); });
        }
        assert.equal(new Headers(init.headers).get('authorization'), 'Bearer fixture-second');
        return Response.json({data:[{id:'new-model'}]});
      };
      const old = fetchProviderModels('nvidia_nim');
      setProviderKey('nvidia_nim', 'fixture-second');
      const fresh = await fetchProviderModels('nvidia_nim');
      assert.equal(fresh[0].id, 'new-model');
      finishFirst();
      assert.equal(await old, null);
      assert.deepEqual(getCachedProviderModelIdsFor('nvidia_nim'), ['new-model']);
      setProviderKey('nvidia_nim', 'fixture-third');
      assert.equal(getCachedProviderModelIdsFor('nvidia_nim'), null);
    `
    const result = spawnSync(process.execPath, ['-e', code], {
      cwd: resolve(import.meta.dir, '../../..'),
      env: { ...process.env, GRAFT_HOME: home, NODE_ENV: 'test' },
      encoding: 'utf8', timeout: 20000,
    })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
