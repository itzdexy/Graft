import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

test('OpenRouter live IDs survive discovery, display, validation and activation with another provider active', () => {
  const fixtureHome = mkdtempSync(join(tmpdir(), 'graft-openrouter-'))
  try {
    const code = `
      const { strict: assert } = await import('node:assert');
      const {setProviderKey,setActiveProvider,getActiveProviderId}=await import('./scripts/graft-providers.js');
      const {fetchProviderModels,resetProviderModelCache}=await import('./src/services/graft/providerModels.ts');
      const {resolveProviderModelsForPicker}=await import('./src/services/graft/catalogModels.ts');
      const {buildModelRows,presentModelRow}=await import('./src/services/graft/search/modelRows.ts');
      const {validateModelForProvider}=await import('./src/services/graft/validateProviderModel.ts');
      const {activateProviderModel}=await import('./src/services/graft/activateProviderModel.ts');
      const {probeProviderModel}=await import('./src/services/graft/providers/probe.ts');
      const {getProvider}=await import('./scripts/graft-providers.js');
      setProviderKey('openrouter','sk-or-fixture-only'); setProviderKey('nvidia_nim','fixture-only');
      setActiveProvider('nvidia_nim'); resetProviderModelCache();
      const ids=['z-ai/glm-5.2:free','openrouter/free','anthropic/claude-fixture'];
      let probed;
      globalThis.fetch=async (url,init)=>{
        assert.equal(new Headers(init.headers).has('anthropic-version'),false);
        if(init.method==='POST') {
          assert.equal(String(url),'https://openrouter.ai/api/v1/chat/completions');
          probed=JSON.parse(init.body).model;
          return Response.json({choices:[{message:{content:'OK'}}]});
        }
        assert.equal(String(url),'https://openrouter.ai/api/v1/models');
        return Response.json({data:ids.map(id=>({id}))});
      };
      const descriptors=await fetchProviderModels('openrouter',{force:true});
      assert.deepEqual(descriptors.map(m=>m.id),ids);
      const models=resolveProviderModelsForPicker(getProvider('openrouter'),ids,{providerId:'openrouter'});
      const rows=buildModelRows({sources:[{providerId:'openrouter',providerLabel:'OpenRouter',models,connected:true,verifiedIds:new Set(ids)}],activeProviderId:'nvidia_nim'});
      const row=rows.find(r=>r.modelId===ids[0]);
      assert.ok(presentModelRow(row).detail.startsWith(ids[0]+' '));
      assert.ok(!presentModelRow(row).detail.includes('openrouter/anthropic/'));
      for(const model of ids) assert.equal((await validateModelForProvider('openrouter',model)).model,model);
      assert.equal((await validateModelForProvider('openrouter','anthropic/z-ai/glm-5.2:free')).model,ids[0]);
      const result=await activateProviderModel({providerId:'openrouter',modelId:row.modelId},{probe:probeProviderModel,commit:async input=>assert.equal(input.modelId,ids[0])});
      assert.equal(result.ok,true); assert.equal(probed,ids[0]);
      assert.equal(getActiveProviderId(),'nvidia_nim');
      globalThis.fetch=async ()=>Response.json({error:{message:'Provider returned error'}},{status:429,headers:{'retry-after':'15'}});
      let committed=false;
      const limited=await activateProviderModel({providerId:'openrouter',modelId:row.modelId},{probe:input=>probeProviderModel({...input,forceInference:true}),commit:async()=>{committed=true}});
      assert.equal(limited.ok,false);
      assert.ok(limited.message.includes('rate limit (HTTP 429)'));
      assert.ok(limited.message.includes('Wait 15 seconds'));
      assert.equal(committed,false);
      assert.equal(getActiveProviderId(),'nvidia_nim');
      globalThis.fetch=async()=>{throw new Error('A recent rate limit must not send another request')};
      const cachedFailure=await probeProviderModel({providerId:'openrouter',modelId:row.modelId});
      assert.equal(cachedFailure.errorKind,'rate_limit');
      assert.ok(cachedFailure.detail.includes('Recent check reused'));
      let freshCalls=0;
      globalThis.fetch=async()=>{freshCalls++;return Response.json({choices:[{message:{content:'OK'}}]})};
      assert.equal((await probeProviderModel({providerId:'openrouter',modelId:row.modelId,forceInference:true})).ok,true);
      assert.equal(freshCalls,1);
      assert.equal((await probeProviderModel({providerId:'openrouter',modelId:row.modelId})).ok,true);
      assert.equal(freshCalls,1);
      setProviderKey('openrouter','sk-or-fixture-replaced');
      assert.equal((await probeProviderModel({providerId:'openrouter',modelId:row.modelId})).ok,true);
      assert.equal(freshCalls,2);
      const {getModelReadiness}=await import('./src/services/graft/modelReadiness.ts');
      for(const providerId of ['nvidia_nim','groq','cerebras','openai']) {
        setProviderKey(providerId,(getProvider(providerId).keyPrefix||'')+'fixture-only-key');
        let calls=0;
        globalThis.fetch=async()=>{calls++;return Response.json({error:{message:'Not Found'}},{status:404})};
        const missing=await probeProviderModel({providerId,modelId:'fixture-missing'});
        assert.equal(missing.readiness,'unavailable');
        assert.ok(missing.detail.includes('HTTP 404'));
        assert.equal(getModelReadiness(providerId,'fixture-missing').hardFailure,false);
        await probeProviderModel({providerId,modelId:'fixture-missing'});
        assert.equal(calls,1);
        assert.equal(getModelReadiness(providerId,'fixture-missing',Date.now()+45001),null);
        globalThis.fetch=async()=>{calls++;return Response.json({choices:[{message:{content:'OK'}}]})};
        assert.equal((await probeProviderModel({providerId,modelId:'fixture-missing'})).ok,true);
        assert.equal(calls,2);
      }
    `
    const result = spawnSync(process.execPath, ['-e', code], { cwd: resolve(import.meta.dir, '../../..'), env: { ...process.env, GRAFT_HOME: fixtureHome, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 20000 })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  } finally { rmSync(fixtureHome, { recursive: true, force: true }) }
})
