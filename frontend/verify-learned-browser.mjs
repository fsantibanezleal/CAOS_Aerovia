import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./', import.meta.url));
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
const failures = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const [{ predictSurrogate, loadRegistry, checkDomain }, { solveNetwork, DEFAULT_OPTIONS }, catalog, parity] = await Promise.all([
      import('/src/learned/index.ts'), import('/src/engine/index.ts'), fetch('/data/catalog.json').then(r=>r.json()), fetch('/data/models/parity-fixtures.json').then(r=>r.json()),
    ]);
    const registry=await loadRegistry();
    const rows=[], controls=[];
    for (const fixture of parity.fixtures) {
      const network=catalog.cases.find(c=>c.network.id===fixture.networkId).network;
      const entry=registry.entries.find(e=>e.networkId===fixture.networkId&&e.methodId===fixture.methodId);
      for(let sample=0;sample<fixture.input.length;sample++) {
        const options={...DEFAULT_OPTIONS,overrides:Object.fromEntries(network.edges.map((edge,i)=>[edge.id,{resistance:entry.baseResistances[i]*Math.exp(fixture.input[sample][i])}]))};
        const reference=solveNetwork(network,options);
        const prediction=await predictSurrogate(network,options,fixture.methodId,reference);
        if(prediction.status!=='supported') throw new Error(`${fixture.methodId}/${fixture.networkId}: ${prediction.reason}`);
        const delta=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
        const row={methodId:fixture.methodId,networkId:fixture.networkId,modelSha256:entry.onnx.sha256,sample,rawFlowMaxAbs:delta(prediction.prediction.rawFlows,fixture.rawFlows[sample]),
          flowMaxAbs:delta(prediction.prediction.result.flows,fixture.flows[sample]),pressureMaxAbs:delta(prediction.prediction.result.pressures,fixture.pressures[sample]),
          inferenceMs:prediction.diagnostics.inferenceMs,totalMs:prediction.diagnostics.totalMs};
        if(Math.max(row.rawFlowMaxAbs,row.flowMaxAbs)>parity.flowTolerance||row.pressureMaxAbs>parity.pressureTolerance) throw new Error(`Browser model parity failed: ${JSON.stringify(row)}`);
        rows.push(row);
      }
      const closed=checkDomain(network,{...DEFAULT_OPTIONS,overrides:{[network.edges[1].id]:{closed:true}}},entry);
      const outside=checkDomain(network,{...DEFAULT_OPTIONS,resistanceScale:10},entry);
      if(closed.supported||outside.supported) throw new Error('Unsupported controls entered the live model domain');
      const zeroOptions={...DEFAULT_OPTIONS,speed:0};
      const zero=await predictSurrogate(network,zeroOptions,fixture.methodId,solveNetwork(network,zeroOptions));
      if(zero.status!=='supported'||zero.prediction.result.flows.some(q=>q!==0)||zero.prediction.result.fanPowerKW!==0) throw new Error('Fan-off scaling control failed');
      controls.push({methodId:fixture.methodId,networkId:fixture.networkId,closure:closed.code,extrapolation:outside.code,fanOffFlow:0});
    }
    return {schema:'aerovia.browser-model-evidence/v1',createdAt:new Date().toISOString(),sourceSha256:registry.sourceSha256,
      browser:navigator.userAgent,rows,controls,modelCount:registry.entries.length,flowTolerance:parity.flowTolerance,pressureTolerance:parity.pressureTolerance,
      maxFlowAbs:Math.max(...rows.map(r=>r.flowMaxAbs)),maxPressureAbs:Math.max(...rows.map(r=>r.pressureMaxAbs)),
      runtime:'actual browser ONNX Runtime Web WASM; identical exported float32 fixtures; no nonlinear solver inside inference'};
  });
  if(failures.length) throw new Error(`Browser errors: ${failures.join('; ')}`);
  await mkdir(new URL('../build/qa/',import.meta.url),{recursive:true});
  await writeFile(new URL('../build/qa/learned-browser.json',import.meta.url),JSON.stringify(result,null,2)+'\n','utf8');
  if(process.argv.includes('--publish')) {
    const encoded=JSON.stringify(result,null,2)+'\n';
    const identity=text=>({sha256:createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text)});
    const modelManifestUrl=new URL('../data/models/manifest.json',import.meta.url);
    const modelManifest=JSON.parse(await readFile(modelManifestUrl,'utf8'));
    if(modelManifest.sourceSha256!==result.sourceSha256) throw new Error('Browser evidence belongs to different model sources');
    const scienceUrl=new URL('../data/artifacts/science.json',import.meta.url);
    const science=JSON.parse(await readFile(scienceUrl,'utf8'));
    if(science.sourceSha256!==result.sourceSha256) throw new Error('Browser evidence belongs to different scientific sources');
    science.validation.browserParity=`Verified ${result.modelCount} exported models and ${result.rows.length} identical samples in Chromium WASM; see data/models/browser-evidence.json.`;
    science.validation.browserEvidence={file:'data/models/browser-evidence.json',...identity(encoded),models:result.modelCount,samples:result.rows.length,maxFlowAbs:result.maxFlowAbs,maxPressureAbs:result.maxPressureAbs};
    const scienceEncoded=JSON.stringify(science,null,2)+'\n';
    const artifactManifestUrl=new URL('../data/artifacts/manifest.json',import.meta.url);
    const artifactManifest=JSON.parse(await readFile(artifactManifestUrl,'utf8'));
    artifactManifest.files['science.json']=identity(scienceEncoded);
    modelManifest.files['browser-evidence.json']=identity(encoded);
    await writeFile(new URL('../data/models/browser-evidence.json',import.meta.url),encoded,'utf8');
    await writeFile(scienceUrl,scienceEncoded,'utf8');
    await writeFile(modelManifestUrl,JSON.stringify(modelManifest,null,2)+'\n','utf8');
    await writeFile(artifactManifestUrl,JSON.stringify(artifactManifest,null,2)+'\n','utf8');
  }
  console.log(JSON.stringify({models:result.modelCount,samples:result.rows.length,controls:result.controls.length,maxFlowAbs:result.maxFlowAbs,maxPressureAbs:result.maxPressureAbs}));
} finally {
  await browser?.close();
  await server.close();
}
