import { expect, test } from 'bun:test'
import { createGraftTestHome } from '../../../../scripts/graft-test-home.js'
import { resolve } from 'node:path'

test('confirmed failures survive restart, do not store credentials, and can be rechecked', () => {
  const fixture = createGraftTestHome()
  const run = (code: string) => {
    const result = Bun.spawnSync({cmd:[process.execPath,'-e',code],cwd:resolve(import.meta.dir,'../../../..'),env:{...process.env,...fixture.env},stdout:'pipe',stderr:'pipe'})
    expect(result.stderr.toString()).toBe('')
    expect(result.exitCode).toBe(0)
  }
  try {
    run(`
      const {strict:a}=await import('node:assert');
      const {setProviderKey}=await import('./scripts/graft-providers.js');
      const {probeProviderModel}=await import('./src/services/graft/providers/probe.ts');
      const {rememberedUnavailableModel}=await import('./src/services/graft/models/unavailableCache.ts');
      setProviderKey('nvidia_nim','fixture-private-key');
      globalThis.fetch=async()=>Response.json({error:{message:'Not Found'}},{status:404});
      await probeProviderModel({providerId:'nvidia_nim',modelId:'ambiguous',forceInference:true});
      a.equal(rememberedUnavailableModel('nvidia_nim','ambiguous'),false);
      globalThis.fetch=async()=>Response.json({choices:[{message:{content:'OK'}}]});
      await probeProviderModel({providerId:'nvidia_nim',modelId:'working',forceInference:true});
      globalThis.fetch=async()=>Response.json({error:{message:'Not Found'}},{status:404});
      await probeProviderModel({providerId:'nvidia_nim',modelId:'missing',forceInference:true});
      a.equal(rememberedUnavailableModel('nvidia_nim','missing'),true);
      const {readFileSync}=await import('node:fs');
      const {join}=await import('node:path');
      const {getGraftHome}=await import('./scripts/graft-home.js');
      const raw=readFileSync(join(getGraftHome(),'.graft','unavailable-models.json'),'utf8');
      a.equal(raw.includes('fixture-private-key'),false);
      a.equal(raw.includes('Not Found'),false);
    `)
    run(`
      const {strict:a}=await import('node:assert');
      const {getProviderModelUnavailableReason}=await import('./src/services/graft/modelAvailability.ts');
      const {probeProviderModel}=await import('./src/services/graft/providers/probe.ts');
      const {setProviderKey}=await import('./scripts/graft-providers.js');
      a.ok(getProviderModelUnavailableReason('nvidia_nim','missing'));
      a.equal(getProviderModelUnavailableReason('openrouter','missing'),null);
      let calls=0; globalThis.fetch=async()=>{calls++;return Response.json({choices:[{message:{content:'OK'}}]})};
      a.equal((await probeProviderModel({providerId:'nvidia_nim',modelId:'missing'})).ok,false);
      a.equal(calls,0);
      a.equal((await probeProviderModel({providerId:'nvidia_nim',modelId:'missing',forceInference:true})).ok,true);
      a.equal(getProviderModelUnavailableReason('nvidia_nim','missing'),null);
      const {rememberUnavailableModel}=await import('./src/services/graft/models/unavailableCache.ts');
      rememberUnavailableModel('nvidia_nim','missing');
      setProviderKey('nvidia_nim','fixture-new-key');
      a.equal(getProviderModelUnavailableReason('nvidia_nim','missing'),null);
    `)
  } finally { fixture.cleanup() }
})
