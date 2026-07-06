/**
 * Smart Productivity Assistant v9 — Content Script
 * CSS → css/spa-*.css (injected via manifest)
 * Speech → js/spa-speech.js (loaded before this)
 * Background session → background.js (UNCHANGED)
 */
(function () {
  'use strict';

  if (document.getElementById('__spa_injected__')) return;
  const _g = document.createElement('span');
  _g.id = '__spa_injected__'; _g.style.display = 'none';
  document.body.appendChild(_g);

  // ── Constants ─────────────────────────────────────────────────────────────
  const SF_API_VERSION = 'v60.0';
  const GROQ_MODEL     = 'llama-3.3-70b-versatile';
  let USER_NAME        = 'You';        // overridden from storage after load
  let currentAIProvider  = 'groq';
  let sfConsentGiven     = false;
  let MY_MONDAY_USER_ID  = '84681170';

  // ── Storage ───────────────────────────────────────────────────────────────
  const _store = {};
  function storageGet(k, d) { return _store[k] !== undefined ? _store[k] : d; }
  function storageSet(k, v) { _store[k] = v; chrome.storage.local.set({ [k]: v }); }
  chrome.storage.local.get(null, items => {
    Object.assign(_store, items);
    if(items.userName) USER_NAME = items.userName;
    if(items.mondayOwnerId) MY_MONDAY_USER_ID = items.mondayOwnerId;
  });

  // ── Logging ───────────────────────────────────────────────────────────────
  const LOG = [];
  function log(level, msg, source) {
    LOG.unshift({ level, msg, source: source||'System', time: new Date().toLocaleTimeString() });
    if (LOG.length > 200) LOG.pop();
    refreshLogsUI(); updateLogBadge();
  }
  function GM_addStyle(css) { const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s); }

  // ── Git v10 styles ────────────────────────────────────────────────────────
  GM_addStyle(`
.git-section-toggle{display:flex;border-bottom:2px solid var(--border);background:var(--bg-panel);flex-shrink:0}
.git-section-btn{flex:1;padding:7px 4px;font-size:10px;font-weight:600;color:var(--text-muted);background:transparent;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:4px}
.git-section-btn:hover{color:var(--text-main);background:var(--bg-hover)}
.git-section-btn.active{color:var(--accent);border-bottom-color:var(--accent)}
.git-download-bar{display:flex;align-items:center;gap:5px;padding:5px 8px;border-top:1px solid var(--border);background:var(--bg-card);flex-shrink:0}
.git-meta-header-row{display:flex;align-items:center;gap:5px;padding:6px 8px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.git-panels-body{display:flex;height:240px;border-bottom:1px solid var(--border);overflow:hidden}
.git-panel{display:flex;flex-direction:column;flex:1;min-width:0;overflow:hidden}
.git-panel-lhs{border-right:1px solid var(--border)}
.git-panel-header{display:flex;align-items:center;gap:4px;padding:4px 6px;border-bottom:1px solid var(--border);background:var(--bg-panel);flex-shrink:0}
.git-panel-header-title{font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}
.git-panel-search{flex:1;min-width:0;padding:2px 5px;border:1px solid var(--border);border-radius:3px;background:var(--bg-card);color:var(--text-main);font-size:9.5px;outline:none}
.git-panel-selall-row{display:flex;align-items:center;justify-content:space-between;padding:3px 8px;border-bottom:1px solid var(--border);font-size:9.5px;flex-shrink:0;background:var(--bg-card)}
.git-panel-selall-row label{display:flex;align-items:center;cursor:pointer;color:var(--text-muted)}
.git-panel-selall-row input{accent-color:var(--accent)}
.git-panel-scroll{flex:1;overflow-y:auto;overflow-x:hidden}
.git-type-row{display:flex;align-items:center;gap:4px;padding:3px 8px;cursor:pointer;font-size:10px;border-bottom:1px solid rgba(255,255,255,.03);transition:background .1s;user-select:none}
.git-type-row:hover{background:var(--bg-hover)}
.git-type-row.active{background:rgba(99,102,241,.12);border-left:2px solid var(--accent)}
.git-type-row input[type=checkbox]{accent-color:var(--accent);flex-shrink:0}
.git-type-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9.5px}
.git-type-badge{font-size:8px;font-weight:700;color:var(--accent);background:rgba(99,102,241,.12);border-radius:8px;padding:1px 4px;flex-shrink:0;white-space:nowrap}
.git-member-row{display:flex;align-items:center;gap:4px;padding:3px 8px;font-size:9.5px;border-bottom:1px solid rgba(255,255,255,.03);transition:background .1s}
.git-member-row:hover{background:var(--bg-hover)}
.git-member-row input[type=checkbox]{accent-color:var(--accent);flex-shrink:0}
.git-member-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;font-size:9px}
.git-member-date{font-size:8px;color:var(--text-muted);flex-shrink:0}
.git-selection-summary{padding:4px 10px;background:var(--bg-card);border-top:1px solid var(--border);font-size:9.5px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.git-push-link-btn{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card);color:var(--accent);font-size:10.5px;font-weight:600;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s}
.git-push-link-btn:hover{border-color:var(--accent);background:var(--bg-hover)}
.git-push-link-btn.primary-link{background:var(--accent);color:#fff;border-color:var(--accent)}
.git-push-link-btn.primary-link:hover{opacity:.88}
.spa-progress-bar{height:5px;background:var(--border);border-radius:3px;overflow:hidden}
.spa-progress-fill{height:100%;background:var(--accent);border-radius:3px;transition:width .25s ease}
.spa-progress-fill.done{background:var(--success)}
.spa-progress-fill.partial{background:#f59e0b}
.spa-progress-fill.failed{background:var(--danger)}
.git-push-source-toggle{display:flex;border-bottom:1px solid var(--border);background:var(--bg-card);flex-shrink:0}
.git-push-src-btn{flex:1;padding:5px 4px;font-size:9.5px;font-weight:600;color:var(--text-muted);background:transparent;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;cursor:pointer;transition:all .15s}
.git-push-src-btn:hover{color:var(--text-main);background:var(--bg-hover)}
.git-push-src-btn.active{color:var(--accent);border-bottom-color:var(--accent)}
.git-local-step{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-bottom:1px solid var(--border)}
.git-local-step-num{width:18px;height:18px;border-radius:50%;background:var(--accent);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.git-local-file-row{display:flex;align-items:center;gap:5px;padding:2px 8px;font-size:9px;border-bottom:1px solid rgba(255,255,255,.03)}
.git-local-file-row:hover{background:var(--bg-hover)}
.git-local-file-row input{accent-color:var(--accent);flex-shrink:0}
.git-local-file-path{flex:1;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-main)}
.git-local-file-size{font-size:8px;color:var(--text-muted);flex-shrink:0}
`);

  // ── Config PIN Security ───────────────────────────────────────────────────
  let configUnlocked = false;
  async function sha256(str){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function showConfigLock(){
    const inner=document.getElementById('kp-inner-config');
    if(!inner||document.getElementById('spa-config-lock'))return;
    inner.style.position='relative';
    const lock=document.createElement('div');
    lock.id='spa-config-lock';
    lock.style.cssText='position:absolute;inset:0;background:var(--bg-panel);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;z-index:100;border-radius:8px';
    lock.innerHTML=`<div style="font-size:32px">🔒</div><div style="font-size:13px;font-weight:700;color:var(--text-main)">Config Locked</div><div style="font-size:10px;color:var(--text-muted);text-align:center">Enter your PIN to access settings</div><input type="password" id="spa-lock-pin" class="kp-sinput" placeholder="Enter PIN" style="text-align:center;letter-spacing:6px;width:140px;font-size:16px"><button class="kp-btn primary" id="spa-lock-submit" style="width:140px">🔓 Unlock</button><div id="spa-lock-err" style="font-size:10px;color:var(--danger);display:none">❌ Wrong PIN — try again</div>`;
    inner.appendChild(lock);
    const tryUnlock=async()=>{
      const pin=document.getElementById('spa-lock-pin')?.value||'';
      const hash=await sha256(pin);
      if(hash===storageGet('configPinHash','')){
        configUnlocked=true;lock.remove();
      }else{
        const err=document.getElementById('spa-lock-err');if(err)err.style.display='block';
        const inp=document.getElementById('spa-lock-pin');if(inp){inp.value='';inp.focus();}
      }
    };
    document.getElementById('spa-lock-submit')?.addEventListener('click',tryUnlock);
    document.getElementById('spa-lock-pin')?.addEventListener('keydown',e=>{if(e.key==='Enter')tryUnlock();});
    setTimeout(()=>document.getElementById('spa-lock-pin')?.focus(),80);
  }

  // ── Session Detection ─────────────────────────────────────────────────────
  let _cachedSession = null;

  function getSessionFromBackground(sfHost) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ type:'GET_SF_SESSION', sfHost }, resp => {
          if (chrome.runtime.lastError||!resp||!resp.sessionId) { resolve(null); return; }
          resolve(resp);
        });
      } catch(e) { resolve(null); }
    });
  }

  function detectSession() {
    if (_cachedSession?.sessionId) return _cachedSession;
    const ctx = { sfHost:window.location.hostname, pageUrl:window.location.href, pageTitle:document.title };
    const m = window.location.pathname.match(/\/([a-zA-Z0-9]{15,18})(?:\/|$)/);
    ctx.recordId = m?m[1]:'';
    try { const uc=window.UserContext; if(uc?.sessionId){Object.assign(ctx,{sessionId:uc.sessionId,orgId:uc.organizationId,userId:uc.userId,userName:uc.userName,source:'window.UserContext'}); _cachedSession=ctx; return ctx;} } catch(e){}
    try { const sf=window.sforce; if(sf?.connection?.sessionId){ctx.sessionId=sf.connection.sessionId; ctx.source='sforce.connection'; _cachedSession=ctx; return ctx;} } catch(e){}
    return ctx;
  }

  async function detectSessionAsync() {
    if (_cachedSession?.sessionId) return _cachedSession;
    const sfHost=window.location.hostname;
    const ctx={sfHost,pageUrl:window.location.href,pageTitle:document.title,recordId:(window.location.pathname.match(/\/([a-zA-Z0-9]{15,18})(?:\/|$)/)||[])[1]||''};
    try { const cached=JSON.parse(localStorage.getItem(`${sfHost}_spa_session`)||'null'); if(cached?.sessionId&&Date.now()-cached.ts<300000){Object.assign(ctx,cached,{source:'localStorage-cache'}); _cachedSession=ctx; return ctx;} } catch(e){}
    try { const uc=window.UserContext; if(uc?.sessionId){Object.assign(ctx,{sessionId:uc.sessionId,orgId:uc.organizationId,userId:uc.userId,userName:uc.userName,source:'window.UserContext'}); _cachedSession=ctx; return ctx;} } catch(e){}
    try { const sf=window.sforce; if(sf?.connection?.sessionId){Object.assign(ctx,{sessionId:sf.connection.sessionId,source:'sforce.connection'}); _cachedSession=ctx; return ctx;} } catch(e){}
    const bg=await getSessionFromBackground(sfHost);
    if (bg?.sessionId) {
      Object.assign(ctx,bg);
      window.__sfSession=ctx; // expose for export naming (orgId, sfHost)
      try { localStorage.setItem(`${ctx.sfHost}_spa_session`,JSON.stringify({sessionId:ctx.sessionId,userName:ctx.userName,orgId:ctx.orgId,ts:Date.now()})); } catch(e){}
      _cachedSession=ctx; return ctx;
    }
    // Inline script injection removed — violates Salesforce CSP.
    // Session is reliably read by background.js via chrome.cookies instead.
    if (ctx.sessionId) _cachedSession=ctx;
    return ctx;
  }

  function retrySessionDetection(n) {
    if (n<=0){log('error','Session not found after retries.','Session'); return;}
    setTimeout(async()=>{ _cachedSession=null; const c=await detectSessionAsync(); if(c.sessionId)log('success','Session retry OK: '+(c.userName||c.source),'Session'); else retrySessionDetection(n-1); },2000);
  }

  // ── SF REST ───────────────────────────────────────────────────────────────
  async function sfREST(method,path,body) {
    if (!sfConsentGiven) throw 'Org access not confirmed. Enable SF toggle in header.';
    const ctx=await detectSessionAsync();
    let sid=ctx.sessionId;
    if (!sid){try{for(const c of document.cookie.split(';')){const ei=c.indexOf('=');if(ei===-1)continue;const n=c.substring(0,ei).trim(),v=c.substring(ei+1).trim();if(['sid','__Host-PREV_sid','__Secure-sid'].includes(n)||n.endsWith('_sid')){sid=v;break;}}}catch(e){}}
    if (!sid) throw '⚠️ No Salesforce session found. Please refresh and reopen.';
    const apiHost=ctx.sfHost.replace(/\.lightning\.force\.com$/,'.my.salesforce.com').replace(/\.force\.com\.mcas\.ms$/,'.force.com');
    const resp=await fetch(`https://${apiHost}/services/data/${SF_API_VERSION}${path}`,{method,headers:{Authorization:'Bearer '+sid,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    if(resp.status===401){_cachedSession=null;try{localStorage.removeItem(`${ctx.sfHost}_spa_session`);}catch(e){}throw '⚠️ Session expired (401). Please refresh.';}
    const d=await resp.json();
    if(resp.ok){log('success',`SF ${resp.status}`,'REST API');return d;}
    log('error',`SF ${resp.status}: `+JSON.stringify(d).substring(0,150),'REST API');
    throw d;
  }

  // ── Metadata SOAP API (describeMetadata / listMetadata) ──────────────────
  async function sfSoapMeta(action,bodyXml){
    if(!sfConsentGiven)throw'Org access not confirmed — enable SF toggle.';
    const ctx=await detectSessionAsync();
    const sid=ctx?.sessionId;
    if(!sid)throw'No SF session — please refresh the Salesforce page.';
    // The Metadata SOAP API has no CORS headers, so a direct fetch from a content script
    // is blocked by the browser even if the request goes through.
    // Route through background service worker (same pattern as GET_SF_SESSION cookie reads)
    // — background scripts are not subject to CORS restrictions.
    const ver=SF_API_VERSION.replace('v','');
    const url=`https://${ctx.sfHost}/services/Soap/m/${ver}`;
    const soapBody=`<?xml version="1.0" encoding="utf-8"?>
<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Header>
    <CallOptions xmlns="http://soap.sforce.com/2006/04/metadata"><client>SmartAssistant</client></CallOptions>
    <SessionHeader xmlns="http://soap.sforce.com/2006/04/metadata"><sessionId>${sid}</sessionId></SessionHeader>
  </env:Header>
  <env:Body>${bodyXml}</env:Body>
</env:Envelope>`;
    return new Promise((resolve,reject)=>{
      chrome.runtime.sendMessage({type:'SF_SOAP',url,body:soapBody},resp=>{
        if(chrome.runtime.lastError){reject(chrome.runtime.lastError.message||'Runtime error');return;}
        if(resp?.error){reject(resp.error);return;}
        if(!resp?.ok){reject(`SOAP HTTP ${resp?.status||'?'}`);return;}
        const text=resp.text||'';
        if(text.includes('<faultstring>')){
          const fault=text.match(/<faultstring>([\s\S]*?)<\/faultstring>/)?.[1]||'Unknown SOAP error';
          reject(fault);return;
        }
        resolve(text);
      });
    });
  }

  async function metaDescribe(){
    const ver=SF_API_VERSION.replace('v','');
    log('info',`→ SOAP describeMetadata (API v${ver}) — routing through background worker…`,'Git');
    const xml=await sfSoapMeta('describeMetadata',
      `<describeMetadata xmlns="http://soap.sforce.com/2006/04/metadata"><asOfVersion>${ver}</asOfVersion></describeMetadata>`);
    const doc=new DOMParser().parseFromString(xml,'text/xml');
    const els=doc.getElementsByTagName('metadataObjects');
    const result=[];
    for(const el of els){
      const get=t=>el.getElementsByTagName(t)[0]?.textContent||'';
      const xmlName=get('xmlName');
      if(!xmlName)continue;
      result.push({xmlName,directoryName:get('directoryName'),suffix:get('suffix'),inFolder:get('inFolder')==='true',metaFile:get('metaFile')==='true'});
    }
    log('success',`← describeMetadata: ${result.length} metadata types found in org`,'Git');
    return result.sort((a,b)=>a.xmlName.localeCompare(b.xmlName));
  }

  async function metaList(typeName){
    const ver=SF_API_VERSION.replace('v','');
    log('info',`→ SOAP listMetadata [${typeName}]`,'Git');
    const xml=await sfSoapMeta('listMetadata',
      `<listMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
        <queries><type>${typeName}</type></queries>
        <asOfVersion>${ver}</asOfVersion>
      </listMetadata>`);
    const doc=new DOMParser().parseFromString(xml,'text/xml');
    const results=doc.getElementsByTagName('result');
    const members=[];
    const seen=new Set();
    for(const el of results){
      const get=t=>el.getElementsByTagName(t)[0]?.textContent||'';
      const fullName=get('fullName');
      if(!fullName||seen.has(fullName))continue;
      seen.add(fullName);
      members.push({fullName,fileName:get('fileName'),type:get('type')||typeName,id:get('id')||fullName,lastModifiedByName:get('lastModifiedByName'),lastModifiedDate:get('lastModifiedDate')});
    }
    log('success',`← listMetadata [${typeName}]: ${members.length} members`,'Git');
    return members;
  }

  // Batch listMetadata — up to 3 types per SOAP call (3× fewer round trips)
  async function metaListBatch(typeNames){
    const ver=SF_API_VERSION.replace('v','');
    log('info',`→ SOAP listMetadata BATCH [${typeNames.join(', ')}]`,'Git');
    const queries=typeNames.map(t=>`<queries><type>${t}</type></queries>`).join('');
    const xml=await sfSoapMeta('listMetadata',
      `<listMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
        ${queries}
        <asOfVersion>${ver}</asOfVersion>
      </listMetadata>`);
    const doc=new DOMParser().parseFromString(xml,'text/xml');
    const results=doc.getElementsByTagName('result');
    const byType={};
    for(const t of typeNames)byType[t]=[];
    const seen=new Set();
    for(const el of results){
      const get=t=>el.getElementsByTagName(t)[0]?.textContent||'';
      const fullName=get('fullName');const type=get('type');
      if(!fullName||seen.has(type+'::'+fullName))continue;
      seen.add(type+'::'+fullName);
      if(byType[type])byType[type].push({fullName,fileName:get('fileName'),type,id:get('id')||fullName,lastModifiedByName:get('lastModifiedByName'),lastModifiedDate:get('lastModifiedDate')});
    }
    const summary=typeNames.map(t=>`${t}:${byType[t].length}`).join(', ');
    log('success',`← batch result [${summary}]`,'Git');
    return byType;
  }

  // Yield control back to browser event loop (keeps UI responsive during long loops)
  const yieldToBrowser=()=>new Promise(r=>setTimeout(r,0));

  // ── Export / Download helpers ─────────────────────────────────────────────
  async function loadJSZip(){
    if(window.JSZip)return window.JSZip;
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload=()=>resolve(window.JSZip);
      s.onerror=()=>reject(new Error('Failed to load JSZip from CDN'));
      document.head.appendChild(s);
    });
  }

  function getExportFolderName(ctx,customName){
    if(customName&&customName.trim())return customName.trim().replace(/[^a-zA-Z0-9_-]/g,'_');
    // Use sfHost: e.g. kotakmahindratrusteeship.lightning.force.com → kotakmahindratrusteeship
    const host=ctx?.sfHost||window.location.hostname;
    const orgSlug=host.replace(/\.(lightning|my|sandbox)\..*$/,'').replace(/[^a-zA-Z0-9_-]/g,'-').substring(0,32);
    const date=new Date().toISOString().slice(0,10);
    return`${orgSlug}_${date}`;
  }

  // Collect file bodies for all selected members — shows progress bar
  async function collectFileBodies(onProgress){
    const files=[];
    const allItems=[];
    for(const[type,selNames]of Object.entries(metaSelectedByType)){
      if(!selNames.size)continue;
      const members=metaMembersByType[type]||[];
      for(const m of members){if(selNames.has(m.fullName))allItems.push({type,fullName:m.fullName,fileName:m.fileName,id:m.id});}
    }
    const total=allItems.length;
    for(let i=0;i<allItems.length;i++){
      const item=allItems[i];
      if(onProgress)onProgress(i,total,item.fullName);
      if(i%10===0)await yieldToBrowser();
      try{
        const body=await fetchFileBody(item.type,item.id,item.fullName);
        if(!body.startsWith('// Body fetch not implemented')){
          const filePath=buildFilePath(item);
          files.push({filePath,body,fullName:item.fullName,type:item.type});
        }
      }catch(e){log('warn',`Export skip: ${item.fullName} — ${e}`,'Git');}
    }
    if(onProgress)onProgress(total,total,'');
    return files;
  }

  // Download as ZIP: OrgName_Date.zip → force-app/main/default/...
  async function exportAsZip(ctx){
    const ep=document.getElementById('git-export-progress');
    const el=document.getElementById('git-export-label');
    const ec=document.getElementById('git-export-count');
    const eb=document.getElementById('git-export-bar');
    const ef=document.getElementById('git-export-file');
    if(ep)ep.style.display='block';
    try{
      const JSZip=await loadJSZip();
      const zip=new JSZip();
      const folderName=getExportFolderName(ctx);
      const files=await collectFileBodies((done,total,name)=>{
        if(el)el.textContent=`Fetching ${name||'…'}`;
        if(ec)ec.textContent=`${done} / ${total}`;
        if(eb)eb.style.width=total?Math.round(done/total*100)+'%':'0%';
        if(ef)ef.textContent=name||'';
      });
      if(!files.length){alert('No file bodies could be fetched. Try selecting Apex Classes or LWC.');return;}
      if(el)el.textContent='Building ZIP…';
      for(const f of files){
        const zipPath=`${folderName}/${f.filePath}`;
        zip.file(zipPath,f.body);
      }
      if(el)el.textContent='Compressing…';
      await yieldToBrowser();
      const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download=`${folderName}.zip`;
      document.body.appendChild(a);a.click();
      setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},2000);
      log('success',`ZIP downloaded: ${folderName}.zip (${files.length} files, ${(blob.size/1024).toFixed(0)} KB)`,'Git');
      if(el)el.textContent=`✅ Downloaded ${files.length} files`;
      if(eb){eb.style.width='100%';eb.className='spa-progress-fill done';}
      setTimeout(()=>{if(ep)ep.style.display='none';},3000);
    }catch(e){
      log('error','ZIP export failed: '+e,'Git');
      alert('ZIP export failed: '+e);
      if(ep)ep.style.display='none';
    }
  }

  // Save to local folder using File System Access API (Chrome 86+)
  async function exportToLocalFolder(ctx){
    if(!window.showDirectoryPicker){
      alert('📁 Local Folder requires Chrome 86+ with File System Access API.\n\nUse 💾 ZIP instead — extract it to your git repo folder.');
      return;
    }
    const ep=document.getElementById('git-export-progress');
    const el=document.getElementById('git-export-label');
    const ec=document.getElementById('git-export-count');
    const eb=document.getElementById('git-export-bar');
    const ef=document.getElementById('git-export-file');
    try{
      const dirHandle=await window.showDirectoryPicker({mode:'readwrite',startIn:'documents'});
      const folderName=getExportFolderName(ctx);
      if(ep)ep.style.display='block';
      if(el)el.textContent='Fetching file bodies…';
      // Create org/date folder → force-app/main/default structure
      const orgDir=await dirHandle.getDirectoryHandle(folderName,{create:true});
      const faDir=await orgDir.getDirectoryHandle('force-app',{create:true});
      const mainDir=await faDir.getDirectoryHandle('main',{create:true});
      const defDir=await mainDir.getDirectoryHandle('default',{create:true});
      const files=await collectFileBodies((done,total,name)=>{
        if(el)el.textContent=`Saving ${name||'…'}`;
        if(ec)ec.textContent=`${done} / ${total}`;
        if(eb)eb.style.width=total?Math.round(done/total*100)+'%':'0%';
        if(ef)ef.textContent=name||'';
      });
      if(!files.length){alert('No file bodies could be fetched.');if(ep)ep.style.display='none';return;}
      // Write files into the directory tree
      let written=0;
      for(const f of files){
        // filePath like "force-app/main/default/classes/MyClass.cls"
        // Strip "force-app/main/default/" prefix, split rest
        const rel=f.filePath.replace(/^force-app\/main\/default\//,'');
        const parts=rel.split('/');
        let cur=defDir;
        for(let i=0;i<parts.length-1;i++){
          cur=await cur.getDirectoryHandle(parts[i],{create:true});
        }
        const fh=await cur.getFileHandle(parts[parts.length-1],{create:true});
        const w=await fh.createWritable();
        await w.write(f.body);await w.close();
        written++;
        if(written%10===0)await yieldToBrowser();
      }
      log('success',`Saved ${written} files to ${folderName}/`,'Git');
      if(el)el.textContent=`✅ Saved ${written} files to ${folderName}/`;
      if(eb){eb.style.width='100%';eb.className='spa-progress-fill done';}
      setTimeout(()=>{if(ep)ep.style.display='none';},4000);
      alert(`✅ Saved ${written} files to:\n📁 ${folderName}/force-app/main/default/\n\nYou can now run:\n  git add .\n  git commit -m "feat: backup SF metadata"\n  git push`);
    }catch(e){
      if(e.name==='AbortError')return; // user cancelled picker
      log('error','Local folder export failed: '+e,'Git');
      alert('Local folder export failed: '+e);
      if(ep)ep.style.display='none';
    }
  }

  // ── Schema Cache ──────────────────────────────────────────────────────────
  const _schemaCache={};
  async function getSObjectList(){if(_schemaCache.__objects)return _schemaCache.__objects;const d=await sfREST('GET','/sobjects/');const objs=(d.sobjects||[]).filter(o=>o.queryable).map(o=>({name:o.name,label:o.label})).sort((a,b)=>a.label.localeCompare(b.label));_schemaCache.__objects=objs;return objs;}
  async function getObjectFields(obj){if(_schemaCache[obj])return _schemaCache[obj];const d=await sfREST('GET',`/sobjects/${obj}/describe`);const fields=(d.fields||[]).map(f=>({name:f.name,label:f.label,type:f.type}));_schemaCache[obj]=fields;return fields;}

  const META_TYPES={
    // ── Apex ─────────────────────────────────────────────────────────────────
    ApexClass:            {path:'/tooling/query/?q=SELECT+Id,Name,Body+FROM+ApexClass+ORDER+BY+Name+LIMIT+2000',                              nameField:'Name',        ext:'.cls',                     bodyField:'Body',    icon:'🔷',label:'Apex Classes',       category:'Apex',         dir:'classes'},
    ApexTrigger:          {path:'/tooling/query/?q=SELECT+Id,Name,Body+FROM+ApexTrigger+ORDER+BY+Name+LIMIT+2000',                            nameField:'Name',        ext:'.trigger',                 bodyField:'Body',    icon:'⚡',label:'Triggers',            category:'Apex',         dir:'triggers'},
    ApexPage:             {path:'/tooling/query/?q=SELECT+Id,Name,Markup+FROM+ApexPage+ORDER+BY+Name+LIMIT+2000',                              nameField:'Name',        ext:'.page',                    bodyField:'Markup',  icon:'📄',label:'VF Pages',             category:'Apex',         dir:'pages'},
    ApexComponent:        {path:'/tooling/query/?q=SELECT+Id,Name,Markup+FROM+ApexComponent+ORDER+BY+Name+LIMIT+2000',                        nameField:'Name',        ext:'.component',               bodyField:'Markup',  icon:'🧩',label:'VF Components',        category:'Apex',         dir:'components'},
    ApexTestSuite:        {path:'/tooling/query/?q=SELECT+Id,TestSuiteName+FROM+ApexTestSuite+ORDER+BY+TestSuiteName+LIMIT+2000',              nameField:'TestSuiteName',ext:'.testSuite',              bodyField:null,      icon:'🧪',label:'Test Suites',           category:'Apex',         dir:'testSuites'},
    // ── Lightning ─────────────────────────────────────────────────────────────
    LightningComponentBundle:{path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+LightningComponentBundle+ORDER+BY+DeveloperName+LIMIT+2000',nameField:'DeveloperName',ext:'',                       bodyField:null,      icon:'⚡',label:'LWC',                 category:'Lightning',     dir:'lwc'},
    AuraDefinitionBundle: {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+AuraDefinitionBundle+ORDER+BY+DeveloperName+LIMIT+2000',      nameField:'DeveloperName',ext:'',                        bodyField:null,      icon:'🌩',label:'Aura',                category:'Lightning',     dir:'aura'},
    // ── Automation ───────────────────────────────────────────────────────────
    Flow:                 {path:"/tooling/query/?q=SELECT+Id,MasterLabel+FROM+Flow+WHERE+Status='Active'+ORDER+BY+MasterLabel+LIMIT+2000",     nameField:'MasterLabel', ext:'.flow-meta.json',          bodyField:null,      icon:'🔄',label:'Flows (Active)',       category:'Automation',    dir:'flows'},
    FlowDefinition:       {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+FlowDefinition+ORDER+BY+DeveloperName+LIMIT+2000',             nameField:'DeveloperName',ext:'.flowDefinition',         bodyField:null,      icon:'🔁',label:'Flow Definitions',     category:'Automation',    dir:'flowDefinitions'},
    WorkflowRule:         {path:'/tooling/query/?q=SELECT+Id,Name+FROM+WorkflowRule+ORDER+BY+Name+LIMIT+2000',                                nameField:'Name',        ext:'.workflow',                bodyField:null,      icon:'⚙',label:'Workflow Rules',       category:'Automation',    dir:'workflows'},
    WorkflowAlert:        {path:'/tooling/query/?q=SELECT+Id,Name+FROM+WorkflowAlert+ORDER+BY+Name+LIMIT+2000',                               nameField:'Name',        ext:'.workflowAlert',           bodyField:null,      icon:'🔔',label:'Workflow Alerts',      category:'Automation',    dir:'workflows'},
    WorkflowFieldUpdate:  {path:'/tooling/query/?q=SELECT+Id,Name+FROM+WorkflowFieldUpdate+ORDER+BY+Name+LIMIT+2000',                         nameField:'Name',        ext:'.workflowFieldUpdate',     bodyField:null,      icon:'✏',label:'Field Updates',         category:'Automation',    dir:'workflows'},
    // ── UI / Experience ──────────────────────────────────────────────────────
    FlexiPage:            {path:'/tooling/query/?q=SELECT+Id,MasterLabel+FROM+FlexiPage+ORDER+BY+MasterLabel+LIMIT+2000',                     nameField:'MasterLabel', ext:'.flexipage-meta.json',     bodyField:null,      icon:'📱',label:'Flex Pages',           category:'UI',            dir:'flexipages'},
    Layout:               {path:'/tooling/query/?q=SELECT+Id,Name+FROM+Layout+ORDER+BY+Name+LIMIT+2000',                                      nameField:'Name',        ext:'.layout',                  bodyField:null,      icon:'📐',label:'Page Layouts',          category:'UI',            dir:'layouts'},
    CompactLayout:        {path:'/tooling/query/?q=SELECT+Id,Name+FROM+CompactLayout+ORDER+BY+Name+LIMIT+2000',                               nameField:'Name',        ext:'.compactLayout',           bodyField:null,      icon:'📏',label:'Compact Layouts',       category:'UI',            dir:'compactLayouts'},
    CustomTab:            {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+CustomTab+ORDER+BY+DeveloperName+LIMIT+2000',                  nameField:'DeveloperName',ext:'.tab',                    bodyField:null,      icon:'📑',label:'Custom Tabs',           category:'UI',            dir:'tabs'},
    ListView:             {path:'/tooling/query/?q=SELECT+Id,Name+FROM+ListView+ORDER+BY+Name+LIMIT+2000',                                    nameField:'Name',        ext:'.listView',                bodyField:null,      icon:'📋',label:'List Views',            category:'UI',            dir:'listViews'},
    CustomPageWebLink:    {path:'/tooling/query/?q=SELECT+Id,Name+FROM+CustomPageWebLink+ORDER+BY+Name+LIMIT+2000',                           nameField:'Name',        ext:'.webLink',                 bodyField:null,      icon:'🔗',label:'Web Links',             category:'UI',            dir:'webLinks'},
    // ── Security ─────────────────────────────────────────────────────────────
    PermissionSet:        {path:"/tooling/query/?q=SELECT+Id,Name+FROM+PermissionSet+WHERE+IsCustom=true+ORDER+BY+Name+LIMIT+2000",            nameField:'Name',        ext:'.permissionset-meta.json', bodyField:null,      icon:'🔐',label:'Perm Sets',             category:'Security',      dir:'permissionsets'},
    PermissionSetGroup:   {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+PermissionSetGroup+ORDER+BY+DeveloperName+LIMIT+2000',         nameField:'DeveloperName',ext:'.permissionsetgroup',     bodyField:null,      icon:'🔏',label:'Perm Set Groups',       category:'Security',      dir:'permissionsetgroups'},
    CustomPermission:     {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+CustomPermission+ORDER+BY+DeveloperName+LIMIT+2000',           nameField:'DeveloperName',ext:'.customPermission',       bodyField:null,      icon:'🛡',label:'Custom Perms',          category:'Security',      dir:'customPermissions'},
    SharingRules:         {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+SharingOwnerRule+ORDER+BY+DeveloperName+LIMIT+2000',           nameField:'DeveloperName',ext:'.sharingRules',           bodyField:null,      icon:'🔓',label:'Sharing Rules',          category:'Security',      dir:'sharingRules'},
    // ── Data / Objects ────────────────────────────────────────────────────────
    CustomObject:         {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+CustomObject+ORDER+BY+DeveloperName+LIMIT+2000',               nameField:'DeveloperName',ext:'.object-meta.json',      bodyField:null,      icon:'🗄',label:'Custom Objects',         category:'Data',          dir:'objects'},
    CustomField:          {path:"/tooling/query/?q=SELECT+Id,DeveloperName+FROM+CustomField+WHERE+NamespacePrefix=null+ORDER+BY+DeveloperName+LIMIT+2000", nameField:'DeveloperName', ext:'.field-meta.json', bodyField:null, icon:'🏷',label:'Custom Fields', category:'Data', dir:'objects'},
    CustomMetadataType:   {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+CustomMetadataType+ORDER+BY+DeveloperName+LIMIT+2000',          nameField:'DeveloperName',ext:'.mdt-meta.json',         bodyField:null,      icon:'📊',label:'Custom Metadata Types', category:'Data',          dir:'customMetadata'},
    ValidationRule:       {path:'/tooling/query/?q=SELECT+Id,ValidationName+FROM+ValidationRule+ORDER+BY+ValidationName+LIMIT+2000',           nameField:'ValidationName',ext:'.validationRule',       bodyField:null,      icon:'✅',label:'Validation Rules',       category:'Data',          dir:'validationRules'},
    RecordType:           {path:'/tooling/query/?q=SELECT+Id,Name+FROM+RecordType+ORDER+BY+Name+LIMIT+2000',                                  nameField:'Name',        ext:'.recordType',              bodyField:null,      icon:'📂',label:'Record Types',           category:'Data',          dir:'recordTypes'},
    DuplicateRule:        {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+DuplicateRule+ORDER+BY+DeveloperName+LIMIT+2000',              nameField:'DeveloperName',ext:'.duplicateRule',          bodyField:null,      icon:'🔁',label:'Duplicate Rules',        category:'Data',          dir:'duplicateRules'},
    MatchingRule:         {path:'/tooling/query/?q=SELECT+Id,RuleLabel+FROM+MatchingRule+ORDER+BY+RuleLabel+LIMIT+2000',                       nameField:'RuleLabel',   ext:'.matchingRule',            bodyField:null,      icon:'🔍',label:'Matching Rules',         category:'Data',          dir:'matchingRules'},
    GlobalValueSet:       {path:'/tooling/query/?q=SELECT+Id,MasterLabel+FROM+GlobalValueSet+ORDER+BY+MasterLabel+LIMIT+2000',                 nameField:'MasterLabel', ext:'.globalValueSet',          bodyField:null,      icon:'📝',label:'Global Value Sets',      category:'Data',          dir:'globalValueSets'},
    BusinessProcess:      {path:'/tooling/query/?q=SELECT+Id,Name+FROM+BusinessProcess+ORDER+BY+Name+LIMIT+2000',                             nameField:'Name',        ext:'.businessProcess',         bodyField:null,      icon:'📌',label:'Business Processes',     category:'Data',          dir:'businessProcesses'},
    // ── Config ───────────────────────────────────────────────────────────────
    ExternalString:       {path:'/tooling/query/?q=SELECT+Id,Name+FROM+ExternalString+ORDER+BY+Name+LIMIT+2000',                              nameField:'Name',        ext:'.labels',                  bodyField:null,      icon:'🏷',label:'Custom Labels',          category:'Config',        dir:'labels'},
    // ── Resources ────────────────────────────────────────────────────────────
    StaticResource:       {path:'/tooling/query/?q=SELECT+Id,Name,ContentType+FROM+StaticResource+ORDER+BY+Name+LIMIT+2000',                  nameField:'Name',        ext:'.resource',                bodyField:null,      icon:'📦',label:'Static Resources',       category:'Resources',     dir:'staticresources'},
    ContentAsset:         {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+ContentAsset+ORDER+BY+DeveloperName+LIMIT+2000',               nameField:'DeveloperName',ext:'.asset-meta.json',        bodyField:null,      icon:'🖼',label:'Content Assets',         category:'Resources',     dir:'contentassets'},
    Document:             {path:'/query/?q=SELECT+Id,DeveloperName+FROM+Document+ORDER+BY+DeveloperName+LIMIT+2000',                           nameField:'DeveloperName',ext:'.document',               bodyField:null,      icon:'📁',label:'Documents',              category:'Resources',     dir:'documents'},
    // ── Email ─────────────────────────────────────────────────────────────────
    EmailTemplate:        {path:'/query/?q=SELECT+Id,DeveloperName+FROM+EmailTemplate+ORDER+BY+DeveloperName+LIMIT+2000',                      nameField:'DeveloperName',ext:'.email',                  bodyField:null,      icon:'📧',label:'Email Templates',        category:'Email',         dir:'email'},
    // ── Integration / Connected ───────────────────────────────────────────────
    NamedCredential:      {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+NamedCredential+ORDER+BY+DeveloperName+LIMIT+2000',             nameField:'DeveloperName',ext:'.namedCredential',        bodyField:null,      icon:'🔑',label:'Named Credentials',      category:'Integration',   dir:'namedCredentials'},
    RemoteSiteSetting:    {path:'/tooling/query/?q=SELECT+Id,SiteName+FROM+RemoteSiteSetting+ORDER+BY+SiteName+LIMIT+2000',                    nameField:'SiteName',    ext:'.remoteSite',              bodyField:null,      icon:'🌐',label:'Remote Sites',           category:'Integration',   dir:'remoteSiteSettings'},
    ConnectedApplication: {path:'/tooling/query/?q=SELECT+Id,Name+FROM+ConnectedApplication+ORDER+BY+Name+LIMIT+2000',                        nameField:'Name',        ext:'.connectedApp',            bodyField:null,      icon:'🔌',label:'Connected Apps',         category:'Integration',   dir:'connectedApps'},
    AuthProvider:         {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+AuthProvider+ORDER+BY+DeveloperName+LIMIT+2000',               nameField:'DeveloperName',ext:'.authprovider',            bodyField:null,      icon:'🔒',label:'Auth Providers',         category:'Integration',   dir:'authproviders'},
    // ── Reporting ─────────────────────────────────────────────────────────────
    ReportType:           {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+ReportType+ORDER+BY+DeveloperName+LIMIT+2000',                 nameField:'DeveloperName',ext:'.reportType',             bodyField:null,      icon:'📊',label:'Report Types',           category:'Reporting',     dir:'reportTypes'},
    // ── AI / Bots ────────────────────────────────────────────────────────────
    Bot:                  {path:'/tooling/query/?q=SELECT+Id,DeveloperName+FROM+Bot+ORDER+BY+DeveloperName+LIMIT+2000',                        nameField:'DeveloperName',ext:'.bot',                    bodyField:null,      icon:'🤖',label:'Bots (Einstein)',         category:'AI / Bots',     dir:'bots'},
    // ── OmniStudio ───────────────────────────────────────────────────────────
    OmniScript:           {path:'/tooling/query/?q=SELECT+Id,Name+FROM+OmniScript+ORDER+BY+Name+LIMIT+2000',                                  nameField:'Name',        ext:'.os-meta.json',            bodyField:null,      icon:'🔮',label:'OmniScripts',            category:'OmniStudio',    dir:'omniScripts'},
    OmniDataTransform:    {path:'/tooling/query/?q=SELECT+Id,Name+FROM+OmniDataTransform+ORDER+BY+Name+LIMIT+2000',                           nameField:'Name',        ext:'.odt-meta.json',           bodyField:null,      icon:'🔀',label:'Data Transforms',        category:'OmniStudio',    dir:'dataTransforms'},
    IntegrationProcedure: {path:'/tooling/query/?q=SELECT+Id,Name+FROM+IntegrationProcedure+ORDER+BY+Name+LIMIT+2000',                        nameField:'Name',        ext:'.ip-meta.json',            bodyField:null,      icon:'⚙',label:'Intgr Procedures',       category:'OmniStudio',    dir:'integrationProcedures'},
    FlexCard:             {path:'/tooling/query/?q=SELECT+Id,Name+FROM+FlexCard+ORDER+BY+Name+LIMIT+2000',                                    nameField:'Name',        ext:'.flexCard-meta.json',      bodyField:null,      icon:'🃏',label:'FlexCards',              category:'OmniStudio',    dir:'flexCards'},
  };

  // loadMetadataFiles: graceful error + auto-fallback name fields
  async function loadMetadataFiles(type){
    const cfg=META_TYPES[type];
    if(!cfg)throw new Error('Unknown type: '+type);
    try{
      const data=await sfREST('GET',cfg.path);
      const nameFields=[cfg.nameField,'Name','DeveloperName','MasterLabel','TestSuiteName','ValidationName','RuleLabel','SiteName'];
      return(data.records||[]).map(r=>{
        const name=nameFields.map(f=>r[f]).find(Boolean)||r.Id;
        return{id:r.Id,name,ext:cfg.ext,body:null,type};
      });
    }catch(e){
      log('warn',`${type} skipped: ${e}`,'Git');
      return[];   // silent skip — type may not exist in this org
    }
  }

  // discoverOrgTypes: dynamically finds types present in org but NOT in META_TYPES
  async function discoverOrgTypes(){
    const data=await sfREST('GET','/tooling/sobjects/');
    const SKIP=new Set(['User','Group','Organization','QueueSobject','AsyncApexJob','ApexLog','ApexExecutionOverlayResult','HeapDump','TraceFlag','DebugLevel','EntityDefinition','FieldDefinition','SearchLayout','StandardAction','SynonymGroup','ColorDefinition','IconDefinition','SearchCriteria','SearchFilter','SearchFilterItem','MobileSettings']);
    const known=new Set(Object.keys(META_TYPES));
    return(data.sobjects||[]).filter(s=>
      s.queryable&&s.createable&&!SKIP.has(s.name)&&!known.has(s.name)&&
      !s.name.endsWith('History')&&!s.name.endsWith('Feed')&&!s.name.endsWith('Share')&&
      !s.name.endsWith('ChangeEvent')&&!s.name.endsWith('ViewStat')&&!s.name.endsWith('Tag')&&
      !s.name.includes('__')&&s.name.length<40
    ).map(s=>({
      type:s.name,label:s.label,icon:'🔧',category:'Discovered',
      dir:s.name.toLowerCase()+'s',
      path:`/tooling/query/?q=SELECT+Id,Name+FROM+${s.name}+ORDER+BY+Name+LIMIT+2000`,
      nameField:'Name',ext:'.meta.json',bodyField:null
    }));
  }
  async function fetchFileBody(type,id,fullName){
    const cfg=META_TYPES[type];
    if(cfg?.bodyField){try{const d=await sfREST('GET',`/tooling/query/?q=SELECT+${cfg.bodyField}+FROM+${type}+WHERE+Id='${id}'`);return d.records?.[0]?.[cfg.bodyField]||'';}catch(e){}}
    if(type==='LightningComponentBundle'){const d=await sfREST('GET',`/tooling/query/?q=SELECT+FilePath,Source+FROM+LightningComponentResource+WHERE+LightningComponentBundleId='${id}'+LIMIT+20`);return(d.records||[]).map(r=>`/* ${r.FilePath} */\n${r.Source}`).join('\n\n');}
    if(type==='AuraDefinitionBundle'){const d=await sfREST('GET',`/tooling/query/?q=SELECT+DefType,Source+FROM+AuraDefinition+WHERE+AuraDefinitionBundleId='${id}'+LIMIT+20`);return(d.records||[]).map(r=>`/* ${r.DefType} */\n${r.Source}`).join('\n\n');}
    // Try Tooling Metadata field by Id, then by FullName (for types without Tooling Id)
    try{
      const idQ=id&&id.length>10?`/tooling/query/?q=SELECT+Metadata+FROM+${type}+WHERE+Id='${id}'`:null;
      const fnQ=fullName?`/tooling/query/?q=SELECT+Metadata+FROM+${type}+WHERE+FullName='${encodeURIComponent(fullName)}'`:null;
      const q=idQ||fnQ;
      if(q){const d=await sfREST('GET',q);const m=d.records?.[0]?.Metadata;if(m)return JSON.stringify(m,null,2);}
    }catch(e){}
    return`// Body fetch not implemented for ${type} (${fullName||id})\n// Push this file manually or check Tooling API access.`;
  }

  // ── SOQL Helpers ──────────────────────────────────────────────────────────
  function extractSOQL(text){const m=text.match(/```(?:soql|sql)?\n?(SELECT[\s\S]*?)```/i)||text.match(/(SELECT\s+[\s\S]+?(?:LIMIT\s+\d+\s*|FROM\s+\w+\s*(?:WHERE[\s\S]+?)?)(?=\n\n|\n[A-Z]|$))/i);return m?m[1].trim():null;}

  function formatResultsAsTable(records,totalSize){
    if(!records||records.length===0)return'<div class="sf-result-empty">No records found.</div>';
    const keys=Object.keys(records[0]).filter(k=>k!=='attributes');
    if(!keys.length||(keys.length===1&&keys[0]==='expr0')){const count=keys.length===1?records[0].expr0:totalSize;return`<div class="sf-result-count"><span class="sf-count-number">${count}</span><span class="sf-count-label">records</span></div>`;}
    let html=`<div class="sf-result-meta">${totalSize} record${totalSize!==1?'s':''} · showing ${Math.min(records.length,50)}</div>`;
    html+='<div class="sf-table-wrap"><table class="sf-table"><thead><tr>';
    keys.forEach(k=>{html+=`<th>${escH(k)}</th>`;});
    html+='</tr></thead><tbody>';
    records.slice(0,50).forEach(rec=>{html+='<tr>';keys.forEach(k=>{const v=rec[k];html+=`<td>${v===null||v===undefined?'<span class="sf-null">—</span>':escH(String(v))}</td>`;});html+='</tr>';});
    html+='</tbody></table></div>';
    if(totalSize>50)html+=`<div class="sf-result-more">+ ${totalSize-50} more not shown</div>`;
    return html;
  }

  async function executeSOQLForAI(query){
    try{
      const result=await sfREST('GET','/query/?q='+encodeURIComponent(query));
      const records=result.records||[],total=result.totalSize||0;
      if(records.length===0&&total>0)return{success:true,summary:`Count: ${total}`,data:result,html:`<div class="sf-result-count"><span class="sf-count-number">${total}</span><span class="sf-count-label">records</span></div>`,count:total};
      if(total===0)return{success:true,summary:'Query returned 0 records.',data:result,html:'<div class="sf-result-empty">No records found.</div>'};
      if(records.length>0&&records[0].expr0!==undefined){const count=records[0].expr0;return{success:true,summary:`Count: ${count}`,data:result,html:`<div class="sf-result-count"><span class="sf-count-number">${count}</span><span class="sf-count-label">records</span></div>`,count};}
      const summary=records.slice(0,5).map(r=>Object.entries(r).filter(([k])=>k!=='attributes').map(([k,v])=>`${k}: ${v}`).join(', ')).join('\n');
      return{success:true,summary:`${total} records found.\n${summary}`,data:result,html:formatResultsAsTable(records,total)};
    }catch(e){return{success:false,summary:'SOQL error: '+e};}
  }

  async function buildSchemaContextForAI(userMsg){
    try{
      if(!sfConsentGiven)return'';
      const objs=await getSObjectList().catch(()=>[]);
      const relevant=objs.filter(o=>userMsg.toLowerCase().includes(o.name.toLowerCase())||userMsg.toLowerCase().includes(o.label.toLowerCase())).slice(0,3);
      if(!relevant.length)return'';
      let ctx='\n\n[SF Schema Context]\n';
      for(const obj of relevant){try{const fields=await getObjectFields(obj.name);ctx+=`Object: ${obj.name} (${obj.label})\nFields: ${fields.slice(0,20).map(f=>f.name+':'+f.type).join(', ')}\n`;}catch(e){}}
      return ctx;
    }catch(e){return'';}
  }

  // ── AI API (Groq primary, Claude kept as backup) ──────────────────────────
  let chatHistory=[];

  function buildSystemPrompt(){
    const ctx=detectSession();
    return `You are a Smart Productivity Assistant for ${USER_NAME}, a Salesforce/Monday.com developer.\nCurrent page: ${ctx.pageUrl||'Salesforce'}\n${ctx.sessionId?`SF User: ${ctx.userName||'Unknown'} | Org: ${ctx.orgId||'Unknown'}`:''}\n${sfConsentGiven?'SF access: ENABLED — you can suggest SOQL queries.':'SF access: DISABLED.'}\nBe concise, direct, and helpful. Format with markdown when useful.`;
  }

  async function callGroq(userMsg){
    const key=storageGet('groqApiKey','');
    if(!key)throw'Groq API key not set. Go to ⚙️ Setup.';
    chatHistory.push({role:'user',content:userMsg});
    const resp=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:GROQ_MODEL,max_tokens:1500,messages:[{role:'system',content:buildSystemPrompt()},...chatHistory]})});
    const d=await resp.json();
    if(d.choices?.[0]?.message?.content){const reply=d.choices[0].message.content;chatHistory.push({role:'assistant',content:reply});log('success','Groq → '+reply.length+' chars','AI');return reply;}
    const e=d.error?.message||JSON.stringify(d);log('error',e,'AI');throw e;
  }

  // Kept as backup — not exposed in UI
  async function callClaudeDirect(userMsg){
    const key=storageGet('claudeApiKey','');if(!key)throw'Claude API key not set.';
    chatHistory.push({role:'user',content:userMsg});
    const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:storageGet('claudeDirectModel','claude-haiku-4-5-20251001'),max_tokens:1500,system:buildSystemPrompt(),messages:chatHistory.slice(-20)})});
    const d=await resp.json();
    if(d.content?.[0]?.text){const reply=d.content[0].text;chatHistory.push({role:'assistant',content:reply});return reply;}
    throw d.error?.message||JSON.stringify(d);
  }

  async function callAI(userMsg,skipSOQLLoop=false){
    let enrichedMsg=userMsg;
    if(!skipSOQLLoop&&sfConsentGiven){const sc=await buildSchemaContextForAI(userMsg).catch(()=>'');if(sc)enrichedMsg=userMsg+sc;}
    let reply=await callGroq(enrichedMsg);
    if(!skipSOQLLoop&&sfConsentGiven){
      const soql=extractSOQL(reply);
      if(soql){
        log('info','Auto-executing SOQL: '+soql.substring(0,60),'SmartLoop');
        updateThinkingLabel('Fetching data from Salesforce…');
        const result=await executeSOQLForAI(soql);
        const followUp=`[SF_DATA] Results for: ${soql}\n\n${result.summary}\n\nGive a clear direct answer. No SOQL.`;
        chatHistory.push({role:'user',content:followUp});
        updateThinkingLabel('Interpreting results…');
        try{reply=await callGroq(followUp);}catch(e){reply=`Here's what I found:\n\n${result.summary}`;}
        reply='__HAS_TABLE__'+JSON.stringify({text:reply,html:result.html,soql})+'__HAS_TABLE__';
      }
    }
    return reply;
  }

  function updateThinkingLabel(text){const el=document.getElementById('kp-thinking-label');if(el)el.textContent=text;}

  // ── GitHub API ────────────────────────────────────────────────────────────
  async function ghAPI(method,path,body){
    const token=storageGet('githubToken','');
    if(!token)throw'GitHub token not set.';
    const resp=await fetch('https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github.v3+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:body?JSON.stringify(body):undefined});
    const d=await resp.json();
    if(resp.ok){log('success',`GH ${resp.status}`,'GitHub');return d;}
    log('error',`GH ${resp.status}: ${d.message}`,'GitHub');throw d.message;
  }
  const ghGetUser     =()=>ghAPI('GET','/user');
  const ghListRepos   =()=>ghAPI('GET','/user/repos?sort=pushed&per_page=50&affiliation=owner,collaborator,organization_member');
  const ghGetBranches =(o,r)=>ghAPI('GET',`/repos/${o}/${r}/branches`);
  const ghGetContents =(o,r,p,b)=>ghAPI('GET',`/repos/${o}/${r}/contents/${p}${b?'?ref='+b:''}`);
  const ghGetCommits  =(o,r,b)=>ghAPI('GET',`/repos/${o}/${r}/commits?sha=${b}&per_page=10`);
  const ghCreateBranch=async(o,r,nb,fb)=>{const ref=await ghAPI('GET',`/repos/${o}/${r}/git/ref/heads/${fb}`);return ghAPI('POST',`/repos/${o}/${r}/git/refs`,{ref:`refs/heads/${nb}`,sha:ref.object.sha});};
  const ghCreatePR    =(o,r,t,b,h,base)=>ghAPI('POST',`/repos/${o}/${r}/pulls`,{title:t,body:b,head:h,base});
  async function ghCommitFile(o,r,fp,content,msg,branch,sha){const body={message:msg,content:btoa(unescape(encodeURIComponent(content))),branch};if(sha)body.sha=sha;return ghAPI('PUT',`/repos/${o}/${r}/contents/${fp}`,body);}

  function generateBackupBranchName(){const now=new Date(),pad=n=>String(n).padStart(2,'0');return`source-code-backup-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;}

  async function backupSourceCode(){
    const btn=null,res=document.getElementById('git-push-result');
    if(!selectedRepo){alert('Select a GitHub repo first.');return;}
    const branchName=generateBackupBranchName(),[o,r]=selectedRepo.split('/');
    btn.disabled=true;btn.textContent='⏳ Backing up…';
    res.style.display='block';res.className='git-push-result';res.textContent=`Creating branch ${branchName}…`;
    try{
      const baseBranch=document.getElementById('git-branch-select')?.value||'main';
      try{await ghCreateBranch(o,r,branchName,baseBranch);}catch(e){try{await ghCreateBranch(o,r,branchName,'main');}catch(e2){throw'Could not create branch: '+e2;}}
      let spaSource='';
      try{const su=chrome.runtime.getURL('content.js');if(su){const resp=await fetch(su);spaSource=await resp.text();}}catch(e){}
      if(!spaSource)document.querySelectorAll('script').forEach(s=>{if(s.textContent&&s.textContent.includes('__spa_injected__')&&s.textContent.length>1000)spaSource=s.textContent;});
      if(!spaSource)spaSource=`// Smart Assistant v9 — Source Backup\n// Backup: ${new Date().toISOString()}\n`;
      res.textContent='Uploading source code…';
      const filePath=`backups/content-js-${branchName}.js`;
      let sha;try{const ex=await ghGetContents(o,r,filePath,branchName);sha=ex.sha;}catch(e){}
      await ghCommitFile(o,r,filePath,spaSource,`source code backup — ${new Date().toISOString()}`,branchName,sha);
      await ghCommitFile(o,r,`backups/README-${branchName}.md`,`# Backup\n\n**Date:** ${new Date().toISOString()}\n**Branch:** ${branchName}\n`,`source code backup: README`,branchName,undefined);
      res.className='git-push-result ok';res.textContent=`✅ Backup complete!\nBranch: ${branchName}`;
      showPushLinks(branchName,document.getElementById('git-branch-select')?.value||'main');
      btn.textContent='✅ Backed Up';log('success','Backed up to '+branchName,'Backup');
      setTimeout(()=>{btn.textContent='☁ Backup Source';btn.disabled=false;},3000);
      await loadCommits();
    }catch(e){res.className='git-push-result fail';res.textContent='❌ Backup failed: '+e;btn.textContent='☁ Backup Source';btn.disabled=false;}
  }

  // ── Monday.com API ────────────────────────────────────────────────────────
  async function mondayGQL(query){
    const token=storageGet('mondayToken','');
    if(!token)throw'Monday token not set. Go to ⚙️ Setup.';
    const resp=await fetch('https://api.monday.com/v2',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','API-Version':'2024-10'},body:JSON.stringify({query})});
    const d=await resp.json();
    if(d.errors){log('error','Monday error: '+JSON.stringify(d.errors[0]),'Monday');throw d.errors[0]?.message||'Monday API error';}
    log('success','Monday GQL OK','Monday');return d.data;
  }

  async function mondayGetBoards(){const d=await mondayGQL(`{boards(limit:100,order_by:used_at){id name items_count groups{id title}}}`);return d.boards||[];}
  async function mondayGetColumns(boardId){const d=await mondayGQL(`{boards(ids:[${boardId}]){columns{id title type settings_str}}}`);return d.boards?.[0]?.columns||[];}
  async function mondayGetStatusLabels(boardId,colId){try{const cols=await mondayGetColumns(boardId);const col=cols.find(c=>c.id===colId);if(!col||!col.settings_str)return{};const s=JSON.parse(col.settings_str);return s.labels||{};}catch(e){return{};}}
  async function mondayGetItems(boardId,groupId){
    const FIELDS='id name state group{id title} column_values{id text type value ... on StatusValue{label index} ... on DateValue{date} ... on TextValue{text} ... on NumbersValue{number} ... on LongTextValue{text} ... on PeopleValue{persons_and_teams{id kind}} ... on CheckboxValue{checked}}';
    try{
      if(groupId){const q='{boards(ids:['+boardId+']){name groups(ids:["'+groupId+'"]){id title items_page(limit:500){items{'+FIELDS+'}}}}}';const d=await mondayGQL(q);const grp=d.boards?.[0]?.groups?.[0];return{name:d.boards?.[0]?.name,items_page:{items:grp?.items_page?.items||[]}};}
      else{const q='{boards(ids:['+boardId+']){name items_page(limit:500){items{'+FIELDS+'}}}}';const d=await mondayGQL(q);return d.boards?.[0]||{};}
    }catch(error){log('error','mondayGetItems failed: '+error,'Monday');throw error;}
  }
  async function mondayGetGroups(boardId){const d=await mondayGQL(`{boards(ids:[${boardId}]){groups{id title}}}`);return d.boards?.[0]?.groups||[];}
  async function mondayUpdateStatusByIndex(boardId,itemId,colId,idx){const v=JSON.stringify({index:idx}),esc=v.replace(/"/g,'\\"');await mondayGQL(`mutation{change_column_value(board_id:${boardId},item_id:${itemId},column_id:"${colId}",value:"${esc}"){id}}`);log('success','Status updated OK','Monday');}
  async function mondayCreateItem(boardId,itemName,groupId){const gp=groupId?`,group_id:"${groupId}"`:'';;const safe=itemName.replace(/\\/g,'\\\\').replace(/"/g,'\\"');const d=await mondayGQL(`mutation{create_item(board_id:${boardId}${gp},item_name:"${safe}"){id name}}`);return d.create_item;}

  // ── Monday STATE ──────────────────────────────────────────────────────────
  let mondayBoards=[],mondayItems=[],mondayBoardId=null;
  let mondayAllColumns=[],mondayVisibleColIds=[];
  let mondayOwnerFilterValue='__me__',mondayDateFilter='all';
  let mondayColConfig={statusColId:null,dateColId:null,ownerColId:null};
  let mondayActiveInnerTab='tasks',mondayBoardMap={tasks:null,bugs:null};
  const _mondayStatusCache={};

  async function getMondayStatusLabels(boardId,colId){if(!colId)return{};if(!_mondayStatusCache[boardId])_mondayStatusCache[boardId]={};if(!_mondayStatusCache[boardId][colId])_mondayStatusCache[boardId][colId]=await mondayGetStatusLabels(boardId,colId);return _mondayStatusCache[boardId][colId];}

  function mnStatusColor(label){if(!label)return'#9ca3af';const l=label.toLowerCase();if(l.includes('done')||l.includes('complete')||l.includes('deployed'))return'#16a34a';if(l.includes('progress')||l.includes('working')||l.includes('ongoing'))return'#2563eb';if(l.includes('stuck')||l.includes('block')||l.includes('re-open'))return'#dc2626';if(l.includes('review')||l.includes('qa')||l.includes('waiting'))return'#d97706';if(l.includes('pending')||l.includes('hold'))return'#7c3aed';return'#6b7280';}

  function mapBoardsByName(allBoards){
    mondayBoardMap={tasks:null,bugs:null};
    // Priority 1: use board IDs saved in Config
    const storedTasksId=storageGet('mondayTasksBoardId','');
    const storedBugsId=storageGet('mondayBugsBoardId','');
    if(storedTasksId){mondayBoardMap.tasks=storedTasksId;log('success',`✓ Tasks board (config): ${storedTasksId}`,'Monday');}
    if(storedBugsId){mondayBoardMap.bugs=storedBugsId;log('success',`✓ Bugs board (config): ${storedBugsId}`,'Monday');}
    // Priority 2: keyword detection fallback (only for whichever is still missing)
    if(!mondayBoardMap.tasks||!mondayBoardMap.bugs){
      log('info',`Available boards: ${allBoards.map(b=>`"${b.name}" (${b.id})`).join(', ')}`,'Monday');
      allBoards.forEach(b=>{const n=b.name.toLowerCase();if(!mondayBoardMap.tasks&&n.includes('kmtsl')&&n.includes('task')){mondayBoardMap.tasks=b.id;log('success',`✓ Tasks board (auto): "${b.name}" → ${b.id}`,'Monday');}if(!mondayBoardMap.bugs&&n.includes('kmtsl')&&n.includes('bug')){mondayBoardMap.bugs=b.id;log('success',`✓ Bugs board (auto): "${b.name}" → ${b.id}`,'Monday');}});
      if(!mondayBoardMap.tasks){const tb=allBoards.find(b=>b.name.toLowerCase()==='kmtsl tasks');if(tb)mondayBoardMap.tasks=tb.id;}
      if(!mondayBoardMap.bugs){const bb=allBoards.find(b=>b.name.toLowerCase()==='kmtsl bugs queue');if(bb)mondayBoardMap.bugs=bb.id;}
    }
    log('info',`Board map: tasks=${mondayBoardMap.tasks} bugs=${mondayBoardMap.bugs}`,'Monday');
  }

  async function switchMondayInnerTab(tab){
    mondayActiveInnerTab=tab;
    document.querySelectorAll('.mn-inner-tab').forEach(t=>t.classList.toggle('active',t.dataset.inner===tab));
    const boardId=mondayBoardMap[tab];
    if(!boardId){const b=document.getElementById('mn-body');if(b)b.innerHTML=`<div class="mn-empty" style="color:#d97706">⚠️ No board mapped for ${tab}.</div>`;return;}
    mondayOwnerFilterValue='__me__';
    if(mondayBoardId!==boardId){
      mondayBoardId=boardId;storageSet('mondayBoardId',boardId);
      document.getElementById('mn-body').innerHTML='<div class="mn-empty">Loading…</div>';
      try{mondayAllColumns=await mondayGetColumns(boardId);autoDetectMondayColumns();renderMondayColConfigPanel();if(mondayColConfig.statusColId)await getMondayStatusLabels(boardId,mondayColConfig.statusColId);}catch(e){log('error','Column load failed: '+e,'Monday');}
      const board=mondayBoards.find(b=>b.id===boardId);if(board)populateGroupFilter(board);
    }
    await loadMondayItems();
  }

  async function loadMondayBoards(){
    try{
      mondayBoards=await mondayGetBoards();
      mapBoardsByName(mondayBoards);
      const taskTab=document.getElementById('mn-inner-tasks'),bugTab=document.getElementById('mn-inner-bugs');
      const tb=mondayBoards.find(b=>b.id===mondayBoardMap.tasks),bb=mondayBoards.find(b=>b.id===mondayBoardMap.bugs);
      if(taskTab&&tb)taskTab.title=tb.name;
      if(bugTab&&bb)bugTab.title=bb.name;
      log('success','Monday boards loaded: '+mondayBoards.length,'Monday');
      await switchMondayInnerTab('tasks');
    }catch(e){log('error','Monday boards failed: '+e,'Monday');const b=document.getElementById('mn-body');if(b)b.innerHTML=`<div class="mn-empty" style="color:var(--danger)">${escH(String(e))}</div>`;}
  }

  function populateGroupFilter(board){
    const grpSel=document.getElementById('mn-group-sel-filter');if(!grpSel)return;
    const groups=board.groups||[],saved=storageGet('mondayGroupId_'+board.id,'');
    grpSel.innerHTML='<option value="">All groups</option>'+groups.map(g=>`<option value="${escH(g.id)}" ${g.id===saved?'selected':''}>${escH(g.title)}</option>`).join('');
    const grpLabel=document.getElementById('mn-group-label');
    grpSel.style.display=groups.length>0?'block':'none';
    if(grpLabel)grpLabel.style.display=groups.length>0?'inline':'none';
  }

  function autoDetectMondayColumns(){
    const colorCols=mondayAllColumns.filter(c=>c.type==='color'||c.type==='status');
    const dateCols=mondayAllColumns.filter(c=>c.type==='date');
    const peopleCols=mondayAllColumns.filter(c=>c.type==='multiple-person'||c.type==='person'||c.type==='people');
    const det={
      statusColId:colorCols.find(c=>c.title.toLowerCase().includes('status'))?.id||colorCols.find(c=>c.id==='task_status')?.id||colorCols.find(c=>c.id==='status')?.id||colorCols[0]?.id||null,
      dateColId:dateCols.find(c=>c.title.toLowerCase().includes('start'))?.id||dateCols.find(c=>c.title.toLowerCase().includes('due'))?.id||dateCols.find(c=>c.title.toLowerCase().includes('date'))?.id||dateCols[0]?.id||null,
      ownerColId:(mondayBoardId===mondayBoardMap.bugs?peopleCols.find(c=>c.id==='multiple_person_mkw9ak2n')?.id:peopleCols.find(c=>c.id==='task_owner')?.id)||peopleCols.find(c=>c.title.toLowerCase().includes('assign'))?.id||peopleCols.find(c=>c.title.toLowerCase().includes('owner'))?.id||peopleCols.find(c=>c.id==='people')?.id||peopleCols[0]?.id||null
    };
    const saved=storageGet('mondayColConfig_'+mondayBoardId,null);
    if(saved){try{const p=JSON.parse(saved);const ids=mondayAllColumns.map(c=>c.id);if(p.statusColId&&ids.includes(p.statusColId))det.statusColId=p.statusColId;if(p.dateColId&&ids.includes(p.dateColId))det.dateColId=p.dateColId;if(p.ownerColId&&ids.includes(p.ownerColId))det.ownerColId=p.ownerColId;}catch(e){}}
    mondayColConfig=det;
    const savedVis=storageGet('mondayVisibleCols_'+mondayBoardId,null);
    if(savedVis){try{mondayVisibleColIds=JSON.parse(savedVis).filter(id=>mondayAllColumns.find(c=>c.id===id));}catch(e){mondayVisibleColIds=[mondayColConfig.ownerColId].filter(Boolean);}}
    else mondayVisibleColIds=[mondayColConfig.ownerColId].filter(Boolean);
    log('info',`Detected: status=${mondayColConfig.statusColId} date=${mondayColConfig.dateColId} owner=${mondayColConfig.ownerColId}`,'Monday');
  }

  function renderMondayColConfigPanel(){
    const container=document.getElementById('mn-col-config-body');if(!container)return;
    const colorCols=mondayAllColumns.filter(c=>c.type==='color'||c.type==='status');
    const dateCols=mondayAllColumns.filter(c=>c.type==='date');
    const peopleCols=mondayAllColumns.filter(c=>c.type==='multiple-person'||c.type==='person'||c.type==='people');
    const mkOpts=(cols,sel)=>'<option value="">— None —</option>'+cols.map(c=>`<option value="${escH(c.id)}" ${c.id===sel?'selected':''}>${escH(c.title)}</option>`).join('');
    container.innerHTML=`
      <div class="mn-config-row"><span class="mn-config-label">📊 Status column</span><select class="mn-config-sel" id="mn-cfg-status">${mkOpts(colorCols,mondayColConfig.statusColId)}</select></div>
      <div class="mn-config-row"><span class="mn-config-label">📅 Date column</span><select class="mn-config-sel" id="mn-cfg-date">${mkOpts(dateCols,mondayColConfig.dateColId)}</select></div>
      <div class="mn-config-row"><span class="mn-config-label">👤 Owner column</span><select class="mn-config-sel" id="mn-cfg-owner">${mkOpts(peopleCols,mondayColConfig.ownerColId)}</select></div>
      <div style="padding:6px 10px;font-size:9.5px;font-weight:700;color:var(--text-primary);border-top:1px solid var(--border)">📋 Extra display columns</div>
      <div id="mn-extra-col-list" style="display:flex;flex-direction:column;max-height:140px;overflow-y:auto;border-bottom:1px solid var(--border);">${mondayAllColumns.map(col=>{const isChecked=mondayVisibleColIds.includes(col.id);return`<label class="mn-col-check-item"><input type="checkbox" class="mn-extra-cb" data-id="${escH(col.id)}" ${isChecked?'checked':''}><span class="mn-col-name">${escH(col.title)}</span><span class="mn-col-type">[${escH(col.type)}]</span></label>`;}).join('')}</div>
      <div style="padding:8px 10px"><button class="kp-btn primary" id="mn-cfg-save" style="width:100%">✓ Apply</button></div>`;
    document.getElementById('mn-cfg-save')?.addEventListener('click',()=>{
      mondayColConfig.statusColId=document.getElementById('mn-cfg-status')?.value||null;
      mondayColConfig.dateColId=document.getElementById('mn-cfg-date')?.value||null;
      mondayColConfig.ownerColId=document.getElementById('mn-cfg-owner')?.value||null;
      mondayVisibleColIds=Array.from(document.querySelectorAll('.mn-extra-cb:checked')).map(c=>c.dataset.id);
      storageSet('mondayColConfig_'+mondayBoardId,JSON.stringify(mondayColConfig));
      storageSet('mondayVisibleCols_'+mondayBoardId,JSON.stringify(mondayVisibleColIds));
      if(_mondayStatusCache[mondayBoardId])delete _mondayStatusCache[mondayBoardId];
      document.getElementById('mn-col-panel').classList.remove('show');
      if(mondayColConfig.statusColId)getMondayStatusLabels(mondayBoardId,mondayColConfig.statusColId).then(()=>renderMondayItems());
      else renderMondayItems();
    });
  }

  function parsePersonNames(cv){
    if(!cv)return[];
    if(cv.persons_and_teams&&Array.isArray(cv.persons_and_teams))return cv.persons_and_teams.map(x=>String(x.id));
    try{if(cv.value){const p=JSON.parse(cv.value);const arr=p.personsAndTeams||p.persons_and_teams||[];if(arr.length)return arr.map(x=>String(x.id));}}catch(e){}
    if(cv.text&&cv.text.trim())return cv.text.split(/,\s*/).filter(Boolean);
    return[];
  }

  function matchesDateFilter(item,filter){
    if(filter==='all')return true;
    const dcId=mondayColConfig.dateColId;if(!dcId)return true;
    const cv=item.column_values?.find(c=>c.id===dcId);
    const ds=cv?.date||cv?.text||'';if(!ds)return false;
    const today=new Date();today.setHours(0,0,0,0);
    const iDate=new Date(ds+'T00:00:00');
    if(filter==='today')return iDate.toDateString()===today.toDateString();
    if(filter==='yesterday'){const y=new Date(today);y.setDate(y.getDate()-1);return iDate.toDateString()===y.toDateString();}
    if(filter==='thisweek'){const s=new Date(today);s.setDate(today.getDate()-today.getDay());const e=new Date(s);e.setDate(s.getDate()+6);return iDate>=s&&iDate<=e;}
    if(filter==='lastweek'){const stw=new Date(today);stw.setDate(today.getDate()-today.getDay());const el=new Date(stw);el.setDate(stw.getDate()-1);const sl=new Date(el);sl.setDate(el.getDate()-6);return iDate>=sl&&iDate<=el;}
    return true;
  }

  function matchesOwnerFilter(item,ownerFilter){
    if(!ownerFilter)return true;
    const cv=item.column_values?.find(c=>c.id===mondayColConfig.ownerColId);if(!cv)return false;
    const ids=parsePersonNames(cv);
    if(ownerFilter==='__me__'){const matched=ids.includes(MY_MONDAY_USER_ID);const nameMatched=!ids.length&&cv.text&&(cv.text.toLowerCase().includes(USER_NAME.toLowerCase()));return matched||nameMatched;}
    return ids.some(id=>id.toLowerCase().includes(ownerFilter.toLowerCase()))||(cv.text&&cv.text.toLowerCase().includes(ownerFilter.toLowerCase()));
  }

  function getItemStatus(item){if(!mondayColConfig.statusColId)return'';const sc=item.column_values?.find(c=>c.id===mondayColConfig.statusColId);return sc?.label||sc?.text||'';}

  async function loadMondayItems(){
    if(!mondayBoardId)return;
    try{
      const grpSel=document.getElementById('mn-group-sel-filter');
      const groupId=grpSel?.value||storageGet('mondayGroupId_'+mondayBoardId,'')||'';
      const board=await mondayGetItems(mondayBoardId,groupId||undefined);
      mondayItems=board.items_page?.items||[];
      log('info',`Loaded ${mondayItems.length} items`,'Monday');
      renderMondayOwnerFilter();renderMondayItems();
    }catch(e){log('error','Monday items failed: '+e,'Monday');const b=document.getElementById('mn-body');if(b)b.innerHTML=`<div class="mn-empty" style="color:var(--danger)">Error: ${escH(String(e))}</div>`;}
  }

  function renderMondayOwnerFilter(){
    const container=document.getElementById('mn-owner-filter');if(!container)return;
    if(!mondayColConfig.ownerColId){container.innerHTML='<span style="font-size:9.5px;color:var(--text-muted)">No owner col</span>';return;}
    const ownerSet=new Set();
    mondayItems.forEach(item=>{const cv=item.column_values?.find(c=>c.id===mondayColConfig.ownerColId);if(!cv)return;parsePersonNames(cv).forEach(n=>ownerSet.add(n));});
    const owners=Array.from(ownerSet).sort();
    const ownerCol=mondayAllColumns.find(c=>c.id===mondayColConfig.ownerColId);
    container.innerHTML=`<span style="font-size:9.5px;font-weight:600;color:var(--text-muted);white-space:nowrap">${escH(ownerCol?.title||'Owner')}:</span><select class="mn-filter-sel" id="mn-owner-sel"><option value="">All</option><option value="__me__">🙋 Me (${USER_NAME})</option>${owners.map(o=>`<option value="${escH(o)}">${escH(o)}</option>`).join('')}</select>`;
    const sel=document.getElementById('mn-owner-sel');
    if(sel){sel.value=mondayOwnerFilterValue||'__me__';sel.addEventListener('change',e=>{mondayOwnerFilterValue=e.target.value;renderMondayItems();});}
  }

  function renderMondayItems(){
    const today=new Date().toISOString().split('T')[0];
    const show=mondayItems.filter(item=>matchesDateFilter(item,mondayDateFilter)&&matchesOwnerFilter(item,mondayOwnerFilterValue));
    log('info',`After filter: ${show.length}/${mondayItems.length}`,'Monday');
    const prog=show.filter(i=>{const s=getItemStatus(i).toLowerCase();return s.includes('progress')||s.includes('ongoing');}).length;
    const stuck=show.filter(i=>{const s=getItemStatus(i).toLowerCase();return s.includes('stuck')||s.includes('re-open');}).length;
    const done=show.filter(i=>{const s=getItemStatus(i).toLowerCase();return s.includes('done')||s.includes('deployed');}).length;
    const stats=document.getElementById('mn-stats');
    if(stats){stats.style.display='flex';document.getElementById('mn-s-total').textContent=show.length;document.getElementById('mn-s-prog').textContent=prog;document.getElementById('mn-s-stuck').textContent=stuck;document.getElementById('mn-s-done').textContent=done;}
    const body=document.getElementById('mn-body');if(!body)return;
    if(!show.length){body.innerHTML=`<div class="mn-empty">${{today:'🎉 No tasks for today!',yesterday:'No tasks yesterday.',thisweek:'No tasks this week.',lastweek:'No tasks last week.',all:'No items found for you.'}[mondayDateFilter]||'No items found.'}</div>`;return;}
    body.innerHTML=show.map(item=>{
      const sc=item.column_values?.find(c=>c.id===mondayColConfig.statusColId);
      const dc=item.column_values?.find(c=>c.id===mondayColConfig.dateColId);
      const status=sc?.label||sc?.text||(mondayColConfig.statusColId?'—':''),due=dc?.date||dc?.text||'';
      const overdue=due&&due<today,col=mnStatusColor(status);
      const extraCols=mondayVisibleColIds.filter(id=>id!==mondayColConfig.statusColId&&id!==mondayColConfig.dateColId).map(colId=>{const cv=item.column_values?.find(c=>c.id===colId);if(!cv)return'';const colDef=mondayAllColumns.find(c=>c.id===colId);let val=cv.text||cv.label||'';if(!val){const n=parsePersonNames(cv);val=n.join(', ');}if(!val||val==='—')return'';return`<span class="mn-extra-col" title="${escH(colDef?.title||colId)}">${escH(String(val).substring(0,25))}</span>`;}).join('');
      const colorColOptions=mondayAllColumns.filter(c=>c.type==='color'||c.type==='status').map(c=>`<option value="${escH(c.id)}" ${c.id===mondayColConfig.statusColId?'selected':''}>${escH(c.title)}</option>`).join('');
      return`<div class="mn-item" data-id="${item.id}">
        <div class="mn-item-main">
          <div class="mn-item-name" title="${escH(item.name)}">${escH(item.name.substring(0,60))}${item.name.length>60?'…':''}</div>
          <div class="mn-item-meta">
            ${due?`<span class="mn-due${overdue?' overdue':''}">${overdue?'⚠️ ':''}${due}</span>`:''}
            ${status?`<span class="mn-pill" style="background:${col}18;color:${col};border:1px solid ${col}35">${escH(status)}</span>`:''}
            ${extraCols}
          </div>
          <div class="mn-status-editor" style="display:none"><div class="mn-status-editor-inner">
            <div style="font-size:9px;color:var(--accent);font-weight:700;margin-bottom:5px">UPDATE STATUS</div>
            <select class="mn-status-col-sel" data-item="${item.id}"><option value="">Select column…</option>${colorColOptions}</select>
            <select class="mn-status-val-sel" data-item="${item.id}" style="display:none"><option>— select column first —</option></select>
            <div style="display:flex;gap:4px;margin-top:6px"><button class="mn-save-btn" data-item="${item.id}">✓ Save</button><button class="mn-cancel-status-btn" data-item="${item.id}">Cancel</button></div>
          </div></div>
        </div>
        <div class="mn-actions"><button class="mn-btn mn-edit-btn" data-id="${item.id}" title="Edit status">✏️</button></div>
      </div>`;
    }).join('');
    body.querySelectorAll('.mn-edit-btn').forEach(btn=>{btn.addEventListener('click',()=>{const itemEl=btn.closest('.mn-item'),editor=itemEl.querySelector('.mn-status-editor'),shown=editor.style.display!=='none';editor.style.display=shown?'none':'block';btn.textContent=shown?'✏️':'✕';});});
    body.querySelectorAll('.mn-status-col-sel').forEach(sel=>{
      sel.addEventListener('change',async()=>{const colId=sel.value,itemEl=sel.closest('.mn-item'),valSel=itemEl.querySelector('.mn-status-val-sel');if(!colId){valSel.style.display='none';return;}valSel.style.display='block';valSel.innerHTML='<option>Loading…</option>';try{const labels=await getMondayStatusLabels(mondayBoardId,colId);const entries=Object.entries(labels);valSel.innerHTML=entries.length?entries.map(([idx,lbl])=>`<option value="${escH(idx)}">${escH(String(lbl))}</option>`).join(''):'<option value="">No labels found</option>';}catch(e){valSel.innerHTML='<option value="">Error</option>';}});
      if(sel.value)sel.dispatchEvent(new Event('change'));
    });
    body.querySelectorAll('.mn-save-btn').forEach(btn=>{
      btn.addEventListener('click',async()=>{const itemEl=btn.closest('.mn-item'),colSel=itemEl.querySelector('.mn-status-col-sel'),valSel=itemEl.querySelector('.mn-status-val-sel');const colId=colSel?.value,idx=valSel?.value;if(!colId){alert('Select a status column first.');return;}if(idx===''||idx===undefined){alert('Select a status value.');return;}btn.textContent='⏳';btn.disabled=true;try{await mondayUpdateStatusByIndex(mondayBoardId,btn.dataset.item,colId,parseInt(idx,10));await loadMondayItems();}catch(e){alert('Failed: '+e);btn.textContent='✓ Save';btn.disabled=false;}});
    });
    body.querySelectorAll('.mn-cancel-status-btn').forEach(btn=>{btn.addEventListener('click',()=>{const itemEl=btn.closest('.mn-item');itemEl.querySelector('.mn-status-editor').style.display='none';itemEl.querySelector('.mn-edit-btn').textContent='✏️';});});
  }

  async function fetchMondayTasksForChat(type,groupName){
    if(!storageGet('mondayToken',''))return null;
    try{
      if(!mondayBoardMap.tasks&&!mondayBoardMap.bugs){const all=await mondayGetBoards();mondayBoards=all;mapBoardsByName(all);}
      const boardId=type==='bugs'?mondayBoardMap.bugs:mondayBoardMap.tasks;
      if(!boardId)return{items:[],boardName:type==='bugs'?'KMTSL Bugs Queue':'KMTSL Tasks'};
      if(mondayBoardId!==boardId||!mondayColConfig.ownerColId){mondayBoardId=boardId;mondayAllColumns=await mondayGetColumns(boardId);autoDetectMondayColumns();}
      const todayStr=new Date().toISOString().split('T')[0];
      const FIELDS='id name state group{id title} column_values{id text type value ... on StatusValue{label index} ... on DateValue{date} ... on TextValue{text} ... on PeopleValue{persons_and_teams{id kind}}}';
      let query;
      if(mondayColConfig.dateColId){query=`{boards(ids:[${boardId}]){name items_page(limit:500 query_params:{rules:[{column_id:"${mondayColConfig.dateColId}" compare_value:["EXACT","${todayStr}"] compare_attribute:"START_DATE" operator:greater_than_or_equals}{column_id:"${mondayColConfig.dateColId}" compare_value:["EXACT","${todayStr}"] compare_attribute:"END_DATE" operator:lower_than_or_equal}] operator:and}){items{${FIELDS}}}}}`;}
      else{query=`{boards(ids:[${boardId}]){name items_page(limit:500){items{${FIELDS}}}}}`;}
      const d=await mondayGQL(query);
      const allItems=d.boards?.[0]?.items_page?.items||[];
      const items=allItems.filter(item=>{if(item.state&&item.state!=='active')return false;const oc=item.column_values?.find(c=>c.id===mondayColConfig.ownerColId);if(!oc)return false;const ids=parsePersonNames(oc);if(ids.length>0)return ids.includes(MY_MONDAY_USER_ID);return oc.text&&(oc.text.toLowerCase().includes(USER_NAME.toLowerCase()));});
      const board=mondayBoards.find(b=>b.id===boardId);
      return{items,boardName:board?.name||(type==='bugs'?'KMTSL Bugs Queue':'KMTSL Tasks')};
    }catch(e){log('error','Chat Monday fetch: '+e,'Monday');return null;}
  }

  // ── SOQL Builder State ────────────────────────────────────────────────────
  let soqlBuilderObject=null,soqlBuilderFields=[];

  async function loadSOQLObjects(){const sel=document.getElementById('soql-obj-select');if(!sel)return;sel.innerHTML='<option value="">Loading…</option>';try{const objs=await getSObjectList();sel.innerHTML='<option value="">Select object…</option>'+objs.map(o=>`<option value="${o.name}">${escH(o.label)} (${o.name})</option>`).join('');log('success','SOQL: loaded '+objs.length+' objects','SOQL');}catch(e){sel.innerHTML='<option value="">Error loading objects</option>';log('error','SOQL objects: '+e,'SOQL');}}
  async function onSOQLObjectChange(objectName){if(!objectName)return;soqlBuilderObject=objectName;const fieldSel=document.getElementById('soql-field-select'),baseQuery=document.getElementById('soql-input');if(fieldSel){fieldSel.innerHTML='<option value="">Loading fields…</option>';try{soqlBuilderFields=await getObjectFields(objectName);fieldSel.innerHTML='<option value="">+ Add field…</option>'+soqlBuilderFields.map(f=>`<option value="${f.name}">${escH(f.label)} (${f.name}) [${f.type}]</option>`).join('');}catch(e){fieldSel.innerHTML='<option>Error</option>';}}if(baseQuery&&!baseQuery.value.trim())baseQuery.value=`SELECT Id, Name FROM ${objectName} LIMIT 20`;}
  function addFieldToSOQL(fieldName){if(!fieldName)return;const ta=document.getElementById('soql-input');if(!ta)return;const q=ta.value,sm=q.match(/^(SELECT\s+)(.*?)(\s+FROM\s+)/i);if(sm){const cf=sm[2].trim();if(!cf.toLowerCase().includes(fieldName.toLowerCase()))ta.value=q.replace(sm[0],`${sm[1]}${cf}, ${fieldName}${sm[3]}`);}else ta.value='SELECT Id, '+fieldName+' FROM ';const sel=document.getElementById('soql-field-select');if(sel)sel.value='';}
  function insertDateFilter(filter){
    const ta=document.getElementById('soql-input');if(!ta)return;
    let q=ta.value.trim();
    if(!q){ta.value=`SELECT Id, Name FROM Contract WHERE CreatedDate = ${filter} LIMIT 50`;return;}
    const dateField=soqlBuilderFields.find(f=>f.type==='date'||f.type==='datetime')?.name||'CreatedDate';
    const condition=`${dateField} = ${filter}`;
    const ep=new RegExp(`\\b${dateField}\\s*=\\s*(?:TODAY|YESTERDAY|LAST_WEEK|THIS_WEEK|THIS_MONTH|LAST_MONTH|LAST_QUARTER|THIS_QUARTER|LAST_N_DAYS:\\d+|NEXT_N_DAYS:\\d+|LAST_N_WEEKS:\\d+|LAST_N_MONTHS:\\d+)`,'i');
    if(ep.test(q)){ta.value=q.replace(ep,condition);return;}
    if(/WHERE\s+/i.test(q)){if(/\bLIMIT\b/i.test(q))ta.value=q.replace(/\bLIMIT\b/i,`AND ${condition} LIMIT`);else if(/\bORDER\s+BY\b/i.test(q))ta.value=q.replace(/\bORDER\s+BY\b/i,`AND ${condition} ORDER BY`);else ta.value=q+` AND ${condition}`;}
    else if(/\bLIMIT\b/i.test(q))ta.value=q.replace(/\bLIMIT\b/i,`WHERE ${condition} LIMIT`);
    else if(/\bORDER\s+BY\b/i.test(q))ta.value=q.replace(/\bORDER\s+BY\b/i,`WHERE ${condition} ORDER BY`);
    else ta.value=q+` WHERE ${condition}`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  BUILD UI
  // ══════════════════════════════════════════════════════════════════════════
  function buildUI() {
    const fab = document.createElement('button');
    fab.id = 'spa-fab'; fab.title = 'Smart Assistant';
    fab.innerHTML = '✦<span id="spa-fab-badge"></span>';
    fab.addEventListener('click', togglePanel);
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'spa-panel';
    panel.className = 'kp-hidden spa-theme-dark';
    panel.innerHTML = `
<div class="kph">
  <div class="kph-dot"></div>
  <div class="kph-title">Smart Assistant <span class="v-badge">v9</span></div>
  <div class="kph-actions">
    <label class="sf-toggle-wrap" title="Toggle Salesforce connection">
      <span class="sf-toggle-lbl">SF</span>
      <input type="checkbox" id="kp-sf-toggle">
      <span class="sf-track"></span>
    </label>
    <button class="kph-btn" id="kp-clear-btn" title="Clear chat">⌫</button>
    <button class="kph-btn" id="kp-close-btn" title="Close">✕</button>
  </div>
</div>
<div class="kp-tabs">
  <div class="kp-tab active" data-tab="chat">💬 Chat</div>
  <div class="kp-tab" data-tab="monday">📋 Monday</div>
  <div class="kp-tab" data-tab="soql">📊 SOQL</div>
  <div class="kp-tab" data-tab="git">🐙 Git</div>
  <div class="kp-tab" data-tab="settings">⚙️</div>
</div>

<div class="kp-content active" id="kp-tab-chat">
  <div class="spa-greeting">
    <div class="spa-avatar-ring"><div class="spa-avatar-dot"></div></div>
    <div class="spa-greeting-text">
      <div class="spa-greeting-title">Hi ${USER_NAME}, I am your Assistant.</div>
      <div class="spa-greeting-sub">What can I do for you today?</div>
    </div>
  </div>
  <div class="kp-msgs" id="kp-msgs"></div>
  <div class="kp-quick-actions" id="kp-quick-actions">
    <div class="kpa-label">Quick Actions</div>
    <button class="kp-qa-btn" data-prompt="what are my tasks today">
      <span class="kpa-icon">✅</span><span class="kpa-text">My tasks today</span><span class="kpa-arrow">›</span>
    </button>
    <button class="kp-qa-btn" data-prompt="what are my bugs pending">
      <span class="kpa-icon">🐛</span><span class="kpa-text">Pending bugs</span><span class="kpa-arrow">›</span>
    </button>
    <button class="kp-qa-btn" data-prompt="create task ">
      <span class="kpa-icon" style="font-size:18px;font-weight:200;line-height:1">+</span><span class="kpa-text">Create task</span><span class="kpa-arrow">›</span>
    </button>
  </div>
  <div class="kp-thinking" id="kp-thinking"><div class="kp-spinner"></div><span id="kp-thinking-label">Thinking…</span></div>
  <div class="kp-irow">
    <textarea class="kp-inp" id="kp-input" placeholder="Ask anything…" rows="1"></textarea>
    <button class="kp-mic-btn" id="kp-mic-btn" title="Voice input">🎤</button>
    <button class="kp-send" id="kp-send">➤</button>
  </div>
</div>

<div class="kp-content" id="kp-tab-monday">
  <div class="mn-area">
    <div class="mn-inner-tabs">
      <div class="mn-inner-tab tasks-tab active" id="mn-inner-tasks" data-inner="tasks">📋 KMTSL Tasks</div>
      <div class="mn-inner-tab bugs-tab" id="mn-inner-bugs" data-inner="bugs">🐛 KMTSL Bugs Queue</div>
    </div>
    <div class="mn-toolbar">
      <span class="mn-me-badge">🙋 ${USER_NAME} only</span>
      <span class="mn-config-label" id="mn-group-label" style="display:none;font-size:9px;color:var(--text-muted);white-space:nowrap">Group:</span>
      <select class="git-select" id="mn-group-sel-filter" style="max-width:130px;display:none"><option value="">All groups</option></select>
      <button class="kp-btn primary" id="mn-refresh" style="padding:2px 7px;margin-left:auto">↻ Refresh</button>
      <button class="kp-btn" id="mn-cols-btn" style="padding:2px 7px">⚙️ Cols</button>
      <button class="kp-btn success" id="mn-add-btn" style="padding:2px 7px">+ Task</button>
    </div>
    <div class="mn-col-panel" id="mn-col-panel">
      <div class="mn-col-panel-title">⚙️ Column Configuration</div>
      <div id="mn-col-config-body"><div style="padding:10px;font-size:10px;color:var(--text-muted)">Load a board first</div></div>
    </div>
    <div class="mn-filter-row">
      <div class="mn-date-chips">
        <button class="mn-date-chip" data-date="today">Today</button>
        <button class="mn-date-chip" data-date="yesterday">Yesterday</button>
        <button class="mn-date-chip" data-date="thisweek">This Week</button>
        <button class="mn-date-chip" data-date="lastweek">Last Week</button>
        <button class="mn-date-chip active" data-date="all">All</button>
      </div>
      <div id="mn-owner-filter" style="display:flex;align-items:center;gap:4px;margin-left:auto"></div>
    </div>
    <div class="mn-stats" id="mn-stats" style="display:none">
      <div class="mn-stat"><span id="mn-s-total">0</span><span>Total</span></div>
      <div class="mn-stat mn-stat-blue"><span id="mn-s-prog">0</span><span>In Progress</span></div>
      <div class="mn-stat mn-stat-red"><span id="mn-s-stuck">0</span><span>Stuck</span></div>
      <div class="mn-stat mn-stat-green"><span id="mn-s-done">0</span><span>Done</span></div>
    </div>
    <div class="mn-body" id="mn-body"><div class="mn-empty">Loading Monday boards…</div></div>
    <div class="mn-add-form" id="mn-add-form" style="display:none">
      <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase">+ New Task</div>
      <input class="kp-sinput" id="mn-task-name" placeholder="Task name…">
      <select class="git-select" id="mn-group-sel" style="width:100%"><option value="">Default group</option></select>
      <div style="display:flex;gap:6px"><button class="kp-btn success" id="mn-do-add">✓ Create</button><button class="kp-btn" id="mn-cancel-add">Cancel</button></div>
      <div class="kp-result" id="mn-add-result" style="display:none"></div>
    </div>
  </div>
</div>

<div class="kp-content" id="kp-tab-soql">
  <div class="kp-exec">
    <div class="soql-toolbar">
      <select class="soql-select" id="soql-obj-select" style="flex:1;max-width:180px"><option value="">Object…</option></select>
      <select class="soql-select" id="soql-field-select" style="flex:1;display:none"><option value="">+ Field…</option></select>
      <div class="kp-tbr" style="margin-left:auto;gap:4px">
        <button class="kp-btn primary" id="soql-run" style="padding:3px 9px">▶ Run</button>
        <button class="kp-btn ask-ai-btn" id="soql-ai" style="padding:3px 9px">✦ AI</button>
        <button class="kp-btn" id="soql-clear" style="padding:3px 7px">✕</button>
      </div>
    </div>
    <textarea class="kp-code" id="soql-input" placeholder="SELECT Id, Name FROM Contract LIMIT 5"></textarea>
    <div class="soql-date-row">
      <span class="soql-date-label">📅 Insert:</span>
      <button class="soql-date-chip" data-filter="TODAY">Today</button>
      <button class="soql-date-chip" data-filter="YESTERDAY">Yesterday</button>
      <button class="soql-date-chip" data-filter="THIS_WEEK">This Week</button>
      <button class="soql-date-chip" data-filter="LAST_WEEK">Last Week</button>
      <button class="soql-date-chip" data-filter="LAST_N_DAYS:7">Last 7d</button>
      <button class="soql-date-chip" data-filter="THIS_MONTH">This Month</button>
    </div>
    <div id="soql-result-area"></div>
  </div>
</div>

<div class="kp-content" id="kp-tab-git">
  <div class="git-layout">

    <!-- GitHub user card -->
    <div id="git-user-section"><div class="git-empty">Add GitHub token in ⚙️ Setup.</div></div>

    <!-- ── Inner section tabs ─────────────────────────────────────── -->
    <div class="git-section-toggle">
      <button class="git-section-btn active" data-sec="meta" id="git-sec-meta-btn">📦 Metadata</button>
      <button class="git-section-btn" data-sec="push" id="git-sec-push-btn">🚀 Git Push</button>
    </div>

    <!-- ══════════════ METADATA SECTION ══════════════ -->
    <div id="git-section-meta">
      <div class="git-meta-header-row">
        <button class="kp-btn primary" id="git-describe-btn" style="font-size:9.5px">🔍 Load All Types</button>
        <button class="kp-btn" id="git-select-all-meta-btn" style="font-size:9.5px">⬇ Select All</button>
        <span id="git-meta-summary" style="font-size:9px;color:var(--accent);font-weight:700;margin-left:auto"></span>
      </div>

      <div class="git-panels-body">
        <!-- LHS: Types -->
        <div class="git-panel git-panel-lhs">
          <div class="git-panel-header">
            <span class="git-panel-header-title">Types</span>
            <input class="git-panel-search" id="git-type-search" placeholder="Filter types…">
          </div>
          <div class="git-panel-selall-row">
            <label><input type="checkbox" id="git-selall-types"><span style="margin-left:4px">All</span></label>
            <span id="git-lhs-count" style="font-size:9px;color:var(--text-muted)"></span>
          </div>
          <div class="git-panel-scroll" id="git-type-list">
            <div style="padding:16px;text-align:center;font-size:9.5px;color:var(--text-muted)">Click 🔍 Load All Types</div>
          </div>
        </div>
        <!-- RHS: Members -->
        <div class="git-panel git-panel-rhs">
          <div class="git-panel-header">
            <span class="git-panel-header-title" id="git-rhs-type-label" style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Members</span>
            <input class="git-panel-search" id="git-member-search" placeholder="Filter members…">
          </div>
          <div class="git-panel-selall-row">
            <label><input type="checkbox" id="git-selall-members"><span style="margin-left:4px">All</span></label>
            <span id="git-rhs-count" style="font-size:9px;color:var(--text-muted)"></span>
          </div>
          <div class="git-panel-scroll" id="git-member-list">
            <div style="padding:16px;text-align:center;font-size:9.5px;color:var(--text-muted)">← Select a type</div>
          </div>
        </div>
      </div>

      <!-- Load progress -->
      <div id="git-load-progress" style="display:none;padding:3px 10px 5px;border-top:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span id="git-load-label" style="font-size:9.5px;color:var(--text-muted)">Loading…</span>
          <span id="git-load-count" style="font-size:9px;font-weight:700;color:var(--accent)">0 / 0</span>
        </div>
        <div class="spa-progress-bar"><div class="spa-progress-fill" id="git-load-bar" style="width:0%"></div></div>
      </div>

      <!-- Selection summary -->
      <div class="git-selection-summary">
        <span id="git-selection-count" style="font-size:9.5px;color:var(--text-muted)">Nothing selected — load types to begin</span>
        <button class="kp-btn" id="git-clear-sel-btn" style="font-size:8.5px;padding:2px 7px;display:none">✕ Clear</button>
      </div>

      <!-- Download / Export bar -->
      <div class="git-download-bar">
        <span style="font-size:9px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;white-space:nowrap">Export</span>
        <input class="git-panel-search" id="git-export-name-input" placeholder="folder/zip name…" style="flex:1;min-width:60px;max-width:130px" title="Custom folder/ZIP name (leave blank to use org name + date)">
        <button class="kp-btn" id="git-download-zip-btn" title="Download selected files as ZIP">💾 ZIP</button>
        <button class="kp-btn" id="git-save-folder-btn" title="Save to local folder (Chrome 86+)">📁 Folder</button>
      </div>

      <!-- Download/export progress -->
      <div id="git-export-progress" style="display:none;padding:3px 10px 6px;border-top:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span id="git-export-label" style="font-size:9.5px;color:var(--text-muted)">Fetching files…</span>
          <span id="git-export-count" style="font-size:9px;font-weight:700;color:var(--accent)">0 / 0</span>
        </div>
        <div class="spa-progress-bar"><div class="spa-progress-fill" id="git-export-bar" style="width:0%"></div></div>
        <div id="git-export-file" style="font-size:9px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
      </div>
    </div>

    <!-- ══════════════ GIT PUSH SECTION ══════════════ -->
    <div id="git-section-push" style="display:none;flex-direction:column;flex:1;overflow:hidden">
      <!-- inner tabs: SF Metadata | Local Folder -->
      <div class="git-push-source-toggle">
        <button class="git-push-src-btn active" data-src="sf" id="git-pushsrc-sf-btn">🌩 SF Metadata</button>
        <button class="git-push-src-btn" data-src="local" id="git-pushsrc-local-btn">📁 Local Folder</button>
      </div>

      <!-- SF Metadata push (existing) -->
      <div id="git-pushsrc-sf">
        <div class="git-push-section">
          <div class="git-push-row">
            <span class="git-meta-label" style="white-space:nowrap">Repo</span>
            <select class="git-select" id="git-repo-select" style="flex:1"><option value="">Select repo…</option></select>
          </div>
          <div class="git-push-row">
            <span class="git-meta-label" style="white-space:nowrap">Branch</span>
            <select class="git-select" id="git-branch-select" style="flex:1"><option value="">Branch…</option></select>
            <span style="font-size:9.5px;color:var(--text-muted)">or</span>
            <input class="kp-sinput" id="git-new-branch-name" placeholder="new-branch" style="flex:1;padding:4px 7px;font-size:10.5px">
          </div>
          <div class="git-push-row">
            <span class="git-meta-label" style="white-space:nowrap">Commit</span>
            <input class="kp-sinput" id="git-commit-msg" placeholder="auto-filled on push…" style="flex:1;padding:4px 7px;font-size:10.5px">
          </div>
          <div style="display:flex;gap:6px;margin-top:2px;flex-wrap:wrap">
            <button class="kp-btn primary" id="git-do-push" style="flex:1;min-width:120px">↑ Push selected</button>
            <button class="kp-btn" id="git-pr-btn">⤴ PR</button>
            <button class="kp-btn" id="git-view-branch-btn" style="display:none">🌐 View</button>
          </div>
          <div id="git-push-progress" style="display:none;padding:6px 0 2px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
              <span id="git-push-progress-label" style="font-size:9.5px;color:var(--text-muted)">Pushing…</span>
              <span id="git-push-progress-count" style="font-size:9px;font-weight:700;color:var(--accent)">0 / 0</span>
            </div>
            <div class="spa-progress-bar"><div class="spa-progress-fill" id="git-push-bar" style="width:0%"></div></div>
            <div id="git-push-current-file" style="font-size:9px;color:var(--text-muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
          </div>
          <div class="git-push-result" id="git-push-result" style="display:none"></div>
          <div id="git-push-links" style="display:none;flex-direction:column;gap:4px;padding:6px 0 2px"></div>
        </div>
      </div>

      <!-- Local Folder push (new) -->
      <div id="git-pushsrc-local" style="display:none">
        <div class="git-push-section">
          <!-- Step 1: pick folder -->
          <div class="git-local-step">
            <span class="git-local-step-num">1</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:9.5px;font-weight:600;color:var(--text-main);margin-bottom:3px">Pick local VS Code / git folder</div>
              <div style="font-size:9px;color:var(--text-muted);margin-bottom:5px">Select the root of your SFDX project (the folder containing <code>force-app/</code>)</div>
              <div style="display:flex;gap:5px;align-items:center">
                <button class="kp-btn primary" id="git-pick-local-btn">📂 Pick Folder</button>
                <span id="git-local-folder-name" style="font-size:9px;color:var(--accent);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1"></span>
              </div>
            </div>
          </div>

          <!-- Step 2: file tree (shown after folder picked) -->
          <div id="git-local-tree-section" style="display:none">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--bg-panel)">
              <label style="display:flex;align-items:center;gap:5px;font-size:9.5px;color:var(--text-muted);cursor:pointer">
                <input type="checkbox" id="git-local-selall" style="accent-color:var(--accent)"> Select all
              </label>
              <span id="git-local-sel-count" style="font-size:9px;font-weight:700;color:var(--accent)">0 selected</span>
              <input class="git-panel-search" id="git-local-search" placeholder="Filter files…" style="max-width:100px">
            </div>
            <div id="git-local-file-list" style="max-height:160px;overflow-y:auto;border-bottom:1px solid var(--border)"></div>
          </div>

          <!-- Step 3: push config (shown after folder picked) -->
          <div id="git-local-push-config" style="display:none">
            <div class="git-local-step">
              <span class="git-local-step-num">2</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:9.5px;font-weight:600;color:var(--text-main);margin-bottom:4px">Push to GitHub</div>
                <div class="git-push-row">
                  <span class="git-meta-label" style="white-space:nowrap">Repo</span>
                  <select class="git-select" id="git-local-repo-select" style="flex:1"><option value="">Select repo…</option></select>
                </div>
                <div class="git-push-row" style="margin-top:4px">
                  <span class="git-meta-label" style="white-space:nowrap">Branch</span>
                  <select class="git-select" id="git-local-branch-select" style="flex:1"><option value="">Branch…</option></select>
                  <span style="font-size:9.5px;color:var(--text-muted)">or</span>
                  <input class="kp-sinput" id="git-local-new-branch" placeholder="new-branch" style="flex:1;padding:4px 7px;font-size:10.5px">
                </div>
                <div class="git-push-row" style="margin-top:4px">
                  <span class="git-meta-label" style="white-space:nowrap">Commit</span>
                  <input class="kp-sinput" id="git-local-commit-msg" placeholder="auto-filled on push…" style="flex:1;padding:4px 7px;font-size:10.5px">
                </div>
                <button class="kp-btn primary" id="git-local-do-push" style="width:100%;margin-top:6px">↑ Push from Local Folder</button>
              </div>
            </div>

            <!-- Local push progress -->
            <div id="git-local-push-progress" style="display:none;padding:4px 10px 5px;border-top:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                <span id="git-local-push-label" style="font-size:9.5px;color:var(--text-muted)">Pushing…</span>
                <span id="git-local-push-count" style="font-size:9px;font-weight:700;color:var(--accent)">0 / 0</span>
              </div>
              <div class="spa-progress-bar"><div class="spa-progress-fill" id="git-local-push-bar" style="width:0%"></div></div>
              <div id="git-local-push-file" style="font-size:9px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
            </div>
            <div id="git-local-push-result" class="git-push-result" style="display:none"></div>
            <div id="git-local-push-links" style="display:none;flex-direction:column;gap:4px;padding:6px 0 2px"></div>
          </div>
        </div>
      </div>

      <div id="git-pr-form" style="display:none;flex-direction:column;gap:5px;padding:8px 10px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-card)">
        <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Create Pull Request</div>
        <input class="kp-sinput" id="git-pr-title" placeholder="PR title" style="font-size:11px">
        <input class="kp-sinput" id="git-pr-base" placeholder="Base branch (e.g. main)" style="font-size:11px">
        <textarea class="kp-code" id="git-pr-body" placeholder="Description…" style="height:40px;font-size:10.5px"></textarea>
        <div style="display:flex;gap:6px">
          <button class="kp-btn primary" id="git-do-pr">Create PR</button>
          <button class="kp-btn" id="git-cancel-pr">Cancel</button>
        </div>
      </div>

      <div class="git-commits-section" id="git-commits-section">
        <div class="git-empty">Select repo + branch to see commits.</div>
      </div>
    </div>

  </div>
</div>

<div class="kp-content" id="kp-tab-settings">
  <div class="kp-inner-tab-bar">
    <button class="kp-inner-tab active" data-inner="config">⚙️ Config</button>
    <button class="kp-inner-tab" data-inner="logs">📋 Logs</button>
  </div>
  <div class="kp-inner-content active" id="kp-inner-config">
    <div class="kp-settings">
      <div class="spa-theme-row">
        <div><div class="spa-theme-row-label">🎨 Appearance</div><div class="spa-theme-row-sub">Switch between dark and light mode</div></div>
        <label class="spa-theme-toggle-wrap">
          <span class="spa-theme-pill" id="kp-theme-label">DARK</span>
          <input type="checkbox" id="kp-theme-toggle">
          <span class="spa-theme-track"></span>
        </label>
      </div>
      <hr class="kp-settings-divider">
      <div class="kp-section-header">👤 Profile</div>
      <div>
        <label class="kp-slabel">Your Name</label>
        <input class="kp-sinput" type="text" id="kp-user-name" placeholder="e.g. Manish">
        <div style="font-size:9px;color:var(--text-muted);margin-top:3px">Used in greetings, task filters, and AI prompts</div>
      </div>
      <hr class="kp-settings-divider">
      <div class="kp-section-header">📋 Monday Boards</div>
      <div>
        <label class="kp-slabel">Tasks Board ID</label>
        <input class="kp-sinput" type="text" id="kp-tasks-board-id" placeholder="e.g. 2061593140 (blank = auto-detect)">
        <div style="font-size:9px;color:var(--text-muted);margin-top:3px">Copy from your Monday tasks board URL → /boards/<b>ID</b>/</div>
      </div>
      <div>
        <label class="kp-slabel">Bugs Board ID</label>
        <input class="kp-sinput" type="text" id="kp-bugs-board-id" placeholder="e.g. 2061593141 (blank = auto-detect)">
        <div style="font-size:9px;color:var(--text-muted);margin-top:3px">Copy from your Monday bugs board URL → /boards/<b>ID</b>/</div>
      </div>
      <hr class="kp-settings-divider">
      <div class="kp-section-header">🟢 Groq AI</div>
      <div>
        <label class="kp-slabel">API Key</label>
        <input class="kp-sinput" type="password" id="kp-groq-key" placeholder="gsk_…">
        <div style="font-size:9px;color:var(--text-muted);margin-top:3px">Free at console.groq.com — Llama 3.3 70B</div>
      </div>
      <hr class="kp-settings-divider">
      <div class="spa-owner-box">
        <label class="kp-slabel">👤 Monday Owner Key (User ID)</label>
        <input class="kp-sinput" type="text" id="kp-owner-id" placeholder="e.g. 84681170">
        <div style="font-size:9px;color:var(--text-muted);margin-top:3px">Your Monday.com numeric user ID — filters tasks and bugs to you only</div>
      </div>
      <hr class="kp-settings-divider">
      <div class="kp-section-header">🔗 Integrations</div>
      <div>
        <label class="kp-slabel">Monday.com API Token</label>
        <input class="kp-sinput" type="password" id="kp-monday-token" placeholder="eyJhbGciOi…">
        <div style="font-size:9px;color:var(--text-muted);margin-top:3px">Monday → Avatar → Developers → My Access Tokens</div>
      </div>
      <div>
        <label class="kp-slabel">GitHub Personal Access Token</label>
        <input class="kp-sinput" type="password" id="kp-gh-token" placeholder="ghp_… or github_pat_…">
      </div>
      <div>
        <label class="kp-slabel">Default GitHub Repo (owner/repo)</label>
        <input class="kp-sinput" type="text" id="kp-gh-repo" placeholder="owner/repo-name">
      </div>
      <div style="display:flex;gap:6px">
        <button class="kp-btn primary" id="kp-save-btn">💾 Save All</button>
        <button class="kp-btn" id="kp-test-btn">🔌 Test</button>
      </div>
      <div id="kp-conn-status" style="display:none"></div>
      <hr class="kp-settings-divider">
      <div class="kp-section-header">🔒 Security</div>
      <div>
        <label class="kp-slabel">Config PIN <span style="font-size:9px;color:var(--text-muted)">(locks this Settings tab)</span></label>
        <input class="kp-sinput" type="password" id="kp-config-pin" placeholder="Set a new PIN…" autocomplete="new-password">
        <input class="kp-sinput" type="password" id="kp-config-pin-confirm" placeholder="Confirm PIN…" autocomplete="new-password" style="margin-top:4px">
        <div style="font-size:9px;color:var(--text-muted);margin-top:3px">Leave both blank to keep unchanged. <span id="kp-pin-status"></span></div>
        <button class="kp-btn" id="kp-remove-pin-btn" style="margin-top:6px;display:none">🔓 Remove PIN</button>
      </div>
      <div>
        <div class="kp-slabel">Session Debug</div>
        <div class="kp-result" id="kp-sess-debug" style="min-height:40px;font-size:9px;max-height:80px"></div>
      </div>
    </div>
  </div>
  <div class="kp-inner-content" id="kp-inner-logs">
    <div class="kp-logbar">
      <span class="kp-badge kp-badge-blue" id="kp-log-count">0</span>
      <span style="color:var(--text-muted);font-size:10px">System logs</span>
      <button class="kp-btn" style="margin-left:auto" id="logs-copy-all-btn">📋 Copy All</button>
      <button class="kp-btn" id="logs-clear-btn">Clear</button>
      <button class="kp-btn primary" id="logs-ai-btn">✦ Analyse</button>
    </div>
    <div class="kp-loglist" id="kp-log-list"><div class="mn-empty">Logs appear here.</div></div>
  </div>
</div>`;
    document.body.appendChild(panel);
  }

  // ── Git state + helpers ───────────────────────────────────────────────────
  let ghUser=null, selectedRepo=null, selectedBranch='main', selectedMetaFiles=[];
  // Two-panel metadata state (SOAP-driven)
  let metaAllTypes=[];          // [{xmlName,directoryName,suffix,inFolder}] from describeMetadata
  let metaMembersByType={};     // {TypeName: [{fullName,fileName,type,id}]}
  let metaSelectedByType={};    // {TypeName: Set<fullName>}
  let metaActiveType=null;      // type currently shown in RHS
  let loadedMetaByType={};      // legacy compat (Tooling API path)


  // ── Export helper functions ───────────────────────────────────────────────
  function buildExportFolderName(customName){
    if(customName&&customName.trim())return customName.trim().replace(/[^a-zA-Z0-9_-]/g,'_');
    const h=window.__sfSession?.sfHost||window.location.hostname;
    const orgSlug=h.replace(/\.(lightning|my|sandbox)\..*$/,'').replace(/[^a-zA-Z0-9_-]/g,'-').substring(0,32);
    return`${orgSlug}_${new Date().toISOString().slice(0,10)}`;
  }

  async function collectExportFiles(filesToExport,onProgress){
    const collected=[];
    for(let i=0;i<filesToExport.length;i++){
      const file=filesToExport[i];
      if(onProgress)onProgress(i,filesToExport.length,file.fullName);
      if(i>0&&i%10===0)await yieldToBrowser();
      try{
        const body=await fetchFileBody(file.type,file.id,file.fullName);
        if(!body.startsWith('// Body fetch not implemented')){
          const rawPath=buildFilePath(file);
          // Strip force-app/main/default/ prefix → relative path for ZIP/folder
          const rel=rawPath.replace(/^force-app\/main\/default\//,'');
          collected.push({path:rel,body,fullName:file.fullName,type:file.type});
        }
      }catch(e){log('warn',`Export skip: ${file.fullName} — ${e}`,'Git');}
    }
    if(onProgress)onProgress(filesToExport.length,filesToExport.length,'');
    return collected;
  }

  async function downloadAsZIP(files,folderName){
    const JSZip=await loadJSZip();
    const zip=new JSZip();
    const root=zip.folder(folderName).folder('force-app').folder('main').folder('default');
    for(const f of files){
      const parts=f.path.split('/');const fn=parts.pop();
      let dir=root;for(const p of parts)dir=dir.folder(p);
      dir.file(fn,f.body);
    }
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`${folderName}.zip`;
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},2000);
    return files.length;
  }

  async function saveToLocalFolder(files,folderName){
    if(!('showDirectoryPicker'in window))throw'File System Access API not available — use ZIP instead.';
    const rootHandle=await window.showDirectoryPicker({mode:'readwrite',startIn:'documents'});
    const orgDir=await rootHandle.getDirectoryHandle(folderName,{create:true});
    const defDir=await(await(await(await orgDir
      .getDirectoryHandle('force-app',{create:true}))
      .getDirectoryHandle('main',{create:true}))
      .getDirectoryHandle('default',{create:true}));
    let written=0;
    for(const f of files){
      const parts=f.path.split('/');const fn=parts.pop();
      let dir=defDir;
      for(const seg of parts)dir=await dir.getDirectoryHandle(seg,{create:true});
      const fh=await dir.getFileHandle(fn,{create:true});
      const w=await fh.createWritable();await w.write(f.body);await w.close();
      written++;
      if(written%10===0)await yieldToBrowser();
    }
    return written;
  }

  async function loadGitUser(){
    try{
      // Fine-grained PATs may return partial /user info (no avatar/public_repos if Profile permission not granted)
      let userInfo={login:'',name:'',avatar_url:'',public_repos:null};
      try{ghUser=await ghGetUser();userInfo=ghUser;}catch(e){log('warn','GitHub /user limited (fine-grained PAT?): '+e,'GitHub');}
      const sec=document.getElementById('git-user-section');
      const repos=await ghListRepos(); // works for both classic + fine-grained PATs
      // Derive login from repo owner if /user failed
      if(!userInfo.login&&repos.length)userInfo.login=repos[0].owner?.login||'';
      if(sec){
        const repoCount=repos.length?` · ${repos.length} repo${repos.length!==1?'s':''}`:' · fine-grained PAT';
        const avatarHtml=userInfo.avatar_url?`<img class="git-avatar" src="${userInfo.avatar_url}">`:`<div class="git-avatar" style="background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff">⚙</div>`;
        sec.innerHTML=`<div class="git-user-card">${avatarHtml}<div><div class="git-user-name">${escH(userInfo.name||userInfo.login||'GitHub User')}</div><div class="git-user-login">${userInfo.login?'@'+escH(userInfo.login):'Fine-grained PAT'}${repoCount}</div></div><span style="margin-left:auto;font-size:9.5px;background:rgba(16,185,129,0.15);color:var(--success);border-radius:10px;padding:1px 8px;font-weight:600">✓ Connected</span></div>`;
      }
      const sel=document.getElementById('git-repo-select');
      if(sel){
        sel.innerHTML='<option value="">Select repo…</option>'+repos.map(r=>`<option value="${r.full_name}">${r.name}</option>`).join('');
        const def=storageGet('ghRepo','');
        if(def)sel.value=def;
        // stored repo not found (e.g. switched to fine-grained PAT with different scope) → auto-select first
        if(!sel.value&&repos.length){
          sel.value=repos[0].full_name;
          storageSet('ghRepo',repos[0].full_name);
          log('info','ghRepo auto-updated to: '+repos[0].full_name,'GitHub');
        }
        if(sel.value)await onRepoChange(sel.value);
      }
    }catch(e){log('error','GitHub: '+e,'GitHub');const s=document.getElementById('git-user-section');if(s)s.innerHTML=`<div class="git-empty" style="color:var(--danger)">GitHub failed: ${escH(String(e))}</div>`;}
  }
  async function onRepoChange(fn){if(!fn)return;selectedRepo=fn;const[o,r]=fn.split('/');try{const branches=await ghGetBranches(o,r);const sel=document.getElementById('git-branch-select');if(sel){sel.innerHTML=branches.map(b=>`<option value="${b.name}">${b.name}</option>`).join('');selectedBranch=sel.value;}await loadCommits();}catch(e){log('error','Branches: '+e,'GitHub');}}
  async function loadCommits(){if(!selectedRepo)return;const[o,r]=selectedRepo.split('/');const section=document.getElementById('git-commits-section');if(section)section.innerHTML='<div class="git-loading">Loading commits…</div>';try{const commits=await ghGetCommits(o,r,selectedBranch);if(section)section.innerHTML=commits.length?`<div style="padding:5px 10px;font-size:9.5px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border)">Recent commits · ${selectedBranch}</div>`+commits.map(c=>`<div class="git-commit-item"><div class="git-commit-msg">${escH(c.commit.message.split('\n')[0].substring(0,80))}</div><div class="git-commit-meta">${c.sha.substring(0,7)} · ${c.commit.author.name} · ${new Date(c.commit.author.date).toLocaleDateString()}</div></div>`).join(''):'<div class="git-empty">No commits found.</div>';}catch(e){log('error','Commits: '+e,'GitHub');}}

  function updateSelectionBadge(){const badge=document.getElementById('meta-sel-count');if(badge)badge.textContent=selectedMetaFiles.length+' selected';}
  async function renderMetaFiles(files){
    const container=document.getElementById('meta-file-items');if(!container)return;
    if(!files.length){container.innerHTML='<div class="git-empty">No files found.</div>';return;}
    container.innerHTML=files.map(f=>`<div class="git-file-item" data-id="${escH(f.id)}" data-name="${escH(f.name)}" data-ext="${escH(f.ext)}" data-type="${escH(f.type)}"><input type="checkbox" class="meta-file-cb" data-id="${escH(f.id)}"><span class="git-file-name">${escH(f.name)}</span><span class="git-file-ext">${escH(f.ext)}</span></div>`).join('');
    container.querySelectorAll('.meta-file-cb').forEach(cb=>{cb.addEventListener('change',()=>{const row=cb.closest('.git-file-item');const file={id:row.dataset.id,name:row.dataset.name,ext:row.dataset.ext,type:row.dataset.type};if(cb.checked){if(!selectedMetaFiles.find(f=>f.id===file.id))selectedMetaFiles.push(file);}else selectedMetaFiles=selectedMetaFiles.filter(f=>f.id!==file.id);updateSelectionBadge();const allCbs=container.querySelectorAll('.meta-file-cb');const sa=document.getElementById('meta-select-all');if(sa)sa.checked=Array.from(allCbs).every(c=>c.checked);});});
  }
  function buildFilePath(file){
    // SOAP members have a fileName (e.g. "classes/MyClass.cls") — use it directly
    if(file.fileName)return'force-app/main/default/'+file.fileName;
    const cfg=META_TYPES[file.type];
    const dir=cfg?.dir||(file.type.toLowerCase()+'s');
    const ext=cfg?.ext||'.meta.json';
    return`force-app/main/default/${dir}/${file.fullName||file.name}${ext}`;
  }
  function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  // ══════════════════════════════════════════════════════════════════════════
  //  WIRE EVENTS
  // ══════════════════════════════════════════════════════════════════════════
  let thinking=false;

  function wireEvents(){
    const p=id=>document.getElementById(id);

    // ── Message helpers ──────────────────────────────────────────────────
    function renderMarkdownLight(text){return text.replace(/```[\w]*\n?([\s\S]*?)```/g,(_,c)=>`<pre>${escH(c.trim())}</pre>`).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');}

    function addMsg(text,type){
      const msgs=p('kp-msgs');if(!msgs)return null;
      const div=document.createElement('div');
      div.className='km km-'+type;
      if(type==='ai'&&text.startsWith('__HAS_TABLE__')&&text.endsWith('__HAS_TABLE__')){
        const payload=JSON.parse(text.slice(13,-13));
        div.innerHTML=renderMarkdownLight(payload.text);
        if(payload.html){const tw=document.createElement('div');tw.className='sf-result-wrap';tw.innerHTML=payload.html;div.appendChild(tw);}
      }else{div.innerHTML=renderMarkdownLight(text);}
      const qa=p('kp-quick-actions');if(qa&&msgs.children.length===0)qa.style.display='none';
      msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
      return div;
    }

    function addMondayListMsg(title,items){
      const msgs=p('kp-msgs');if(!msgs)return;
      const qa=p('kp-quick-actions');if(qa)qa.style.display='none';
      const div=document.createElement('div');
      div.className='km km-monday-list';
      const copyText=`${title}\n`+items.map((item,i)=>`${i+1}. ${item.name}${item.status?' — '+item.status:''}${item.due?' (Due: '+item.due+')':''}`).join('\n');
      div.innerHTML=`<div class="km-monday-header"><span>${escH(title)}</span><span style="font-size:9.5px;color:var(--text-muted);font-weight:400">${items.length} item${items.length!==1?'s':''}</span></div><div class="km-monday-items">${items.length===0?'<div style="font-size:10.5px;color:var(--text-muted);padding:4px 0">🎉 No pending items found!</div>':items.map((item,i)=>{const col=mnStatusColor(item.status||'');const nameHtml=item.url?`<a href="${escH(item.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:none" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escH(item.name)}</a>`:escH(item.name);return`<div class="km-monday-item"><span class="km-monday-num">${i+1}.</span><span>${nameHtml}${item.status?`<span class="mn-pill" style="background:${col}18;color:${col};border:1px solid ${col}35;margin-left:4px">${escH(item.status)}</span>`:''} ${item.due?`<span class="mn-due" style="margin-left:4px">${escH(item.due)}</span>`:''}</span></div>`;}).join('')}</div><div class="km-monday-footer"><span style="font-size:9.5px;color:var(--text-muted)">From KMTSL board</span><button class="km-copy-btn" data-copy="${escH(copyText)}">📋 Copy</button></div>`;
      msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
      div.querySelector('.km-copy-btn').addEventListener('click',e=>{navigator.clipboard.writeText(e.target.dataset.copy).then(()=>{e.target.textContent='✓ Copied!';setTimeout(()=>(e.target.textContent='📋 Copy'),1500);});});
    }

    // ── SF Toggle ────────────────────────────────────────────────────────
    const sfToggle=p('kp-sf-toggle');
    if(sfToggle){
      sfConsentGiven=storageGet('sfEnabled',false);
      sfToggle.checked=sfConsentGiven;
      sfToggle.addEventListener('change',async e=>{
        sfConsentGiven=e.target.checked;storageSet('sfEnabled',sfConsentGiven);
        if(sfConsentGiven){
          const ctx=await detectSessionAsync();
          if(ctx.sessionId){addMsg(`✅ Salesforce connected: **${ctx.userName||ctx.sfHost}**`,'sys');loadSOQLObjects().catch(()=>{});}
          else{addMsg('⚠️ No Salesforce session found. Please refresh.','err');sfConsentGiven=false;sfToggle.checked=false;storageSet('sfEnabled',false);}
        }else{addMsg('Salesforce disconnected.','sys');}
      });
    }

    // ── Speech / Mic ─────────────────────────────────────────────────────
    const micBtn=p('kp-mic-btn');
    if(micBtn){
      micBtn.addEventListener('click',()=>{
        const speech=window.__SPA_SPEECH;
        if(!speech||!speech.supported){addMsg('🎤 Speech recognition not supported in this browser.','err');return;}
        if(speech.isListening){speech.stop();micBtn.classList.remove('recording');return;}
        micBtn.classList.add('recording');
        speech.start(
          (transcript,isFinal)=>{p('kp-input').value=transcript;if(isFinal)micBtn.classList.remove('recording');},
          ()=>{micBtn.classList.remove('recording');},
          err=>{micBtn.classList.remove('recording');log('error','Speech: '+err,'Speech');}
        );
      });
    }

    // ── Quick Actions ────────────────────────────────────────────────────
    document.querySelectorAll('.kp-qa-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const pr=btn.dataset.prompt;if(!pr)return;
        p('kp-input').value=pr;
        if(!pr.endsWith(' '))sendChat();
      });
    });

    // ── Send Chat ────────────────────────────────────────────────────────
    async function sendChat(){
      const inp=p('kp-input'),msg=inp.value.trim();
      if(!msg||thinking)return;
      inp.value='';inp.style.height='auto';
      addMsg(msg,'user');
      thinking=true;p('kp-thinking').classList.add('show');p('kp-send').disabled=true;
      updateThinkingLabel('Thinking…');
      try{const handled=await handleMondayQuestion(msg);if(!handled){const reply=await callAI(msg);addMsg(reply,'ai');}}
      catch(e){addMsg('Error: '+e,'err');}
      p('kp-thinking').classList.remove('show');p('kp-send').disabled=false;thinking=false;
      updateThinkingLabel('Thinking…');
    }

    p('kp-send').addEventListener('click',sendChat);
    p('kp-input').addEventListener('keydown',e=>{
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}
      setTimeout(()=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,90)+'px';},0);
    });

    // ── Main Tabs ────────────────────────────────────────────────────────
    document.querySelectorAll('.kp-tab').forEach(tab=>{
      tab.addEventListener('click',()=>{
        document.querySelectorAll('.kp-tab').forEach(t=>t.classList.remove('active'));
        document.querySelectorAll('.kp-content').forEach(c=>c.classList.remove('active'));
        tab.classList.add('active');p('kp-tab-'+tab.dataset.tab).classList.add('active');
        if(tab.dataset.tab==='monday'&&!mondayBoardMap.tasks&&!mondayBoardMap.bugs)loadMondayBoards();
        if(tab.dataset.tab==='git'){if(!ghUser)loadGitUser();}
        if(tab.dataset.tab==='settings'){
          loadSettingsValues();
          // Show lock screen if PIN is set and session not yet unlocked
          if(storageGet('configPinHash','')&&!configUnlocked){
            setTimeout(()=>showConfigLock(),30);
          }
        }
      });
    });

    // Reset lock when panel is closed (re-lock on next open)
    p('kp-close-btn').addEventListener('click',()=>{
      p('spa-panel').classList.add('kp-hidden');
      configUnlocked=false;
    });

    // ── Settings inner tabs ──────────────────────────────────────────────
    document.querySelectorAll('.kp-inner-tab').forEach(tab=>{
      tab.addEventListener('click',()=>{
        document.querySelectorAll('.kp-inner-tab').forEach(t=>t.classList.remove('active'));
        document.querySelectorAll('.kp-inner-content').forEach(c=>c.classList.remove('active'));
        tab.classList.add('active');const pane=p('kp-inner-'+tab.dataset.inner);if(pane)pane.classList.add('active');
      });
    });

    // ── Monday inner tabs ────────────────────────────────────────────────
    document.querySelectorAll('.mn-inner-tab').forEach(tab=>{tab.addEventListener('click',()=>switchMondayInnerTab(tab.dataset.inner));});

    // ── Header buttons ───────────────────────────────────────────────────
    p('kp-clear-btn').addEventListener('click',()=>{chatHistory=[];p('kp-msgs').innerHTML='';const qa=p('kp-quick-actions');if(qa)qa.style.display='';});

    // ── SOQL ────────────────────────────────────────────────────────────
    function renderSOQLResult(data){
      const area=p('soql-result-area');if(!area)return;
      if(!data){area.innerHTML='<div class="kp-result fail">No result</div>';return;}
      const records=data.records||[],total=data.totalSize||0;
      if(records.length===0&&total>0){area.innerHTML=`<div class="kp-result-table"><div class="sf-result-count"><span class="sf-count-number">${total}</span><span class="sf-count-label">records</span></div></div>`;return;}
      if(records.length===0){area.innerHTML='<div class="kp-result ok" style="white-space:normal;">No records returned.</div>';return;}
      area.innerHTML=`<div class="kp-result-table">${formatResultsAsTable(records,total)}</div>`;
    }

    p('soql-obj-select').addEventListener('change',async e=>{const obj=e.target.value;const fs=p('soql-field-select');if(!obj){if(fs)fs.style.display='none';return;}if(fs)fs.style.display='block';await onSOQLObjectChange(obj);});
    p('soql-field-select').addEventListener('change',e=>addFieldToSOQL(e.target.value));
    document.querySelectorAll('.soql-date-chip').forEach(chip=>{chip.addEventListener('click',()=>insertDateFilter(chip.dataset.filter));});
    p('soql-run').addEventListener('click',async()=>{const q=p('soql-input').value.trim(),area=p('soql-result-area');if(!q)return;area.innerHTML='<div class="kp-result">Running…</div>';try{const d=await sfREST('GET','/query/?q='+encodeURIComponent(q));renderSOQLResult(d);}catch(e){area.innerHTML=`<div class="kp-result fail">${escH(Array.isArray(e)?JSON.stringify(e,null,2):String(e))}</div>`;}});
    const askAiBtn=p('soql-ai');
    askAiBtn.addEventListener('click',async()=>{
      const q=p('soql-input').value.trim(),area=p('soql-result-area');if(!q){alert('Enter a question or partial SOQL.');return;}
      area.innerHTML='<div class="kp-result">AI generating query…</div>';askAiBtn.classList.add('loading');askAiBtn.textContent='⏳ Working…';
      let sc='';if(sfConsentGiven)sc=await buildSchemaContextForAI(q).catch(()=>'');
      const prompt=`Write a SOQL query for: ${q}${sc}\nReturn ONLY the query in a \`\`\`soql code block.`;
      try{const aiReply=await callAI(prompt,true);const soql=extractSOQL(aiReply);if(soql){p('soql-input').value=soql;area.innerHTML='<div class="kp-result">Executing…</div>';try{const d=await sfREST('GET','/query/?q='+encodeURIComponent(soql));renderSOQLResult(d);}catch(e){area.innerHTML=`<div class="kp-result fail">${escH(Array.isArray(e)?JSON.stringify(e,null,2):String(e))}</div>`;}}else{area.innerHTML=`<div class="kp-result fail">Could not extract SOQL.\n${escH(aiReply)}</div>`;}}
      catch(e){area.innerHTML=`<div class="kp-result fail">AI error: ${escH(String(e))}</div>`;}
      askAiBtn.classList.remove('loading');askAiBtn.textContent='✦ AI';
    });
    p('soql-clear').addEventListener('click',()=>{p('soql-input').value='';p('soql-result-area').innerHTML='';p('soql-field-select').style.display='none';});

    // ── Monday events ────────────────────────────────────────────────────
    p('mn-refresh').addEventListener('click',async()=>{if(!mondayBoardId)loadMondayBoards();else await loadMondayItems();});
    p('mn-cols-btn').addEventListener('click',()=>p('mn-col-panel').classList.toggle('show'));
    document.addEventListener('change',e=>{if(e.target.id==='mn-group-sel-filter'){storageSet('mondayGroupId_'+mondayBoardId,e.target.value);loadMondayItems();}});
    document.querySelectorAll('.mn-date-chip').forEach(chip=>{chip.addEventListener('click',()=>{document.querySelectorAll('.mn-date-chip').forEach(c=>c.classList.remove('active'));chip.classList.add('active');mondayDateFilter=chip.dataset.date;renderMondayItems();});});
    p('mn-add-btn').addEventListener('click',async()=>{const f=p('mn-add-form');f.style.display=f.style.display==='none'?'flex':'none';f.style.flexDirection='column';if(mondayBoardId){try{const groups=await mondayGetGroups(mondayBoardId);const sel=p('mn-group-sel');sel.innerHTML='<option value="">Default group</option>'+groups.map(g=>`<option value="${g.id}">${escH(g.title)}</option>`).join('');}catch(e){}}setTimeout(()=>p('mn-task-name').focus(),100);});
    p('mn-cancel-add').addEventListener('click',()=>(p('mn-add-form').style.display='none'));
    p('mn-do-add').addEventListener('click',async()=>{const name=p('mn-task-name').value.trim(),grp=p('mn-group-sel').value,res=p('mn-add-result');if(!name){alert('Enter a task name.');return;}if(!mondayBoardId){alert('Select a board first.');return;}res.style.display='block';res.className='kp-result';res.textContent='Creating…';try{const item=await mondayCreateItem(mondayBoardId,name,grp||undefined);res.className='kp-result ok';res.textContent='✅ Created: '+item.name;p('mn-task-name').value='';await loadMondayItems();setTimeout(()=>{p('mn-add-form').style.display='none';res.style.display='none';},1500);}catch(e){res.className='kp-result fail';res.textContent='Error: '+e;}});

    // ── Git events ───────────────────────────────────────────────────────
    p('git-repo-select').addEventListener('change',e=>{selectedRepo=e.target.value;onRepoChange(e.target.value);});
    p('git-branch-select').addEventListener('change',e=>{selectedBranch=e.target.value;loadCommits();updateViewBranchBtn();});

    // ── Inner section toggle (Metadata ↔ Git Push) ───────────────────────────
    // ── Section toggle (Metadata / Git Push) ─────────────────────────────────
    function switchGitSection(sec){
      document.querySelectorAll('.git-section-btn').forEach(b=>b.classList.toggle('active',b.dataset.sec===sec));
      const metaSec=p('git-section-meta');const pushSec=p('git-section-push');
      if(metaSec)metaSec.style.display=sec==='meta'?'block':'none';
      if(pushSec)pushSec.style.display=sec==='push'?'flex':'none';
    }
    document.querySelectorAll('.git-section-btn').forEach(btn=>{
      btn.addEventListener('click',()=>switchGitSection(btn.dataset.sec));
    });

    // ── Export helpers ───────────────────────────────────────────────────────
    function setExportProgress(done,total,label){
      const d=p('git-export-progress');if(!d)return;
      d.style.display=done>=total&&total>0?'none':'block';
      const pct=total?Math.round(done/total*100):0;
      const bar=p('git-export-bar');if(bar)bar.style.width=pct+'%';
      const lbl=p('git-export-label');if(lbl)lbl.textContent=label?`Fetching ${label}…`:'Building…';
      const cnt=p('git-export-count');if(cnt)cnt.textContent=`${done} / ${total}`;
      const cur=p('git-export-file');if(cur)cur.textContent=label||'';
    }

    function getFilesToExport(){
      const list=[];
      for(const[type,selNames]of Object.entries(metaSelectedByType)){
        if(!selNames.size)continue;
        const members=metaMembersByType[type]||[];
        for(const m of members){if(selNames.has(m.fullName))list.push({type,fullName:m.fullName,fileName:m.fileName,id:m.id});}
      }
      return list;
    }

    function updateExportOrgLabel(){
      const el=p('git-export-name-input');
      if(!el||el.value.trim())return; // don't overwrite if user typed something
      const name=buildExportFolderName();
      el.placeholder=name;
    }

    // ── 💾 Download ZIP ──────────────────────────────────────────────────────
    p('git-download-zip-btn').addEventListener('click',async()=>{
      const files=getFilesToExport();
      if(!files.length){alert('Select at least one file first (Metadata tab).');return;}
      const customName=p('git-export-name-input')?.value.trim()||'';
      const folderName=buildExportFolderName(customName);
      log('info',`💾 ZIP export started — ${files.length} files → ${folderName}.zip`,'Git');
      const btn=p('git-download-zip-btn');btn.disabled=true;btn.textContent='⏳ Building…';
      try{
        setExportProgress(0,files.length,'');
        const collected=await collectExportFiles(files,(done,total,name)=>{
          setExportProgress(done,total,name);
        });
        if(!collected.length){alert('No file bodies could be fetched. Check SF toggle is ON.');return;}
        const count=await downloadAsZIP(collected,folderName);
        log('success',`✅ ZIP downloaded: ${count} files as ${folderName}.zip`,'Git');
        setExportProgress(files.length,files.length,'');
        btn.textContent='✅ Downloaded!';
        setTimeout(()=>{btn.textContent='💾 ZIP';btn.disabled=false;},2500);
      }catch(e){
        log('error','ZIP export failed: '+e,'Git');
        alert('ZIP export failed:\n'+e);
        btn.textContent='💾 ZIP';btn.disabled=false;
        setExportProgress(files.length,files.length,'');
      }
    });

    // ── 📁 Save to Local Folder ──────────────────────────────────────────────
    p('git-save-folder-btn').addEventListener('click',async()=>{
      if(!('showDirectoryPicker'in window)){
        alert('📁 Local Folder requires Chrome 86+ with HTTPS.\n\nUse 💾 ZIP instead and extract locally.');
        return;
      }
      const files=getFilesToExport();
      if(!files.length){alert('Select at least one file first (Metadata tab).');return;}
      const customName=p('git-export-name-input')?.value.trim()||'';
      const folderName=buildExportFolderName(customName);

      // ⚠️ MUST call showDirectoryPicker synchronously inside user-gesture handler
      // — any await before this call kills the gesture context and causes SecurityError
      let dirHandle;
      try{
        dirHandle=await window.showDirectoryPicker({mode:'readwrite',startIn:'documents'});
      }catch(e){
        if(e.name==='AbortError'||String(e).includes('abort')){
          log('info','Folder picker cancelled by user','Git');
        }else{
          log('error','Folder picker failed: '+e,'Git');
          alert('Could not open folder picker:\n'+e);
        }
        return;
      }

      // Picker done — now safe to do async fetching
      const btn=p('git-save-folder-btn');btn.disabled=true;btn.textContent='⏳ Saving…';
      log('info',`📁 Folder picked: ${dirHandle.name} — fetching ${files.length} files → ${folderName}/`,'Git');
      try{
        setExportProgress(0,files.length,'');
        const collected=await collectExportFiles(files,(done,total,name)=>{
          setExportProgress(done,total,name);
        });
        if(!collected.length){
          alert('No file bodies could be fetched. Make sure SF toggle is ON and you have selected Apex / LWC types.');
          btn.textContent='📁 Folder';btn.disabled=false;
          return;
        }

        // Write files into the user-selected directory
        log('info',`Writing ${collected.length} files to ${dirHandle.name}/${folderName}/`,'Git');
        const orgDir=await dirHandle.getDirectoryHandle(folderName,{create:true});
        const defDir=await(await(await(await orgDir
          .getDirectoryHandle('force-app',{create:true}))
          .getDirectoryHandle('main',{create:true}))
          .getDirectoryHandle('default',{create:true}));

        let written=0;
        for(const f of collected){
          const parts=f.path.split('/');const fn=parts.pop();
          let cur=defDir;
          for(const seg of parts)cur=await cur.getDirectoryHandle(seg,{create:true});
          const fh=await cur.getFileHandle(fn,{create:true});
          const w=await fh.createWritable();
          await w.write(f.body);
          await w.close();
          written++;
          if(written%10===0)await yieldToBrowser();
        }

        log('success',`✅ Saved ${written} files → ${dirHandle.name}/${folderName}/force-app/main/default/`,'Git');
        setExportProgress(files.length,files.length,'');
        btn.textContent='✅ Saved!';
        alert(`✅ Saved ${written} files to:\n📁 ${dirHandle.name}/${folderName}/force-app/main/default/\n\nFrom that folder in gitbash:\n  cd ${folderName}\n  git init   (if new)\n  git add .\n  git commit -m "feat: SF metadata backup"\n  git push`);
        setTimeout(()=>{btn.textContent='📁 Folder';btn.disabled=false;},2500);
      }catch(e){
        log('error','Folder write failed: '+e,'Git');
        alert('Save failed while writing files:\n'+e+'\n\nTry using 💾 ZIP instead.');
        btn.textContent='📁 Folder';btn.disabled=false;
        setExportProgress(files.length,files.length,'');
      }
    });

    // ── Push source toggle (SF Metadata ↔ Local Folder) ─────────────────────
    document.querySelectorAll('.git-push-src-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const src=btn.dataset.src;
        document.querySelectorAll('.git-push-src-btn').forEach(b=>b.classList.toggle('active',b.dataset.src===src));
        p('git-pushsrc-sf').style.display=src==='sf'?'block':'none';
        p('git-pushsrc-local').style.display=src==='local'?'block':'none';
        log('info',`Push source switched to: ${src==='sf'?'SF Metadata':'Local Folder'}`,'Git');
      });
    });

    // ── Local Folder Push ────────────────────────────────────────────────────
    let localFolderHandle=null;     // DirectoryHandle of picked folder
    let localFilesMap=new Map();    // path → {handle, size}
    let localSelectedPaths=new Set();

    async function scanDirectory(dirHandle,basePath,result){
      for await(const[name,handle]of dirHandle.entries()){
        if(name.startsWith('.'))continue; // skip .git, .sfdx etc
        const rel=basePath?`${basePath}/${name}`:name;
        if(handle.kind==='directory'){
          await scanDirectory(handle,rel,result);
        }else{
          // Only include source files (skip package.xml, .json manifests at root etc)
          if(/\.(cls|trigger|page|component|lwc|js|html|css|xml|json|yaml|flow|permissionset|resource|app|cmp)$/.test(name)){
            const file=await handle.getFile();
            result.set(rel,{handle,size:file.size,name});
          }
        }
      }
    }

    function renderLocalFileList(filter){
      const list=p('git-local-file-list');if(!list)return;
      const lf=(filter||'').toLowerCase();
      const entries=[...localFilesMap.entries()]
        .filter(([path])=>!lf||path.toLowerCase().includes(lf))
        .sort(([a],[b])=>a.localeCompare(b));
      if(!entries.length){
        list.innerHTML='<div style="padding:10px;text-align:center;font-size:9.5px;color:var(--text-muted)">No matching files</div>';
        return;
      }
      list.innerHTML=entries.map(([path,info])=>`
        <div class="git-local-file-row">
          <input type="checkbox" class="git-local-file-cb" data-path="${escH(path)}" ${localSelectedPaths.has(path)?'checked':''}>
          <span class="git-local-file-path" title="${escH(path)}">${escH(path)}</span>
          <span class="git-local-file-size">${(info.size/1024).toFixed(1)}k</span>
        </div>`).join('');
      list.querySelectorAll('.git-local-file-cb').forEach(cb=>{
        cb.addEventListener('change',()=>{
          if(cb.checked)localSelectedPaths.add(cb.dataset.path);
          else localSelectedPaths.delete(cb.dataset.path);
          updateLocalSelCount();
        });
      });
      updateLocalSelCount();
    }

    function updateLocalSelCount(){
      const el=p('git-local-sel-count');
      if(el)el.textContent=`${localSelectedPaths.size} selected`;
      const sa=p('git-local-selall');
      if(sa){const vis=[...localFilesMap.keys()].filter(k=>!p('git-local-search')?.value||k.toLowerCase().includes(p('git-local-search').value.toLowerCase()));sa.checked=vis.length>0&&vis.every(k=>localSelectedPaths.has(k));sa.indeterminate=!sa.checked&&vis.some(k=>localSelectedPaths.has(k));}
    }

    p('git-pick-local-btn').addEventListener('click',async()=>{
      if(!('showDirectoryPicker'in window)){alert('File System Access API not available in this browser.');return;}
      log('info','📂 Pick Local Folder clicked — opening folder picker…','Git');
      try{
        localFolderHandle=await window.showDirectoryPicker({mode:'read',startIn:'documents'});
        const nameEl=p('git-local-folder-name');
        if(nameEl)nameEl.textContent='⏳ Scanning '+localFolderHandle.name+'…';
        log('info',`Scanning folder: ${localFolderHandle.name}`,'Git');
        localFilesMap=new Map();
        await scanDirectory(localFolderHandle,'',localFilesMap);
        localSelectedPaths=new Set(localFilesMap.keys()); // select all by default
        log('success',`Found ${localFilesMap.size} files in ${localFolderHandle.name}`,'Git');
        if(nameEl)nameEl.textContent=`📁 ${localFolderHandle.name} (${localFilesMap.size} files)`;
        p('git-local-tree-section').style.display='block';
        p('git-local-push-config').style.display='block';
        // Populate repo dropdowns from main repo select
        const mainRepoSel=p('git-repo-select');
        const localRepoSel=p('git-local-repo-select');
        if(mainRepoSel&&localRepoSel){localRepoSel.innerHTML=mainRepoSel.innerHTML;localRepoSel.value=mainRepoSel.value||'';}
        renderLocalFileList();
      }catch(e){
        if(String(e).includes('AbortError')){log('info','Folder picker cancelled','Git');return;}
        log('error','Folder pick failed: '+e,'Git');
        alert('Could not open folder: '+e);
      }
    });

    p('git-local-selall').addEventListener('change',e=>{
      const vis=[...localFilesMap.keys()].filter(k=>!p('git-local-search')?.value||k.toLowerCase().includes(p('git-local-search').value.toLowerCase()));
      if(e.target.checked)vis.forEach(k=>localSelectedPaths.add(k));
      else vis.forEach(k=>localSelectedPaths.delete(k));
      renderLocalFileList(p('git-local-search')?.value);
    });

    p('git-local-search').addEventListener('input',e=>renderLocalFileList(e.target.value));

    p('git-local-repo-select').addEventListener('change',async e=>{
      const repo=e.target.value;if(!repo)return;
      const[o,r]=repo.split('/');
      try{
        const branches=await ghGetBranches(o,r);
        const sel=p('git-local-branch-select');
        if(sel)sel.innerHTML=branches.map(b=>`<option value="${b.name}">${b.name}</option>`).join('');
      }catch(e2){log('error','Could not load branches: '+e2,'Git');}
    });

    let localPushRunning=false;
    p('git-local-do-push').addEventListener('click',async()=>{
      if(localPushRunning){alert('Push already running.');return;}
      if(!localSelectedPaths.size){alert('Select at least one file.');return;}
      const repo=p('git-local-repo-select')?.value;
      if(!repo){alert('Select a GitHub repo first.');return;}
      const nb=p('git-local-new-branch')?.value.trim();
      const baseBranch=p('git-local-branch-select')?.value||'main';
      const dateStr=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).replace(/ /g,'-');
      const cm=p('git-local-commit-msg')?.value.trim()||`feat: push local SF metadata | ${USER_NAME} | ${dateStr}`;
      const[o,r]=repo.split('/');
      const res=p('git-local-push-result');
      const prog=p('git-local-push-progress');
      const lw=p('git-local-push-links');
      if(res)res.style.display='none';if(lw)lw.style.display='none';
      const paths=[...localSelectedPaths];
      log('info',`📁 Local push started — ${paths.length} files → ${repo} / ${nb||baseBranch}`,'Git');
      localPushRunning=true;
      p('git-local-do-push').disabled=true;
      if(prog)prog.style.display='block';
      try{
        let branch=baseBranch;
        if(nb){
          log('info',`Creating new branch: ${nb} from ${baseBranch}`,'Git');
          await ghCreateBranch(o,r,nb,baseBranch);branch=nb;
          const branches=await ghGetBranches(o,r);
          const bsel=p('git-local-branch-select');
          if(bsel){bsel.innerHTML=branches.map(b=>`<option value="${b.name}">${b.name}</option>`).join('');bsel.value=nb;}
          p('git-local-new-branch').value='';
        }
        let pushed=0,failed=0;
        for(let i=0;i<paths.length;i++){
          const path=paths[i];
          const info=localFilesMap.get(path);
          // Progress
          const pct=Math.round(i/paths.length*100);
          const bar=p('git-local-push-bar');if(bar)bar.style.width=pct+'%';
          const lbl=p('git-local-push-label');if(lbl)lbl.textContent=`Pushing ${path}…`;
          const cnt=p('git-local-push-count');if(cnt)cnt.textContent=`${i}/${paths.length}`;
          const cur=p('git-local-push-file');if(cur)cur.textContent=path;
          if(i>0&&i%10===0)await yieldToBrowser();
          try{
            const file=await info.handle.getFile();
            const body=await file.text();
            // Use the relative path from the picked folder as the GitHub path
            const ghPath=path.startsWith('force-app/')?path:`force-app/main/default/${path}`;
            let sha;try{const ex=await ghGetContents(o,r,ghPath,branch);sha=ex.sha;}catch(e2){}
            await ghCommitFile(o,r,ghPath,body,cm,branch,sha);
            pushed++;
            log('success',`Pushed: ${ghPath}`,'Git');
          }catch(e){failed++;log('error',`Failed: ${path} — ${e}`,'Git');}
        }
        const bar=p('git-local-push-bar');if(bar){bar.style.width='100%';bar.className='spa-progress-fill '+(failed===0?'done':pushed>0?'partial':'failed');}
        const lbl=p('git-local-push-label');if(lbl)lbl.textContent=failed===0?'Complete!':'Done with errors';
        const cnt=p('git-local-push-count');if(cnt)cnt.textContent=`${paths.length}/${paths.length}`;
        if(res){
          res.style.display='block';
          res.className=failed?'git-push-result fail':'git-push-result ok';
          res.textContent=`✅ Pushed ${pushed} file(s) to '${branch}'`+(failed?` · ❌ ${failed} failed`:'');
        }
        // Show links
        if(pushed>0&&lw){
          lw.style.display='flex';
          lw.innerHTML=`<div style="font-size:9.5px;color:var(--text-muted);font-weight:600;margin-bottom:3px">🔗 Quick Links</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              <a class="git-push-link-btn primary-link" href="https://github.com/${repo}/tree/${encodeURIComponent(branch)}" target="_blank" rel="noopener">🌐 View Branch</a>
              <a class="git-push-link-btn" href="https://github.com/${repo}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(branch)}?expand=1" target="_blank" rel="noopener">⤴ Open PR</a>
            </div>`;
        }
        log('success',`Local push complete: ${pushed} pushed, ${failed} failed → branch '${branch}'`,'Git');
      }catch(e){
        if(res){res.style.display='block';res.className='git-push-result fail';res.textContent='❌ Push failed: '+e;}
        log('error','Local folder push failed: '+e,'Git');
      }finally{
        localPushRunning=false;
        p('git-local-do-push').disabled=false;
      }
    });

    // ── Two-panel metadata helpers ────────────────────────────────────────────
    function getTypeSel(type){if(!metaSelectedByType[type])metaSelectedByType[type]=new Set();return metaSelectedByType[type];}
    function getTotalSelected(){return Object.values(metaSelectedByType).reduce((s,sel)=>s+sel.size,0);}
    function getTotalTypesWithSel(){return Object.values(metaSelectedByType).filter(sel=>sel.size>0).length;}

    function updateSummary(){
      const files=getTotalSelected(),types=getTotalTypesWithSel();
      const el=p('git-selection-count');
      if(el)el.textContent=files>0?`${files} file${files!==1?'s':''} across ${types} type${types!==1?'s':''} selected`:'Nothing selected';
      const clr=p('git-clear-sel-btn');if(clr)clr.style.display=files>0?'':'none';
      const btn=p('git-do-push');if(btn)btn.textContent=`↑ Push${files?' ('+files+')':' selected'}`;
      updateExportOrgLabel();
    }

    function setLoadProgress(done,total,label){
      const d=p('git-load-progress');
      if(!d)return;
      if(done>=total&&total>0){d.style.display='none';return;}
      d.style.display='block';
      const pct=total?Math.round(done/total*100):0;
      const bar=p('git-load-bar');if(bar)bar.style.width=pct+'%';
      const lbl=p('git-load-label');if(lbl)lbl.textContent=label||'Loading…';
      const cnt=p('git-load-count');if(cnt)cnt.textContent=`${done} / ${total}`;
    }

    function setPushProgress(done,total,fileName,state){
      const d=p('git-push-progress');if(!d)return;
      d.style.display='block';
      const pct=total?Math.round(done/total*100):0;
      const bar=p('git-push-bar');
      if(bar){bar.style.width=pct+'%';bar.className='spa-progress-fill'+(state==='done'?' done':state==='partial'?' partial':state==='failed'?' failed':'');}
      const lbl=p('git-push-progress-label');if(lbl)lbl.textContent=state==='done'?'Complete!':state==='failed'?'Failed':'Pushing…';
      const cnt=p('git-push-progress-count');if(cnt)cnt.textContent=`${done} / ${total}`;
      const cur=p('git-push-current-file');if(cur)cur.textContent=fileName||'';
    }

    // ── LHS: render type list ─────────────────────────────────────────────────
    function renderTypeList(filter){
      const list=p('git-type-list');if(!list)return;
      const lf=(filter||'').toLowerCase();
      const types=metaAllTypes.filter(t=>!lf||t.xmlName.toLowerCase().includes(lf));
      if(!types.length){
        list.innerHTML=metaAllTypes.length
          ?'<div style="padding:10px;text-align:center;font-size:9.5px;color:var(--text-muted)">No match</div>'
          :'<div style="padding:14px;text-align:center;font-size:9.5px;color:var(--text-muted)">Click 🔍 Load All Types</div>';
        const lc=p('git-lhs-count');if(lc)lc.textContent='';return;
      }
      list.innerHTML=types.map(t=>{
        const members=metaMembersByType[t.xmlName];
        const sel=metaSelectedByType[t.xmlName];
        const selCount=sel?sel.size:0;
        const total=members?members.length:null;
        const allChk=total!==null&&total>0&&selCount===total;
        const someChk=selCount>0&&!allChk;
        const isAct=metaActiveType===t.xmlName;
        return`<div class="git-type-row${isAct?' active':''}" data-type="${escH(t.xmlName)}">
          <input type="checkbox" class="git-type-cb" data-type="${escH(t.xmlName)}" ${allChk?'checked':''} ${someChk?'data-indet="1"':''}>
          <span class="git-type-name">${escH(t.xmlName)}</span>
          ${total!==null?`<span class="git-type-badge">${selCount?selCount+'/':''}${total}</span>`:''}
        </div>`;
      }).join('');
      // Set indeterminate
      list.querySelectorAll('.git-type-cb[data-indet]').forEach(cb=>{cb.indeterminate=true;});
      // Wire events
      list.querySelectorAll('.git-type-row').forEach(row=>{
        const type=row.dataset.type;
        row.addEventListener('click',e=>{if(e.target.type==='checkbox')return;setActiveType(type);});
        row.querySelector('.git-type-cb')?.addEventListener('change',async e=>{
          const checked=e.target.checked;
          if(checked&&metaMembersByType[type]===undefined)await loadMembersForType(type);
          const members=metaMembersByType[type]||[];
          metaSelectedByType[type]=checked?new Set(members.map(m=>m.fullName)):new Set();
          updateSummary();renderTypeList(p('git-type-search')?.value);
          if(metaActiveType===type)renderMemberList(p('git-member-search')?.value);
        });
      });
      const lc=p('git-lhs-count');if(lc)lc.textContent=`${metaAllTypes.length} type${metaAllTypes.length!==1?'s':''}`;
      // Sync select-all checkbox
      const sa=p('git-selall-types');
      if(sa){const ts=getTotalSelected();sa.checked=ts>0&&metaAllTypes.every(t=>{const m=metaMembersByType[t.xmlName];const s=metaSelectedByType[t.xmlName];return m&&m.length>0&&s&&s.size===m.length;});sa.indeterminate=!sa.checked&&ts>0;}
    }

    // ── RHS: render member list ───────────────────────────────────────────────
    function renderMemberList(filter){
      const list=p('git-member-list');const rhsTitle=p('git-rhs-type-label');if(!list)return;
      if(!metaActiveType){
        list.innerHTML='<div style="padding:14px;text-align:center;font-size:9.5px;color:var(--text-muted)">← Select a type</div>';
        if(rhsTitle)rhsTitle.textContent='Members';return;
      }
      if(rhsTitle)rhsTitle.textContent=metaActiveType;
      const members=metaMembersByType[metaActiveType];
      if(members===undefined){
        list.innerHTML=`<div style="padding:10px;text-align:center;font-size:9.5px;color:var(--text-muted)">
          <button class="kp-btn" id="git-load-this-btn" style="font-size:9px">⬇ Load ${escH(metaActiveType)}</button></div>`;
        p('git-load-this-btn')?.addEventListener('click',async()=>{
          list.innerHTML='<div style="padding:10px;text-align:center;font-size:9.5px;color:var(--text-muted)">⏳ Loading…</div>';
          await loadMembersForType(metaActiveType);
          renderTypeList(p('git-type-search')?.value);renderMemberList(p('git-member-search')?.value);});
        return;
      }
      const lf=(filter||'').toLowerCase();
      const filtered=lf?members.filter(m=>m.fullName.toLowerCase().includes(lf)):members;
      const sel=metaSelectedByType[metaActiveType]||new Set();
      if(!filtered.length){
        list.innerHTML=members.length
          ?'<div style="padding:10px;text-align:center;font-size:9.5px;color:var(--text-muted)">No match</div>'
          :'<div style="padding:10px;text-align:center;font-size:9.5px;color:var(--text-muted)">No members in org</div>';
        const rc=p('git-rhs-count');if(rc)rc.textContent='0';return;
      }
      list.innerHTML=filtered.map(m=>
        `<div class="git-member-row">
          <input type="checkbox" class="git-member-cb" data-fn="${escH(m.fullName)}" ${sel.has(m.fullName)?'checked':''}>
          <span class="git-member-name" title="${escH(m.fullName)}">${escH(m.fullName)}</span>
          ${m.lastModifiedByName?`<span class="git-member-date">${escH(m.lastModifiedByName.split(' ')[0])}</span>`:''}
        </div>`
      ).join('');
      list.querySelectorAll('.git-member-cb').forEach(cb=>{
        cb.addEventListener('change',()=>{
          const fn=cb.dataset.fn;const s=getTypeSel(metaActiveType);
          if(cb.checked)s.add(fn);else s.delete(fn);
          updateSummary();
          const mb=metaMembersByType[metaActiveType]||[];
          const tcb=document.querySelector(`.git-type-cb[data-type="${metaActiveType}"]`);
          if(tcb){tcb.checked=mb.length>0&&s.size===mb.length;tcb.indeterminate=s.size>0&&s.size<mb.length;}
          const sa=p('git-selall-members');
          if(sa){sa.checked=filtered.length>0&&filtered.every(m2=>s.has(m2.fullName));sa.indeterminate=!sa.checked&&filtered.some(m2=>s.has(m2.fullName));}
        });
      });
      const rc=p('git-rhs-count');if(rc)rc.textContent=`${filtered.length} of ${members.length}`;
      const sa=p('git-selall-members');
      if(sa){sa.checked=filtered.length>0&&filtered.every(m=>sel.has(m.fullName));sa.indeterminate=!sa.checked&&filtered.some(m=>sel.has(m.fullName));}
    }

    // ── Active type ───────────────────────────────────────────────────────────
    async function setActiveType(type){
      log('info',`Viewing: ${type}${metaMembersByType[type]!==undefined?' (cached: '+metaMembersByType[type].length+' members)':' — members not yet loaded'}`,'Git');
      metaActiveType=type;
      document.querySelectorAll('.git-type-row').forEach(r=>r.classList.toggle('active',r.dataset.type===type));
      if(metaMembersByType[type]===undefined){
        const list=p('git-member-list');
        if(list)list.innerHTML='<div style="padding:12px;text-align:center;font-size:9.5px;color:var(--text-muted)">⏳ Loading members…</div>';
        await loadMembersForType(type);
        renderTypeList(p('git-type-search')?.value);
      }
      renderMemberList(p('git-member-search')?.value);
    }

    // Load members via SOAP listMetadata → fallback to Tooling API
    async function loadMembersForType(type){
      log('info',`Loading members for: ${type} via SOAP listMetadata…`,'Git');
      try{
        const members=await metaList(type);
        metaMembersByType[type]=members;
        log('success',`${type}: ${members.length} members loaded via SOAP`,'Git');
        return members;
      }catch(e){
        log('warn',`${type} SOAP listMetadata failed (${e}) — trying Tooling API fallback`,'Git');
        const cfg=META_TYPES[type];
        if(cfg){
          try{
            log('info',`${type} → Tooling API query: ${cfg.path}`,'Git');
            const files=await loadMetadataFiles(type);
            const members=files.map(f=>({fullName:f.name,fileName:`${cfg.dir}/${f.name}${cfg.ext}`,type,id:f.id}));
            metaMembersByType[type]=members;
            log('success',`${type}: ${members.length} members loaded via Tooling API`,'Git');
            return members;
          }catch(e2){log('error',`${type} Tooling API also failed: ${e2}`,'Git');}
        }else{
          log('warn',`${type} not in META_TYPES config — no Tooling API fallback available`,'Git');
        }
        metaMembersByType[type]=[];
        log('info',`${type}: recorded as empty (0 members)`,'Git');
        return[];
      }
    }

    // ── Load All Types (describeMetadata) ─────────────────────────────────────
    async function loadAllTypes(){
      const btn=p('git-describe-btn');
      btn.disabled=true;btn.textContent='⏳ Loading…';
      log('info','🔍 Load All Types clicked — calling SOAP describeMetadata…','Git');
      try{
        metaAllTypes=await metaDescribe();
        log('success',`Discovered ${metaAllTypes.length} metadata types. First 10: ${metaAllTypes.slice(0,10).map(t=>t.xmlName).join(', ')}…`,'Git');
        renderTypeList();
        btn.textContent=`🔍 ${metaAllTypes.length} Types`;
      }catch(e){
        log('error','describeMetadata failed: '+e,'Git');
        alert('Could not load metadata types:\n'+e+'\n\nMake sure the SF toggle is ON and you are on a Salesforce page.');
        btn.textContent='🔍 Load All Types';
      }finally{btn.disabled=false;}
    }

    p('git-describe-btn').addEventListener('click',loadAllTypes);

    // Select All Metadata — batched (3 types per SOAP call) + yield every batch
    p('git-select-all-meta-btn').addEventListener('click',async()=>{
      if(!sfConsentGiven){alert('Enable the SF toggle first.');return;}
      if(!metaAllTypes.length){await loadAllTypes();}
      if(!metaAllTypes.length)return;
      const btn=p('git-select-all-meta-btn');btn.disabled=true;
      const types=metaAllTypes;const total=types.length;let done=0;
      const BATCH=3; // 3 types per SOAP call
      for(let i=0;i<types.length;i+=BATCH){
        const batch=types.slice(i,i+BATCH);
        const unloaded=batch.filter(t=>metaMembersByType[t.xmlName]===undefined);
        setLoadProgress(done,total,batch.map(t=>t.xmlName).join(', '));
        if(unloaded.length){
          try{
            // Batch call — 3 types in one SOAP round-trip
            const results=await metaListBatch(unloaded.map(t=>t.xmlName));
            for(const t of unloaded){
              metaMembersByType[t.xmlName]=results[t.xmlName]||[];
            }
          }catch(e){
            // Individual fallback if batch fails
            for(const t of unloaded){
              try{metaMembersByType[t.xmlName]=await metaList(t.xmlName);}
              catch(e2){metaMembersByType[t.xmlName]=[];}
            }
          }
        }
        for(const t of batch){
          const members=metaMembersByType[t.xmlName]||[];
          metaSelectedByType[t.xmlName]=new Set(members.map(m=>m.fullName));
        }
        done+=batch.length;
        setLoadProgress(done,total,'');
        await yieldToBrowser(); // yield after every batch so UI stays responsive
      }
      renderTypeList(p('git-type-search')?.value);
      if(metaActiveType)renderMemberList(p('git-member-search')?.value);
      updateSummary();btn.disabled=false;
      log('success','All metadata selected: '+getTotalSelected()+' files','Git');
    });

    // Search filters
    p('git-type-search').addEventListener('input',e=>renderTypeList(e.target.value));
    p('git-member-search').addEventListener('input',e=>renderMemberList(e.target.value));

    // Select-all types checkbox — batched + yield
    p('git-selall-types').addEventListener('change',async e=>{
      const checked=e.target.checked;
      if(!metaAllTypes.length)return;
      if(checked){
        const btn=p('git-select-all-meta-btn');if(btn)btn.disabled=true;
        const types=metaAllTypes;const total=types.length;let done=0;
        const BATCH=3;
        for(let i=0;i<types.length;i+=BATCH){
          const batch=types.slice(i,i+BATCH);
          const unloaded=batch.filter(t=>metaMembersByType[t.xmlName]===undefined);
          setLoadProgress(done,total,batch[0]?.xmlName||'');
          if(unloaded.length){
            try{
              const results=await metaListBatch(unloaded.map(t=>t.xmlName));
              for(const t of unloaded)metaMembersByType[t.xmlName]=results[t.xmlName]||[];
            }catch(e2){
              for(const t of unloaded){try{metaMembersByType[t.xmlName]=await metaList(t.xmlName);}catch(e3){metaMembersByType[t.xmlName]=[];}}
            }
          }
          for(const t of batch){metaSelectedByType[t.xmlName]=new Set((metaMembersByType[t.xmlName]||[]).map(m=>m.fullName));}
          done+=batch.length;await yieldToBrowser();
        }
        setLoadProgress(total,total,'');
        if(btn)btn.disabled=false;
      }else{metaAllTypes.forEach(t=>{metaSelectedByType[t.xmlName]=new Set();});}
      renderTypeList(p('git-type-search')?.value);if(metaActiveType)renderMemberList(p('git-member-search')?.value);updateSummary();
    });

    // Select-all members checkbox
    p('git-selall-members').addEventListener('change',e=>{
      if(!metaActiveType)return;
      const members=metaMembersByType[metaActiveType]||[];
      metaSelectedByType[metaActiveType]=e.target.checked?new Set(members.map(m=>m.fullName)):new Set();
      renderMemberList(p('git-member-search')?.value);
      renderTypeList(p('git-type-search')?.value);updateSummary();
    });

    // Clear all selections
    p('git-clear-sel-btn').addEventListener('click',()=>{
      metaSelectedByType={};renderTypeList(p('git-type-search')?.value);
      if(metaActiveType)renderMemberList(p('git-member-search')?.value);updateSummary();
    });

    // ── URL helpers ──────────────────────────────────────────────────────────
    function ghBranchUrl(repo,branch){return`https://github.com/${repo}/tree/${encodeURIComponent(branch)}`;}
    function ghCompareUrl(repo,base,head){return`https://github.com/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;}
    function ghNewPRUrl(repo,base,head){return`https://github.com/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?expand=1`;}

    function updateViewBranchBtn(){
      const btn=p('git-view-branch-btn');if(!btn||!selectedRepo||!selectedBranch)return;
      btn.style.display='inline-flex';btn.onclick=()=>window.open(ghBranchUrl(selectedRepo,selectedBranch),'_blank');
    }

    function showPushLinks(branch,baseBranch){
      const wrap=p('git-push-links');if(!wrap||!selectedRepo)return;
      wrap.style.display='flex';
      wrap.innerHTML=`<div style="font-size:9.5px;color:var(--text-muted);font-weight:600;margin-bottom:3px">🔗 Quick Links</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <a class="git-push-link-btn primary-link" href="${ghBranchUrl(selectedRepo,branch)}" target="_blank" rel="noopener">🌐 View Branch</a>
          <a class="git-push-link-btn" href="${ghCompareUrl(selectedRepo,baseBranch||'main',branch)}" target="_blank" rel="noopener">🔀 Compare</a>
          <a class="git-push-link-btn" href="${ghNewPRUrl(selectedRepo,baseBranch||'main',branch)}" target="_blank" rel="noopener">⤴ Open PR</a>
        </div>`;
    }

    // ── Push ─────────────────────────────────────────────────────────────────
    let pushRunning=false; // lock — prevents double-click freeze
    p('git-do-push').addEventListener('click',async()=>{
      if(pushRunning){alert('Push already in progress — please wait.');return;}
      const filesToPush=[];
      for(const[type,selNames]of Object.entries(metaSelectedByType)){
        if(!selNames.size)continue;
        const members=metaMembersByType[type]||[];
        for(const m of members){if(selNames.has(m.fullName))filesToPush.push({type,fullName:m.fullName,fileName:m.fileName,id:m.id});}
      }
      if(!filesToPush.length){alert('Select at least one file first.');return;}
      if(!selectedRepo){alert('Select a GitHub repo first.');return;}
      const WARN_THRESHOLD=100;
      if(filesToPush.length>WARN_THRESHOLD){
        const ok=confirm(
          '⚠️ Large Push Warning\n\n'+
          'You are about to push '+filesToPush.length+' files.\n\n'+
          '• This will make '+(filesToPush.length*2)+' API calls (Salesforce + GitHub)\n'+
          '• It may take several minutes\n'+
          '• Do not close the tab while push is running\n\n'+
          'Tip: Push one metadata type at a time for faster results.\n\nContinue?'
        );
        if(!ok)return;
      }
      pushRunning=true;
      const pushBtn=p('git-do-push');if(pushBtn)pushBtn.disabled=true;
      const nb=p('git-new-branch-name').value.trim();
      const dateStr=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).replace(/ /g,'-');
      const cm=p('git-commit-msg').value.trim()||`feat: push SF metadata | ${USER_NAME} | ${dateStr}`;
      const[o,r]=selectedRepo.split('/');
      const res=p('git-push-result');
      res.style.display='none';const lw=p('git-push-links');if(lw)lw.style.display='none';
      setPushProgress(0,filesToPush.length,'Preparing…','');
      try{
        const baseBranch=selectedBranch||'main';let branch=baseBranch;
        if(nb){
          setPushProgress(0,filesToPush.length,`Creating branch '${nb}'…`,'');
          await ghCreateBranch(o,r,nb,baseBranch);branch=nb;
          const branches=await ghGetBranches(o,r);
          const bsel=p('git-branch-select');
          if(bsel){bsel.innerHTML=branches.map(b=>`<option value="${b.name}">${b.name}</option>`).join('');bsel.value=nb;}
          selectedBranch=nb;p('git-new-branch-name').value='';
        }
        let pushed=0,failed=0,skipped=0;
        const YIELD_EVERY=10;
        for(let i=0;i<filesToPush.length;i++){
          const file=filesToPush[i];
          setPushProgress(i,filesToPush.length,file.fullName,'');
          if(i>0&&i%YIELD_EVERY===0)await yieldToBrowser();
          try{
            const body=await fetchFileBody(file.type,file.id,file.fullName);
            if(body.startsWith('// Body fetch not implemented')){skipped++;continue;}
            const fp=buildFilePath(file);
            let sha;try{const ex=await ghGetContents(o,r,fp,branch);sha=ex.sha;}catch(e){}
            await ghCommitFile(o,r,fp,body,cm,branch,sha);pushed++;
          }catch(e){failed++;log('error',`Failed: ${file.fullName} — ${e}`,'GitHub');}
        }
        const state=failed===0?'done':pushed>0?'partial':'failed';
        setPushProgress(filesToPush.length,filesToPush.length,'',state);
        res.style.display='block';
        res.className=failed?'git-push-result fail':'git-push-result ok';
        res.textContent=`✅ Pushed ${pushed}`+(skipped?` · ⏭ ${skipped} skipped`:'')+(failed?` · ❌ ${failed} failed`:'')+` to '${branch}'`;
        if(pushed>0)showPushLinks(branch,baseBranch);
        updateViewBranchBtn();await loadCommits();
      }catch(e){
        setPushProgress(0,0,'','failed');
        res.style.display='block';res.className='git-push-result fail';
        res.textContent='❌ Push failed: '+e;
      }finally{
        pushRunning=false;
        if(pushBtn)pushBtn.disabled=false;
      }
    });

    // PR form
    p('git-pr-btn').addEventListener('click',()=>{
      const f=p('git-pr-form');f.style.display=f.style.display==='none'?'flex':'none';f.style.flexDirection='column';p('git-pr-base').value='main';
      if(selectedBranch&&selectedRepo){const ti=p('git-pr-title');if(ti&&!ti.value)ti.value='feat: '+selectedBranch.replace(/-/g,' ');}
    });
    p('git-cancel-pr').addEventListener('click',()=>(p('git-pr-form').style.display='none'));
    p('git-do-pr').addEventListener('click',async()=>{
      const title=p('git-pr-title').value.trim(),base=p('git-pr-base').value.trim()||'main',body=p('git-pr-body').value.trim();
      if(!title||!selectedRepo){alert('Enter PR title and select repo.');return;}
      const[o,r]=selectedRepo.split('/');
      try{const pr=await ghCreatePR(o,r,title,body,selectedBranch,base);addMsg(`✅ PR created!\n**${pr.title}**\n${pr.html_url}`,'sys');p('git-pr-form').style.display='none';showPushLinks(selectedBranch,base);document.querySelector('[data-tab="chat"]').click();}catch(e){alert('Failed: '+e);}
    });
    p('git-view-branch-btn').addEventListener('click',()=>{if(selectedRepo&&selectedBranch)window.open(ghBranchUrl(selectedRepo,selectedBranch),'_blank');});


    // ── Logs (settings inner tab) ─────────────────────────────────────
    p('logs-clear-btn').addEventListener('click',()=>{LOG.length=0;refreshLogsUI();updateLogBadge();});
    p('logs-copy-all-btn').addEventListener('click',()=>{if(!LOG.length)return;const text=LOG.map(l=>`[${l.level.toUpperCase()}][${l.source}] ${l.msg}  (${l.time})`).join('\n');navigator.clipboard.writeText(text).then(()=>{const btn=p('logs-copy-all-btn');btn.textContent='✓ Copied!';setTimeout(()=>(btn.textContent='📋 Copy All'),1800);});});
    p('logs-ai-btn').addEventListener('click',async()=>{
      if(!LOG.length)return;
      document.querySelector('[data-tab="chat"]').click();
      const top=LOG.slice(0,8).map(l=>`[${l.level.toUpperCase()}][${l.source}] ${l.msg}`).join('\n');
      addMsg('Analyse these logs:\n\n'+top,'user');
      thinking=true;p('kp-thinking').classList.add('show');p('kp-send').disabled=true;
      try{addMsg(await callAI('Analyse these system logs for errors:\n\n'+top,true),'ai');}catch(e){addMsg('Error: '+e,'err');}
      p('kp-thinking').classList.remove('show');p('kp-send').disabled=false;thinking=false;
    });

    // ── Settings Save ────────────────────────────────────────────────────
    p('kp-save-btn').addEventListener('click',async()=>{
      ['groqApiKey:kp-groq-key','mondayToken:kp-monday-token','githubToken:kp-gh-token','ghRepo:kp-gh-repo'].forEach(pair=>{const[k,id]=pair.split(':');const v=p(id)?.value.trim();if(v)storageSet(k,v);});
      // Owner ID
      const oid=p('kp-owner-id')?.value.trim();if(oid){MY_MONDAY_USER_ID=oid;storageSet('mondayOwnerId',oid);}
      // User Name
      const un=p('kp-user-name')?.value.trim();if(un){USER_NAME=un;storageSet('userName',un);}
      // Monday Board IDs (allow clearing back to auto-detect)
      const tid=p('kp-tasks-board-id')?.value.trim();storageSet('mondayTasksBoardId',tid||'');
      const bid=p('kp-bugs-board-id')?.value.trim();storageSet('mondayBugsBoardId',bid||'');
      // Theme
      const isLight=p('kp-theme-toggle')?.checked;const theme=isLight?'light':'dark';
      storageSet('theme',theme);applyTheme(theme);
      if(p('kp-theme-label'))p('kp-theme-label').textContent=isLight?'LIGHT':'DARK';
      // PIN — only update if both fields filled; must match
      const pin=p('kp-config-pin')?.value||'';const pinCfm=p('kp-config-pin-confirm')?.value||'';
      if(pin&&pinCfm&&pin===pinCfm){
        const h=await sha256(pin);storageSet('configPinHash',h);
        configUnlocked=true;
        if(p('kp-config-pin'))p('kp-config-pin').value='';
        if(p('kp-config-pin-confirm'))p('kp-config-pin-confirm').value='';
        if(p('kp-pin-status'))p('kp-pin-status').textContent='✅ PIN saved';
        if(p('kp-remove-pin-btn'))p('kp-remove-pin-btn').style.display='inline-flex';
      }else if(pin&&(!pinCfm||pin!==pinCfm)){
        alert('PINs do not match — PIN was NOT saved.');return;
      }
      log('success','Settings saved','Settings');addMsg('✅ Settings saved!','sys');
      document.querySelector('[data-tab="chat"]').click();
    });

    // Theme live preview
    p('kp-theme-toggle')?.addEventListener('change',e=>{
      const isLight=e.target.checked,theme=isLight?'light':'dark';
      applyTheme(theme);storageSet('theme',theme);
      if(p('kp-theme-label'))p('kp-theme-label').textContent=isLight?'LIGHT':'DARK';
    });

    // ── Settings Test ────────────────────────────────────────────────────
    p('kp-test-btn').addEventListener('click',async()=>{
      const st=p('kp-conn-status');st.style.display='block';st.className='kp-status-ok';st.innerHTML='<div>Testing…</div>';
      const results=[];
      try{await callGroq('Reply: OK');results.push('✅ Groq AI');}catch(e){results.push('❌ Groq: '+String(e).substring(0,40));}
      try{const b=await mondayGetBoards();results.push('✅ Monday: '+b.length+' boards');}catch(e){results.push('❌ Monday: '+String(e).substring(0,35));}
      try{const u=await ghGetUser();results.push('✅ GitHub: @'+u.login);}catch(e){results.push('❌ GitHub: '+String(e).substring(0,35));}
      const ctx=await detectSessionAsync();
      results.push(ctx.sessionId?`✅ SF: ${ctx.userName||ctx.userId||'detected'} (${ctx.source||'?'})`:'❌ SF: No session');
      st.innerHTML=results.map(r=>`<div>${r}</div>`).join('');
      st.className=results.every(r=>r.startsWith('✅'))?'kp-status-ok':'kp-status-err';
    });

    // ── Monday chat handlers ─────────────────────────────────────────────
    async function handleMondayQuestion(msg){
      const lower=msg.toLowerCase();
      if(!storageGet('mondayToken',''))return false;
      if(lower.includes('create task')||lower.includes('add task'))return await handleCreateTask(msg);
      if(lower.includes('mark')&&(lower.includes('done')||lower.includes('complete')))return await handleMarkTaskStatus(msg,'done','Done');
      if(lower.includes('mark')&&lower.includes('in progress'))return await handleMarkTaskStatus(msg,'in progress','Working on it');
      if((lower.includes('pending')||lower.includes('open'))&&lower.includes('bug'))return await handlePendingBugs();
      if(lower.includes('overdue'))return await handleOverdueTasks();
      if(lower.includes('summary')||lower.includes('overview'))return await handleTaskSummary();
      const isTaskQ=lower.includes('task')||lower.includes('my work')||lower.includes('what do i have');
      const isBugQ=lower.includes('bug');
      if(!isTaskQ&&!isBugQ)return false;
      const type=isBugQ?'bugs':'tasks';
      const groupMatch=msg.match(/from\s+(?:the\s+)?([a-z\s]+?)\s+group/i);
      const groupName=groupMatch?groupMatch[1].trim():null;
      updateThinkingLabel(`Fetching Monday ${type} for ${USER_NAME} today${groupName?' from '+groupName:''}…`);
      try{const result=await fetchMondayTasksForChat(type,groupName);if(!result)return false;const _boardId=mondayBoardMap[type];const items=result.items.map(item=>({name:item.name,status:getItemStatus(item),due:item.column_values?.find(c=>c.id===mondayColConfig.dateColId)?.date||'',url:`https://thinqloud-squad.monday.com/boards/${_boardId}/pulses/${item.id}`}));addMondayListMsg(isBugQ?`🐛 My Bugs Today (${result.boardName})`:`📋 My Tasks Today (${result.boardName})${groupName?' - '+groupName:''}`,items);return true;}
      catch(e){log('error','Chat Monday fetch: '+e,'Monday');return false;}
    }

    async function handleCreateTask(msg){
      updateThinkingLabel('Creating new task…');
      try{
        const match=msg.match(/(?:create|add)\s+task\s+(.+)/i);
        if(!match){addMsg('❌ Please specify a task name. Example: "create task Review PR #123"','err');return true;}
        const taskName=match[1].trim();
        if(!mondayBoardMap.tasks){const all=await mondayGetBoards();mondayBoards=all;mapBoardsByName(all);}
        const boardId=mondayBoardMap.tasks;if(!boardId){addMsg('❌ Tasks board not found','err');return true;}
        if(mondayBoardId!==boardId||!mondayColConfig.ownerColId){mondayBoardId=boardId;mondayAllColumns=await mondayGetColumns(boardId);autoDetectMondayColumns();}
        const query=`mutation{create_item(board_id:${boardId},item_name:"${taskName.replace(/"/g,'\\"')}",column_values:"{\\"${mondayColConfig.ownerColId}\\":\\"${MY_MONDAY_USER_ID}\\"}"){id name}}`;
        const result=await mondayGQL(query);
        if(result.create_item){addMsg(`✅ Task created: **${result.create_item.name}**`,'ai');log('info','Created task: '+result.create_item.name,'Monday');}
        else addMsg('❌ Failed to create task','err');
        return true;
      }catch(e){log('error','Create task: '+e,'Monday');addMsg('❌ Error creating task: '+e,'err');return true;}
    }

    async function handleMarkTaskStatus(msg,statusKey,statusLabel){
      updateThinkingLabel(`Updating status to ${statusLabel}…`);
      try{
        const match=msg.match(/mark\s+(.+?)\s+as\s+(?:done|complete|in progress)/i);
        if(!match){addMsg('Please specify a task name.','err');return true;}
        const taskName=match[1].trim();
        if(!mondayBoardMap.tasks){const all=await mondayGetBoards();mondayBoards=all;mapBoardsByName(all);}
        const boardId=mondayBoardMap.tasks;if(!boardId){addMsg('Tasks board not found','err');return true;}
        const d=await mondayGQL(`{boards(ids:[${boardId}]){items_page(limit:500){items{id name state}}}}`);
        const allItems=d.boards?.[0]?.items_page?.items||[];
        const task=allItems.find(i=>i.state==='active'&&i.name.toLowerCase().includes(taskName.toLowerCase()));
        if(!task){addMsg(`Task not found: "${taskName}"`, 'err');return true;}
        const statusCol=mondayAllColumns.find(c=>c.type==='color'||c.type==='status');
        if(!statusCol){addMsg('Status column not found','err');return true;}
        const labels=JSON.parse(statusCol.settings_str||'{}').labels||{};
        let statusIndex=null;
        for(const[idx,label] of Object.entries(labels)){if(label.toLowerCase().includes(statusKey)||label.toLowerCase()===statusLabel.toLowerCase()){statusIndex=idx;break;}}
        if(statusIndex===null){addMsg(`Status "${statusLabel}" not found in board`,'err');return true;}
        await mondayGQL(`mutation{change_column_value(board_id:${boardId},item_id:${task.id},column_id:"${statusCol.id}",value:"${JSON.stringify({index:parseInt(statusIndex,10)}).replace(/"/g,'\\"')}"){id}}`);
        addMsg(`✅ **${task.name}** marked as **${statusLabel}**`,'ai');
        return true;
      }catch(e){log('error','Mark task: '+e,'Monday');addMsg('Error updating task: '+e,'err');return true;}
    }

    // async function handlePendingBugs(){
    //   updateThinkingLabel('Fetching open bugs…');
    //   try{
    //     if(!mondayBoardMap.bugs){const all=await mondayGetBoards();mondayBoards=all;mapBoardsByName(all);}
    //     const boardId=mondayBoardMap.bugs;if(!boardId){addMsg('Bugs board not found','err');return true;}
    //     if(mondayBoardId!==boardId||!mondayColConfig.ownerColId){mondayBoardId=boardId;mondayAllColumns=await mondayGetColumns(boardId);autoDetectMondayColumns();}
    //     const FIELDS='id name state column_values{id text type value ... on StatusValue{label index} ... on DateValue{date} ... on PeopleValue{persons_and_teams{id kind}}}';
    //     const d=await mondayGQL(`{boards(ids:[${boardId}]){name items_page(limit:500){items{${FIELDS}}}}}`);
    //     const allItems=d.boards?.[0]?.items_page?.items||[];
    //     const items=allItems.filter(item=>{if(item.state&&item.state!=='active')return false;const oc=item.column_values?.find(c=>c.id===mondayColConfig.ownerColId);if(!oc)return false;const ids=parsePersonNames(oc);if(ids.length>0)return ids.includes(MY_MONDAY_USER_ID);return oc.text&&(oc.text.toLowerCase().includes(USER_NAME.toLowerCase()));});
    //     const openItems=items.filter(item=>{const s=getItemStatus(item).toLowerCase();return!s.includes('done')&&!s.includes('deployed')&&!s.includes('closed');});
    //     const board=mondayBoards.find(b=>b.id===boardId);
    //     addMondayListMsg(`🐛 My Open Bugs (${board?.name||'KMTSL Bugs Queue'}) — ${openItems.length} open`,openItems.map(item=>({name:item.name,status:getItemStatus(item),due:item.column_values?.find(c=>c.id===mondayColConfig.dateColId)?.date||''})));
    //     return true;
    //   }catch(e){log('error','Pending bugs: '+e,'Monday');addMsg('Error fetching bugs: '+e,'err');return true;}
    // }

    async function handlePendingBugs(){
  updateThinkingLabel('Fetching open bugs…');
  try{
    if(!mondayBoardMap.bugs){const all=await mondayGetBoards();mondayBoards=all;mapBoardsByName(all);}
    const boardId=mondayBoardMap.bugs;if(!boardId){addMsg('Bugs board not found','err');return true;}
    if(mondayBoardId!==boardId||!mondayColConfig.ownerColId){mondayBoardId=boardId;mondayAllColumns=await mondayGetColumns(boardId);autoDetectMondayColumns();}

    // ✅ Same open indexes as working version
    const OPEN_STATUS_INDEXES=[0,2,5,6,10];

    const FIELDS='id name state column_values{id text type value ... on StatusValue{label index} ... on DateValue{date} ... on PeopleValue{persons_and_teams{id kind}}}';

    // ✅ Push BOTH filters to the API — same as working version
    const queryStr='{boards(ids:['+boardId+']){name items_page(limit:500,query_params:{'+
      'rules:['+
        '{column_id:"'+mondayColConfig.ownerColId+'",compare_value:["'+USER_NAME+'"],operator:contains_text},'+
        '{column_id:"bug_status",compare_value:['+OPEN_STATUS_INDEXES.join(',')+'],operator:any_of}'+
      '],operator:and}){items{'+FIELDS+'}}}}';

    const d=await mondayGQL(queryStr);

    // ✅ Only filter out non-active states — API already handled owner + status
    const items=(d.boards?.[0]?.items_page?.items||[])
      .filter(item=>item.state==='active'||!item.state);

    const board=mondayBoards.find(b=>b.id===boardId);
    addMondayListMsg(`🐛 My Open Bugs (${board?.name||'KMTSL Bugs Queue'}) — ${items.length} open`,
      items.map(item=>({
        name:item.name,
        status:getItemStatus(item),
        due:item.column_values?.find(c=>c.id===mondayColConfig.dateColId)?.date||'',
        url:`https://thinqloud-squad.monday.com/boards/${boardId}/pulses/${item.id}`
      })));
    return true;
  }catch(e){log('error','Pending bugs: '+e,'Monday');addMsg('Error fetching bugs: '+e,'err');return true;}
}


    async function handleOverdueTasks(){
      updateThinkingLabel('Fetching overdue tasks…');
      try{
        if(!mondayBoardMap.tasks){const all=await mondayGetBoards();mondayBoards=all;mapBoardsByName(all);}
        const boardId=mondayBoardMap.tasks;if(!boardId){addMsg('Tasks board not found','err');return true;}
        if(mondayBoardId!==boardId||!mondayColConfig.ownerColId){mondayBoardId=boardId;mondayAllColumns=await mondayGetColumns(boardId);autoDetectMondayColumns();}
        if(!mondayColConfig.dateColId){addMsg('Date column not configured.','err');return true;}
        const todayStr=new Date().toISOString().split('T')[0];
        const FIELDS='id name state column_values{id text type value ... on StatusValue{label index} ... on DateValue{date} ... on PeopleValue{persons_and_teams{id kind}}}';
        const d=await mondayGQL(`{boards(ids:[${boardId}]){name items_page(limit:500){items{${FIELDS}}}}}`);
        const allItems=d.boards?.[0]?.items_page?.items||[];
        const items=allItems.filter(item=>{if(item.state&&item.state!=='active')return false;const oc=item.column_values?.find(c=>c.id===mondayColConfig.ownerColId);if(!oc)return false;const ids=parsePersonNames(oc);const mine=ids.length>0?ids.includes(MY_MONDAY_USER_ID):(oc.text&&(oc.text.toLowerCase().includes(USER_NAME.toLowerCase())));if(!mine)return false;const dc=item.column_values?.find(c=>c.id===mondayColConfig.dateColId);const due=dc?.date||dc?.text||'';const s=getItemStatus(item).toLowerCase();return due&&due<todayStr&&!s.includes('done')&&!s.includes('deployed');});
        const board=mondayBoards.find(b=>b.id===boardId);
        addMondayListMsg(`⚠️ My Overdue Tasks (${board?.name||'KMTSL Tasks'}) — ${items.length} overdue`,items.map(item=>({name:item.name,status:getItemStatus(item),due:item.column_values?.find(c=>c.id===mondayColConfig.dateColId)?.date||'',url:`https://thinqloud-squad.monday.com/boards/${boardId}/pulses/${item.id}`})));
        return true;
      }catch(e){log('error','Overdue tasks: '+e,'Monday');addMsg('Error: '+e,'err');return true;}
    }

    async function handleTaskSummary(){
      updateThinkingLabel('Generating summary…');
      try{
        if(!mondayBoardMap.tasks){const all=await mondayGetBoards();mondayBoards=all;mapBoardsByName(all);}
        const boardId=mondayBoardMap.tasks;if(!boardId){addMsg('Tasks board not found','err');return true;}
        if(mondayBoardId!==boardId||!mondayColConfig.ownerColId){mondayBoardId=boardId;mondayAllColumns=await mondayGetColumns(boardId);autoDetectMondayColumns();}
        const FIELDS='id name state column_values{id text type value ... on StatusValue{label index} ... on DateValue{date} ... on PeopleValue{persons_and_teams{id kind}}}';
        const d=await mondayGQL(`{boards(ids:[${boardId}]){name items_page(limit:500){items{${FIELDS}}}}}`);
        const allItems=d.boards?.[0]?.items_page?.items||[],today=new Date().toISOString().split('T')[0];
        const myItems=allItems.filter(item=>{if(item.state&&item.state!=='active')return false;const oc=item.column_values?.find(c=>c.id===mondayColConfig.ownerColId);if(!oc)return false;const ids=parsePersonNames(oc);return ids.length>0?ids.includes(MY_MONDAY_USER_ID):(oc.text&&(oc.text.toLowerCase().includes(USER_NAME.toLowerCase())));});
        const summary={total:myItems.length,done:0,inProgress:0,pending:0,overdue:0};
        myItems.forEach(item=>{const s=getItemStatus(item).toLowerCase();if(s.includes('done')||s.includes('complete'))summary.done++;else if(s.includes('working')||s.includes('progress'))summary.inProgress++;else summary.pending++;const dc=item.column_values?.find(c=>c.id===mondayColConfig.dateColId);if(dc?.date&&dc.date<today&&!s.includes('done'))summary.overdue++;});
        const board=mondayBoards.find(b=>b.id===boardId);
        addMsg(`📊 **Task Summary** (${board?.name||'KMTSL Tasks'})\n\n**Total:** ${summary.total}\n✅ **Done:** ${summary.done}\n🔄 **In Progress:** ${summary.inProgress}\n⏳ **Pending:** ${summary.pending}\n⚠️ **Overdue:** ${summary.overdue}`,'ai');
        return true;
      }catch(e){log('error','Task summary: '+e,'Monday');addMsg('Error: '+e,'err');return true;}
    }
  } // end wireEvents

  // ══════════════════════════════════════════════════════════════════════════
  //  HELPERS + INIT
  // ══════════════════════════════════════════════════════════════════════════
  function applyTheme(theme){const panel=document.getElementById('spa-panel');if(!panel)return;panel.classList.remove('spa-theme-dark','spa-theme-light');panel.classList.add('spa-theme-'+(theme||'dark'));}
  function togglePanel(){const panel=document.getElementById('spa-panel');panel.classList.toggle('kp-hidden');if(!panel.classList.contains('kp-hidden'))refreshOrgBar();}

  async function refreshOrgBar(){
    const ctx=await detectSessionAsync();
    const dbg=document.getElementById('kp-sess-debug');if(!dbg)return;
    const sidSnip=ctx.sessionId?ctx.sessionId.substring(0,20)+'… (len:'+ctx.sessionId.length+')':'NOT FOUND';
    dbg.textContent=JSON.stringify({source:ctx.source||'none',session_preview:sidSnip,org:ctx.orgId||'—',sfUser:ctx.userName||'—',sfEnabled:sfConsentGiven,mondayInnerTab:mondayActiveInnerTab,mondayBoardId:mondayBoardId||'—',mondayOwnerId:MY_MONDAY_USER_ID},null,2);
  }

  function refreshLogsUI(){
    const list=document.getElementById('kp-log-list');if(!list)return;
    if(!LOG.length){list.innerHTML='<div class="mn-empty">No logs yet.</div>';return;}
    list.innerHTML=LOG.map((l,i)=>`<div class="kp-logitem"><div style="display:flex;align-items:flex-start;gap:5px"><div style="flex:1"><div class="kp-logmsg kp-log-${l.level}">[${l.level.toUpperCase()}][${escH(l.source)}] ${escH(l.msg.substring(0,200))}${l.msg.length>200?'…':''}</div><div class="kp-logmeta">${l.time}</div></div><button class="kp-log-copy-btn kp-btn" data-idx="${i}" style="flex-shrink:0;padding:1px 6px;font-size:10px">⧉</button></div></div>`).join('');
    list.querySelectorAll('.kp-log-copy-btn').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();const l=LOG[+btn.dataset.idx];if(!l)return;navigator.clipboard.writeText(`[${l.level.toUpperCase()}][${l.source}] ${l.msg}  (${l.time})`).then(()=>{btn.textContent='✓';setTimeout(()=>(btn.textContent='⧉'),1400);});});});
  }

  function updateLogBadge(){const badge=document.getElementById('kp-log-count'),fab=document.getElementById('spa-fab-badge');const errs=LOG.filter(l=>l.level==='error').length;if(badge)badge.textContent=LOG.length;if(fab){fab.textContent=errs||'';fab.style.display=errs?'block':'none';}}

  function loadSettingsValues(){
    const p=id=>document.getElementById(id);
    if(p('kp-groq-key'))p('kp-groq-key').value=storageGet('groqApiKey','');
    if(p('kp-monday-token'))p('kp-monday-token').value=storageGet('mondayToken','');
    if(p('kp-gh-token'))p('kp-gh-token').value=storageGet('githubToken','');
    if(p('kp-gh-repo'))p('kp-gh-repo').value=storageGet('ghRepo','');
    if(p('kp-owner-id'))p('kp-owner-id').value=storageGet('mondayOwnerId',MY_MONDAY_USER_ID);
    // New dynamic fields
    if(p('kp-user-name'))p('kp-user-name').value=storageGet('userName',USER_NAME==='You'?'':USER_NAME);
    if(p('kp-tasks-board-id'))p('kp-tasks-board-id').value=storageGet('mondayTasksBoardId','');
    if(p('kp-bugs-board-id'))p('kp-bugs-board-id').value=storageGet('mondayBugsBoardId','');
    // PIN status
    const hasPIN=!!storageGet('configPinHash','');
    if(p('kp-pin-status'))p('kp-pin-status').textContent=hasPIN?'🔒 PIN is set':'No PIN set';
    if(p('kp-remove-pin-btn')){
      p('kp-remove-pin-btn').style.display=hasPIN?'inline-flex':'none';
      p('kp-remove-pin-btn').onclick=()=>{
        if(!confirm('Remove the config PIN? Anyone with browser access can view settings.'))return;
        storageSet('configPinHash','');configUnlocked=true;
        p('kp-remove-pin-btn').style.display='none';
        if(p('kp-pin-status'))p('kp-pin-status').textContent='No PIN set';
        log('info','Config PIN removed','Settings');
      };
    }
    const savedTheme=storageGet('theme','dark');
    if(p('kp-theme-toggle'))p('kp-theme-toggle').checked=savedTheme==='light';
    if(p('kp-theme-label'))p('kp-theme-label').textContent=savedTheme==='light'?'LIGHT':'DARK';
    refreshOrgBar();
  }

  function init(){
    log('info','Smart Assistant v9 starting…','Init');
    buildUI();
    wireEvents();
    setTimeout(async()=>{
      const savedTheme=storageGet('theme','dark');
      applyTheme(savedTheme);
      const savedOwnerId=storageGet('mondayOwnerId','');
      if(savedOwnerId)MY_MONDAY_USER_ID=savedOwnerId;
      const savedUserName=storageGet('userName','');
      if(savedUserName)USER_NAME=savedUserName;
      sfConsentGiven=storageGet('sfEnabled',false);
      const sfTog=document.getElementById('kp-sf-toggle');
      if(sfTog)sfTog.checked=sfConsentGiven;
      const ctx=await detectSessionAsync();
      if(ctx.sessionId)log('success','Session: '+(ctx.userName||ctx.source||'found'),'Session');
      else{log('warn','Session not ready — retrying…','Session');retrySessionDetection(5);}
      await refreshOrgBar();
      if(!storageGet('groqApiKey',''))log('warn','Groq key not set — free at console.groq.com','AI');
      if(!storageGet('githubToken',''))log('warn','GitHub token not set','GitHub');
      if(storageGet('mondayToken','')){
        log('info','Auto-loading Monday boards…','Monday');
        try{await loadMondayBoards();log('success','Monday ready for '+USER_NAME,'Monday');}
        catch(e){log('error','Auto board load: '+e,'Monday');}
      }else{log('warn','Monday token not set — add in ⚙️ Setup','Monday');const b=document.getElementById('mn-body');if(b)b.innerHTML='<div class="mn-empty">Add Monday token in ⚙️ Setup → boards will auto-load.</div>';}
      log('success','Panel ready. Click ✦ bottom-right.','Init');
    },300);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else setTimeout(init,500);
})();