/**
 * Smart Productivity Assistant — Background Service Worker
 *
 * Uses chrome.cookies API to read the Salesforce session cookie at the
 * browser level — this bypasses HttpOnly restrictions that block JS in
 * content scripts. This is exactly how Salesforce Inspector / SF Inspector
 * Reloaded acquires the session token reliably.
 *
 * Message protocol (content.js → background.js → content.js):
 *   Request:  { type: 'GET_SF_SESSION', sfHost: 'org.lightning.force.com' }
 *   Response: { sessionId, orgId, userName, userId, sfHost, source } | { error }
 */

'use strict';

// ── Cookie name candidates Salesforce uses across prod / sandbox / scratch orgs
const SF_COOKIE_NAMES = ['sid', '__Host-PREV_sid', '__Secure-sid'];

// ── Cookie domain patterns to probe (most-specific first)
function buildCookieDomains(sfHost) {
    const domains = [sfHost];

    // e.g. org--dev.sandbox.lightning.force.com → also try .force.com, .salesforce.com
    if (sfHost.endsWith('.lightning.force.com')) {
        const sub = sfHost.replace(/\.lightning\.force\.com$/, '');
        domains.push(`${sub}.my.salesforce.com`);
        domains.push(sfHost); // already added, but explicit
    }
    if (sfHost.endsWith('.sandbox.lightning.force.com')) {
        const sub = sfHost.replace(/\.sandbox\.lightning\.force\.com$/, '');
        domains.push(`${sub}.sandbox.my.salesforce.com`);
        domains.push(`${sub}.my.salesforce.com`);
    }

    // Generic fallbacks
    domains.push('.salesforce.com');
    domains.push('.force.com');
    domains.push('');  // chrome.cookies.get with url= only, no domain filter

    // Dedupe
    return [...new Set(domains)];
}

/**
 * Try to find the Salesforce session cookie using chrome.cookies.
 * Returns { name, value } or null.
 */
async function findSFCookie(sfHost) {
    const protocol = 'https://';
    const url = protocol + sfHost + '/';

    // 1. Try chrome.cookies.get() for each known cookie name on the exact host URL
    for (const name of SF_COOKIE_NAMES) {
        try {
            const cookie = await chrome.cookies.get({ url, name });
            if (cookie && cookie.value) {
                return { name: cookie.name, value: cookie.value };
            }
        } catch (e) { /* ignore */ }
    }

    // Helper: a valid SF Bearer token contains '!' (e.g. 00D...!AQA...) and is long
    const isValidBearerToken = (v) => v && v.includes('!') && v.length > 50;

    // 2. Try getAll() on the full URL — catches any variant names, filter for real tokens
    try {
        const all = await chrome.cookies.getAll({ url });
        // First pass: prefer cookies that look like real Bearer tokens (contain '!')
        for (const c of all) {
            if ((SF_COOKIE_NAMES.includes(c.name) || c.name.endsWith('_sid') || c.name === 'sid') && isValidBearerToken(c.value)) {
                return { name: c.name, value: c.value };
            }
        }
        // Second pass: accept any sid-like cookie (may not have '!' on some orgs)
        for (const c of all) {
            if (SF_COOKIE_NAMES.includes(c.name) || c.name.endsWith('_sid') || c.name === 'sid') {
                return { name: c.name, value: c.value };
            }
        }
    } catch (e) { /* ignore */ }

    // 3. Try alternate domains derived from the host
    const domains = buildCookieDomains(sfHost);
    for (const domain of domains) {
        if (!domain) continue;
        for (const name of SF_COOKIE_NAMES) {
            try {
                const cookie = await chrome.cookies.get({
                    url: protocol + domain + '/',
                    name
                });
                if (cookie && cookie.value) return { name: cookie.name, value: cookie.value };
            } catch (e) { /* ignore */ }
        }
        // Also try getAll on each domain — prefer tokens with '!'
        try {
            const all = await chrome.cookies.getAll({ domain });
            for (const c of all) {
                if ((c.name === 'sid' || c.name.endsWith('_sid')) && isValidBearerToken(c.value)) {
                    return { name: c.name, value: c.value };
                }
            }
            for (const c of all) {
                if (c.name === 'sid' || c.name.endsWith('_sid')) {
                    return { name: c.name, value: c.value };
                }
            }
        } catch (e) { /* ignore */ }
    }

    return null;
}

/**
 * Try to fetch /services/oauth2/userinfo with the session token to get
 * userName, userId, orgId — same approach Salesforce Inspector uses.
 */
async function fetchUserInfo(sfHost, sessionId) {
    try {
        const resp = await fetch(`https://${sfHost}/services/oauth2/userinfo`, {
            headers: { 'Authorization': 'Bearer ' + sessionId }
        });
        if (resp.ok) {
            const d = await resp.json();
            return {
                userName: d.preferred_username || d.name || '',
                userId:   d.user_id || '',
                orgId:    d.organization_id || ''
            };
        }
    } catch (e) { /* ignore */ }
    return {};
}
// background.js
const SF_DOMAINS = [
  ".my.salesforce.com",
  ".salesforce.com",
  ".force.com",
  ".cloudforce.com",
  ".salesforce-sites.com",
  ".my.salesforce.mil",
  ".crmforce.mil"
];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── SF_SOAP: proxy Metadata SOAP API calls through background ──────────
  // Content scripts can't receive SOAP responses (no CORS headers on /Soap/m/).
  // Background service workers are not subject to CORS restrictions.
  if (message.type === 'SF_SOAP') {
    (async () => {
      try {
        const resp = await fetch(message.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=UTF-8',
            'SOAPAction': '""'
          },
          body: message.body
        });
        const text = await resp.text();
        sendResponse({ ok: resp.ok, status: resp.status, text });
      } catch(e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // keep message channel open for async
  }

  if (message.type !== "GET_SF_SESSION") return;

  (async () => {
    const sfHost = message.sfHost; // e.g. "myorg.lightning.force.com"

    // ── STEP 1: Normalize hostname (lightning → my.salesforce) ──────────
    const normalizedHost = sfHost
      .replace(/\.lightning\.force\.com$/, ".my.salesforce.com")
      .replace(/\.force\.com\.mcas\.ms$/, ".force.com");

    // ── STEP 2: Try the normalized host directly first ──────────────────
    for (const cookieName of ["sid", "__Host-PREV_sid"]) {
      const cookie = await chrome.cookies.get({
        url: "https://" + normalizedHost,
        name: cookieName
      }).catch(() => null);

      if (cookie && cookie.value && cookie.value.includes("!")) {
        sendResponse({
          sessionId: cookie.value,
          cookieName,
          sfHost: normalizedHost
        });
        return;
      }
    }

    // ── STEP 3: Search all SF domains by org-ID prefix matching ─────────
    // Get ALL salesforce cookies and find one with orgId prefix
    for (const domain of SF_DOMAINS) {
      const cookies = await chrome.cookies.getAll({ domain }).catch(() => []);
      const sidCookie = cookies.find(
        c => (c.name === "sid" || c.name.endsWith("_sid")) && c.value.includes("!")
      );
      if (sidCookie) {
        sendResponse({
          sessionId: sidCookie.value,
          cookieName: sidCookie.name,
          sfHost: normalizedHost
        });
        return;
      }
    }

    sendResponse(null);
  })();

  return true; // keep channel open for async
});

// ── On install / startup: log that the service worker is alive ────────────────
chrome.runtime.onInstalled.addListener(() => {
    console.log('[SPA Background] Service worker installed. chrome.cookies ready.');
});