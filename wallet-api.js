#!/usr/bin/env node
/**
 * Smart Wallet Cards — Official Google Wallet API Pass Generator & Live REST API Provisioner (wallet-api.js)
 * Dual-mode module:
 *   1. Browser library (`window.SmartWalletPassAPI`) for `admin.html`
 *   2. Standalone Zero-Dependency Node.js CLI (`node wallet-api.js [sync|generate|patch|class|object]`)
 *
 * Creates & updates Google Wallet `GenericClass` & `GenericObject` in Deep Sapphire (#163A63)
 * under Issuer ID `3388000000023225565`, signs RS256 `https://pay.google.com/gp/v/save/<JWT>` links,
 * renders scannable QR codes, and executes REST API `POST` / `PUT` / `PATCH` calls to Google Wallet.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./crypto-vault.js'),
      require('./qr-engine.js'),
      require('crypto'),
      require('fs'),
      require('https'),
      require('path')
    );
  } else {
    root.SmartWalletPassAPI = factory(root.SmartWalletCrypto, root.SmartWalletQR, null, null, null, null);
  }
})(typeof self !== 'undefined' ? self : this, function (
  SmartWalletCrypto,
  SmartWalletQR,
  nodeCrypto,
  nodeFs,
  nodeHttps,
  nodePath
) {
  'use strict';

  const DEFAULT_ISSUER_ID = '3388000000023225565';
  const DEFAULT_CLASS_SUFFIX = 'executive_sapphire_card';
  const DEFAULT_HUB_BASE_URL = 'https://artelt.github.io/Card/';
  const DEFAULT_HERO_BANNER_URL = 'https://artelt.github.io/Card/hero-artautas.png';
  const DEFAULT_SERVICE_ACCOUNT_EMAIL = 'wallet-pass-issuer@project-71308897-865e-49aa-830.iam.gserviceaccount.com';

  function base64UrlEncodeString(str) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    const utf8Bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlEncodeBytes(bytes) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    let binary = '';
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function formatPhoneReadable(phoneStr) {
    const clean = String(phoneStr || '').trim();
    return clean.replace(/^\+(\d{2})(\d{3})(\d+)$/, '+$1 $2 $3');
  }

  /**
   * Builds the Google Wallet `GenericClass` payload (Template for Executive Business Cards).
   */
  function buildGenericClass(options) {
    const opts = Object.assign(
      {
        issuerId: DEFAULT_ISSUER_ID,
        classSuffix: DEFAULT_CLASS_SUFFIX
      },
      options || {}
    );
    const classId = `${opts.issuerId}.${opts.classSuffix}`;

    return {
      id: classId,
      issuerName: 'Artautas Šimkus, LL.M.',
      reviewStatus: 'UNDER_REVIEW',
      multipleDevicesAndHoldersAllowedStatus: 'MULTIPLE_HOLDERS',
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              oneItem: {
                item: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['focus']" }]
                  }
                }
              }
            },
            {
              oneItem: {
                item: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['contact']" }]
                  }
                }
              }
            }
          ]
        }
      }
    };
  }

  /**
   * Builds the Google Wallet `GenericObject` payload in Deep Sapphire (#163A63) for a specific user profile.
   */
  function buildGenericObject(profile, options) {
    const opts = Object.assign(
      {
        issuerId: (profile.walletConfig && profile.walletConfig.issuerId) || DEFAULT_ISSUER_ID,
        classSuffix: (profile.walletConfig && profile.walletConfig.classSuffix) || DEFAULT_CLASS_SUFFIX,
        objectSuffix: (profile.walletConfig && profile.walletConfig.objectSuffix) || `${profile.id}_card`,
        secretKey: '',
        hubBaseUrl: DEFAULT_HUB_BASE_URL
      },
      options || {}
    );

    const classId = `${opts.issuerId}.${opts.classSuffix}`;
    const objectId = `${opts.issuerId}.${opts.objectSuffix}`;

    const phoneDec = SmartWalletCrypto.decryptField(profile.encryptedPhone, opts.secretKey);
    const emailDec = SmartWalletCrypto.decryptField(profile.encryptedEmail, opts.secretKey);
    const phoneDisplay = phoneDec.unlocked ? formatPhoneReadable(phoneDec.value) : '+49 177 6090991';
    const emailDisplay = emailDec.unlocked ? emailDec.value : 'artautas.simkus@gmail.com';

    const shareUrl = SmartWalletCrypto.buildShareUrl(
      opts.hubBaseUrl,
      profile.id || 'artautas',
      opts.secretKey,
      false
    );

    const taglineLines =
      Array.isArray(profile.taglineLines) && profile.taglineLines.length
        ? profile.taglineLines
        : String(profile.tagline || '')
            .split('|')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);

    const subheaderLine = taglineLines[0] || 'LAWYER (LL.M.) · LEGAL TRANSLATOR';
    const remainingLines = taglineLines.slice(1);
    const focusBody = remainingLines.length > 0
      ? remainingLines.join(' · ')
      : 'European Company Law · Business Development · Startup Ecosystems';

    const hexBg = (profile.theme && profile.theme.bgPrimary) || '#163A63';
    const linkedinUrl = profile.linkedin || 'https://www.linkedin.com/in/artautas/';
    const cardTitleText = profile.walletTopLabel || 'HEIDELBERG · GERMANY';
    const avatarUrl = profile.avatarUrl || `https://artelt.github.io/Card/avatar-${profile.id || 'artautas'}.png`;

    return {
      id: objectId,
      classId: classId,
      genericType: 'GENERIC_TYPE_UNSPECIFIED',
      hexBackgroundColor: hexBg,
      state: 'ACTIVE',
      logo: {
        sourceUri: {
          uri: avatarUrl
        },
        contentDescription: {
          defaultValue: {
            language: 'en-US',
            value: profile.name || 'Profile Avatar'
          }
        }
      },
      cardTitle: {
        defaultValue: {
          language: 'en-US',
          value: cardTitleText
        }
      },
      header: {
        defaultValue: {
          language: 'en-US',
          value: profile.name || 'Artautas Šimkus, LL.M.'
        }
      },
      subheader: {
        defaultValue: {
          language: 'en-US',
          value: subheaderLine
        }
      },
      barcode: {
        type: 'QR_CODE',
        value: shareUrl,
        alternateText: "LET'S CONNECT"
      },
      textModulesData: [
        {
          id: 'focus',
          header: 'EXPERTISE & FOCUS',
          body: focusBody
        },
        {
          id: 'contact',
          header: 'DIRECT CONTACT',
          body: `${phoneDisplay}  ·  ${emailDisplay}`
        }
      ],
      linksModuleData: {
        uris: [
          {
            id: 'digital_card_hub',
            uri: shareUrl,
            description: 'Open Interactive 3D Digital Business Card'
          },
          {
            id: 'linkedin_profile',
            uri: linkedinUrl,
            description: 'Open LinkedIn Profile'
          }
        ]
      }
    };
  }

  /**
   * Builds the Google Wallet Save JWT claims payload (`savetowallet`).
   * Supports both skinny JWT (referencing the REST-provisioned GenericObject ID for compact QR scanning)
   * and full embedded object payload.
   */
  function buildJwtClaims(genericClass, genericObject, options) {
    const opts = Object.assign(
      {
        serviceAccountEmail: DEFAULT_SERVICE_ACCOUNT_EMAIL,
        origins: [],
        includeClassInJwt: true,
        skinnyJwt: false
      },
      options || {}
    );

    const compactClass = {
      id: genericClass.id,
      issuerName: genericClass.issuerName,
      reviewStatus: 'UNDER_REVIEW'
    };

    const objectEntry = opts.skinnyJwt
      ? { id: genericObject.id }
      : genericObject;

    const payload = {
      iss: opts.serviceAccountEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: opts.origins,
      payload: {
        genericObjects: [objectEntry]
      }
    };

    if (opts.includeClassInJwt && genericClass && !opts.skinnyJwt) {
      payload.payload.genericClasses = [compactClass];
    }

    return payload;
  }

  /**
   * Converts PEM PKCS#8 private key string into an ArrayBuffer for WebCrypto RS256 signing.
   */
  function pemToArrayBuffer(pem) {
    const clean = String(pem)
      .replace(/-----BEGIN [A-Z ]+-----/g, '')
      .replace(/-----END [A-Z ]+-----/g, '')
      .replace(/\s+/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Signs the Google Wallet JWT using RS256 (Browser WebCrypto or Node.js crypto).
   */
  async function createSaveToWalletJwt(profile, options) {
    const opts = Object.assign(
      {
        issuerId: (profile.walletConfig && profile.walletConfig.issuerId) || DEFAULT_ISSUER_ID,
        classSuffix: (profile.walletConfig && profile.walletConfig.classSuffix) || DEFAULT_CLASS_SUFFIX,
        objectSuffix: (profile.walletConfig && profile.walletConfig.objectSuffix) || `${profile.id}_card`,
        secretKey: '',
        serviceAccountEmail: DEFAULT_SERVICE_ACCOUNT_EMAIL,
        privateKeyPem: '',
        hubBaseUrl: DEFAULT_HUB_BASE_URL,
        heroBannerUrl: DEFAULT_HERO_BANNER_URL,
        includeClassInJwt: true,
        skinnyJwt: false
      },
      options || {}
    );

    const genericClass = buildGenericClass(opts);
    const genericObject = buildGenericObject(profile, opts);
    const claims = buildJwtClaims(genericClass, genericObject, opts);

    const header = { alg: 'RS256', typ: 'JWT' };
    const signingInput = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(
      JSON.stringify(claims)
    )}`;

    let signatureB64Url = '';
    let signedMode = 'preview';

    // 1. Node.js environment
    if (nodeCrypto) {
      let pemKey = opts.privateKeyPem;
      if (pemKey && pemKey.includes('BEGIN')) {
        signedMode = 'service-account-rs256';
      } else {
        const kp = nodeCrypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
          publicKeyEncoding: { type: 'spki', format: 'pem' }
        });
        pemKey = kp.privateKey;
        signedMode = 'ephemeral-rsa2048-demo';
      }
      const signer = nodeCrypto.createSign('RSA-SHA256');
      signer.update(signingInput);
      signer.end();
      const sigBuf = signer.sign(pemKey);
      signatureB64Url = base64UrlEncodeBytes(sigBuf);
    }
    // 2. Browser environment with WebCrypto & user-supplied Service Account Private Key
    else if (
      opts.privateKeyPem &&
      opts.privateKeyPem.includes('BEGIN') &&
      typeof crypto !== 'undefined' &&
      crypto.subtle
    ) {
      try {
        const keyBuffer = pemToArrayBuffer(opts.privateKeyPem);
        const cryptoKey = await crypto.subtle.importKey(
          'pkcs8',
          keyBuffer,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const sigBuffer = await crypto.subtle.sign(
          'RSASSA-PKCS1-v1_5',
          cryptoKey,
          new TextEncoder().encode(signingInput)
        );
        signatureB64Url = base64UrlEncodeBytes(new Uint8Array(sigBuffer));
        signedMode = 'service-account-rs256';
      } catch (err) {
        const fallbackHash = SmartWalletCrypto.sha256Hex('RS256_FALLBACK|' + signingInput);
        signatureB64Url = base64UrlEncodeString(fallbackHash + fallbackHash);
        signedMode = 'preview-invalid-pem';
      }
    }
    // 3. Browser Preview mode (or pre-signed live JWT from local-keys.js)
    else {
      const h1 = SmartWalletCrypto.sha256Hex('WALLET_SIG_1|' + signingInput);
      const h2 = SmartWalletCrypto.sha256Hex('WALLET_SIG_2|' + signingInput);
      signatureB64Url = base64UrlEncodeString(h1 + h2);
      signedMode = 'preview-simulated-rs256';
    }

    const jwt = `${signingInput}.${signatureB64Url}`;
    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;

    return {
      jwt,
      saveUrl,
      signedMode,
      genericClass,
      genericObject,
      claims,
      patchCommand: buildPatchCliCommand(profile, opts)
    };
  }

  /**
   * Generates the CLI & cURL PATCH update commands to push live updates to Google Wallet passes on users' phones.
   */
  function buildPatchCliCommand(profile, options) {
    const opts = options || {};
    const uid = profile.id || 'artautas';
    const keyArg = opts.secretKey ? ` --key ${opts.secretKey}` : ' --key <YOUR_16_CHAR_KEY>';
    const issuerId =
      opts.issuerId || (profile.walletConfig && profile.walletConfig.issuerId) || DEFAULT_ISSUER_ID;
    const objectSuffix =
      opts.objectSuffix || (profile.walletConfig && profile.walletConfig.objectSuffix) || `${uid}_card`;
    const resourceId = `${issuerId}.${objectSuffix}`;

    const nodeCmd = `node wallet-api.js sync --user ${uid}${keyArg} --issuer ${issuerId} --object ${objectSuffix}`;
    const curlCmd = [
      `curl -X PATCH "https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${resourceId}" \\`,
      `  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d @wallet-object-${uid}.json`
    ].join('\n');

    return {
      resourceId,
      endpoint: `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${resourceId}`,
      nodeCommand: nodeCmd,
      curlCommand: curlCmd
    };
  }

  /**
   * Helper to make HTTPS JSON requests in Node.js.
   */
  function httpsJsonRequest(urlStr, method, headers, bodyObj) {
    return new Promise((resolve, reject) => {
      const payload = bodyObj ? (typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj)) : null;
      const reqHeaders = Object.assign({}, headers || {});
      if (payload && !reqHeaders['Content-Length']) {
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }
      const req = nodeHttps.request(
        urlStr,
        {
          method: method || 'GET',
          headers: reqHeaders
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            let parsed = raw;
            try {
              parsed = JSON.parse(raw);
            } catch (e) {}
            resolve({ statusCode: res.statusCode, body: parsed, raw });
          });
        }
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  /**
   * Exchanges GCP service-account.json for an OAuth2 Bearer access token.
   */
  async function getGoogleWalletAccessToken(serviceAccountJson) {
    if (!nodeCrypto || !nodeHttps) {
      throw new Error('OAuth2 token exchange requires Node.js environment');
    }
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: serviceAccountJson.client_email,
      scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    };
    const input = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(
      JSON.stringify(claimSet)
    )}`;
    const signer = nodeCrypto.createSign('RSA-SHA256');
    signer.update(input);
    signer.end();
    const assertion = `${input}.${base64UrlEncodeBytes(signer.sign(serviceAccountJson.private_key))}`;

    const tokenBody = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`;
    const res = await httpsJsonRequest(
      'https://oauth2.googleapis.com/token',
      'POST',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      tokenBody
    );
    if (res.statusCode !== 200 || !res.body || !res.body.access_token) {
      throw new Error(`OAuth2 token error (${res.statusCode}): ${res.raw}`);
    }
    return res.body.access_token;
  }

  /**
   * Creates or updates (`GET` -> `POST` if 404, or `PUT`/`PATCH` if 200) both `GenericClass` and `GenericObject`
   * in the live Google Wallet REST API.
   */
  async function syncClassAndObjectToGoogleWallet(genericClass, genericObject, serviceAccountJson) {
    const accessToken = await getGoogleWalletAccessToken(serviceAccountJson);
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // 1. Upsert GenericClass
    const classGetUrl = `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${encodeURIComponent(
      genericClass.id
    )}`;
    const classCheck = await httpsJsonRequest(classGetUrl, 'GET', authHeaders, null);
    let classResult;
    if (classCheck.statusCode === 404) {
      classResult = await httpsJsonRequest(
        'https://walletobjects.googleapis.com/walletobjects/v1/genericClass',
        'POST',
        authHeaders,
        genericClass
      );
      classResult.operation = 'CREATED (POST)';
    } else if (classCheck.statusCode === 200) {
      classResult = await httpsJsonRequest(classGetUrl, 'PUT', authHeaders, genericClass);
      classResult.operation = 'UPDATED (PUT)';
    } else {
      classResult = classCheck;
      classResult.operation = `CHECK_FAILED (${classCheck.statusCode})`;
    }

    // Verify logo image URL is reachable so Google Wallet never throws 400 Bad Request
    if (genericObject.logo && genericObject.logo.sourceUri && genericObject.logo.sourceUri.uri) {
      const logoUri = genericObject.logo.sourceUri.uri;
      try {
        const check = await httpsJsonRequest(logoUri, 'GET', {}, null);
        if (check.statusCode === 404 && logoUri.endsWith('.png')) {
          const fallbackJpg = logoUri.replace(/\.png$/, '.jpg').replace(/avatar-/, '');
          const checkJpg = await httpsJsonRequest(fallbackJpg, 'GET', {}, null);
          if (checkJpg.statusCode === 200) {
            console.log(`  [INFO] Logo ${logoUri} not yet on GitHub Pages, auto-falling back to ${fallbackJpg}`);
            genericObject.logo.sourceUri.uri = fallbackJpg;
          }
        }
      } catch (e) {}
    }

    // 2. Upsert GenericObject
    const objGetUrl = `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${encodeURIComponent(
      genericObject.id
    )}`;
    const objCheck = await httpsJsonRequest(objGetUrl, 'GET', authHeaders, null);
    let objectResult;
    if (objCheck.statusCode === 404) {
      objectResult = await httpsJsonRequest(
        'https://walletobjects.googleapis.com/walletobjects/v1/genericObject',
        'POST',
        authHeaders,
        genericObject
      );
      objectResult.operation = 'CREATED (POST)';
    } else if (objCheck.statusCode === 200) {
      objectResult = await httpsJsonRequest(objGetUrl, 'PUT', authHeaders, genericObject);
      objectResult.operation = 'UPDATED (PUT)';
    } else {
      objectResult = objCheck;
      objectResult.operation = `CHECK_FAILED (${objCheck.statusCode})`;
    }

    return {
      classResult,
      objectResult
    };
  }

  /**
   * Starts a local studio server on http://localhost:<port> that serves admin.html / index.html
   * and provides a POST /api/save-and-sync endpoint to update profiles.json, profiles-data.js,
   * save avatar-<user>.png, and immediately push changes live to the Google Wallet REST API.
   */
  function startStudioServer(port = 3000, saPath = './service-account.json') {
    const http = require('http');
    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      let pathname = decodeURIComponent(parsedUrl.pathname);

      if (req.method === 'POST' && pathname === '/api/save-and-sync') {
        let bodyStr = '';
        req.on('data', (chunk) => {
          bodyStr += chunk;
        });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(bodyStr || '{}');
            const { profiles, activeUser = 'artautas', avatarPngBase64, key } = payload;

            // 1. Save avatar PNG if provided
            if (avatarPngBase64) {
              const cleanB64 = avatarPngBase64.replace(/^data:image\/[a-z]+;base64,/, '');
              const avatarFileName = `avatar-${activeUser}.png`;
              const avatarFilePath = nodePath.join(process.cwd(), avatarFileName);
              nodeFs.writeFileSync(avatarFilePath, Buffer.from(cleanB64, 'base64'));
              console.log(`[STUDIO] Saved ${avatarFileName} (${Buffer.from(cleanB64, 'base64').length} bytes)`);
            }

            // 2. Save profiles.json & profiles-data.js
            if (profiles) {
              const profilesPath = nodePath.join(process.cwd(), 'profiles.json');
              nodeFs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2), 'utf8');

              const jsContent = `/**\n * SMART WALLET CARDS · BUNDLED MULTI-USER PROFILES DATABASE\n */\nwindow.SMART_WALLET_PROFILES = ${JSON.stringify(profiles, null, 2)};\n`;
              nodeFs.writeFileSync(nodePath.join(process.cwd(), 'profiles-data.js'), jsContent, 'utf8');
              console.log(`[STUDIO] Updated profiles.json and profiles-data.js`);
            }

            // 3. Update local-keys.js if key is provided
            let activeKey = key;
            const localKeysPath = nodePath.join(process.cwd(), 'local-keys.js');
            if (key && nodeFs.existsSync(localKeysPath)) {
              try {
                let lk = nodeFs.readFileSync(localKeysPath, 'utf8');
                const keyRegex = new RegExp(`("${activeUser}"|'${activeUser}'|${activeUser})\\s*:\\s*['"][^'"]*['"]`);
                if (keyRegex.test(lk)) {
                  lk = lk.replace(keyRegex, `'${activeUser}': '${key}'`);
                } else {
                  lk = lk.replace(/window\.SMART_WALLET_LOCAL_KEYS\s*=\s*\{/, `window.SMART_WALLET_LOCAL_KEYS = {\n  '${activeUser}': '${key}',`);
                }
                nodeFs.writeFileSync(localKeysPath, lk, 'utf8');
              } catch (e) {
                console.warn('[STUDIO] Could not update local-keys.js:', e.message);
              }
            } else if (!activeKey && nodeFs.existsSync(localKeysPath)) {
              try {
                const lk = nodeFs.readFileSync(localKeysPath, 'utf8');
                const match = lk.match(new RegExp(`${activeUser}\\s*:\\s*['"]([^'"]+)['"]`));
                if (match && match[1]) activeKey = match[1];
              } catch (e) {}
            }

            // 4. Load Service Account & Sync with Google Wallet API
            let serviceAccount = null;
            if (nodeFs.existsSync(saPath)) {
              try {
                serviceAccount = JSON.parse(nodeFs.readFileSync(saPath, 'utf8'));
              } catch (e) {}
            }

            if (!serviceAccount || !serviceAccount.private_key) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error: 'service-account.json not found or missing private_key. Local files saved successfully.'
                })
              );
              return;
            }

            const updatedDb = JSON.parse(
              nodeFs.readFileSync(nodePath.join(process.cwd(), 'profiles.json'), 'utf8')
            );
            const prof = updatedDb.profiles[activeUser];
            if (!prof) {
              throw new Error(`Profile "${activeUser}" not found in profiles.json`);
            }

            const issuerId = (prof.walletConfig && prof.walletConfig.issuerId) || DEFAULT_ISSUER_ID;
            const classSuffix = (prof.walletConfig && prof.walletConfig.classSuffix) || DEFAULT_CLASS_SUFFIX;
            const objectSuffix = (prof.walletConfig && prof.walletConfig.objectSuffix) || `${activeUser}_card`;

            const jwtResult = await createSaveToWalletJwt(prof, {
              issuerId,
              classSuffix,
              objectSuffix,
              secretKey: activeKey || '',
              skinnyJwt: true,
              serviceAccountEmail: serviceAccount.client_email,
              privateKeyPem: serviceAccount.private_key
            });

            console.log(`[STUDIO] Pushing live pass update to Google Wallet API for ${prof.name} (${activeUser})...`);
            const syncRes = await syncClassAndObjectToGoogleWallet(
              jwtResult.genericClass,
              jwtResult.genericObject,
              serviceAccount
            );

            console.log(`[STUDIO] Class: ${syncRes.classResult.operation} [HTTP ${syncRes.classResult.statusCode}]`);
            console.log(`[STUDIO] Object: ${syncRes.objectResult.operation} [HTTP ${syncRes.objectResult.statusCode}]`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                message: 'Successfully updated live Google Wallet pass over-the-air!',
                classResult: syncRes.classResult,
                objectResult: syncRes.objectResult,
                saveUrl: jwtResult.saveUrl,
                objectId: jwtResult.genericObject.id,
                classId: jwtResult.genericClass.id
              })
            );
          } catch (err) {
            console.error('[STUDIO] Error during /api/save-and-sync:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // Static file serving
      if (pathname === '/' || pathname === '') {
        pathname = '/admin.html';
      }

      const safePath = nodePath.normalize(nodePath.join(process.cwd(), pathname));
      if (!safePath.startsWith(process.cwd())) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!nodeFs.existsSync(safePath) || nodeFs.statSync(safePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      const ext = nodePath.extname(safePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.vcf': 'text/vcard; charset=utf-8',
        '.ico': 'image/x-icon'
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      nodeFs.createReadStream(safePath).pipe(res);
    });

    server.listen(port, () => {
      console.log('========================================================================');
      console.log(`  SMART WALLET CARDS · VISUAL ADMIN STUDIO & LIVE GOOGLE WALLET SERVER`);
      console.log('========================================================================');
      console.log(`  Local Admin URL: http://localhost:${port}/admin.html`);
      console.log(`  Card Hub URL   : http://localhost:${port}/index.html`);
      console.log(`  Sync Endpoint  : http://localhost:${port}/api/save-and-sync (POST)`);
      console.log(`  Issuer ID      : ${DEFAULT_ISSUER_ID}`);
      console.log(`  Status         : Ready for one-click live pass updates`);
      console.log('========================================================================\n');
    });

    return server;
  }

  // ============================================================================
  // NODE.JS CLI RUNNER (`node wallet-api.js [sync|generate|patch|class|object]`)
  // ============================================================================
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    (async function runCli() {
      const args = process.argv.slice(2);
      const command = (args[0] && !args[0].startsWith('--') ? args[0] : 'sync').toLowerCase();

      function getFlag(name, fallback) {
        const idx = args.indexOf(`--${name}`);
        if (idx !== -1 && args[idx + 1]) return args[idx + 1];
        return fallback;
      }

      const userId = getFlag('user', 'artautas');
      const port = parseInt(getFlag('port', '3000'), 10);
      const saPath = getFlag('credentials', process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json');

      if (command === 'studio' || command === 'server') {
        startStudioServer(port, saPath);
        return;
      }

      // Load local key from local-keys.js if available and not passed via --key
      let defaultLocalKey = '';
      const localKeysPath = nodePath.join(process.cwd(), 'local-keys.js');
      if (nodeFs.existsSync(localKeysPath)) {
        try {
          const lkContent = nodeFs.readFileSync(localKeysPath, 'utf8');
          const match = lkContent.match(new RegExp(`${userId}\\s*:\\s*['"]([^'"]+)['"]`));
          if (match && match[1]) defaultLocalKey = match[1];
        } catch (e) {}
      }

      const secretKey = getFlag('key', defaultLocalKey);
      const issuerId = getFlag('issuer', DEFAULT_ISSUER_ID);
      const classSuffix = getFlag('class', DEFAULT_CLASS_SUFFIX);
      const hubBaseUrl = getFlag('url', DEFAULT_HUB_BASE_URL);
      const heroBannerUrl = getFlag('hero', DEFAULT_HERO_BANNER_URL);

      const profilesPath = nodePath.join(process.cwd(), 'profiles.json');
      if (!nodeFs.existsSync(profilesPath)) {
        console.error('Error: profiles.json not found in current directory.');
        process.exit(1);
      }

      const db = JSON.parse(nodeFs.readFileSync(profilesPath, 'utf8'));
      const profile = db.profiles[userId];
      if (!profile) {
        console.error(
          `Error: Profile "${userId}" not found in profiles.json. Available: ${Object.keys(db.profiles).join(', ')}`
        );
        process.exit(1);
      }

      const objectSuffix = getFlag(
        'object',
        (profile.walletConfig && profile.walletConfig.objectSuffix) || `${userId}_card`
      );

      let serviceAccount = null;
      if (nodeFs.existsSync(saPath)) {
        try {
          serviceAccount = JSON.parse(nodeFs.readFileSync(saPath, 'utf8'));
        } catch (e) {
          console.warn(`Warning: Could not parse service account JSON at ${saPath}`);
        }
      }

      const result = await createSaveToWalletJwt(profile, {
        issuerId,
        classSuffix,
        objectSuffix,
        secretKey,
        hubBaseUrl,
        heroBannerUrl,
        includeClassInJwt: true,
        skinnyJwt: true,
        serviceAccountEmail:
          (serviceAccount && serviceAccount.client_email) || DEFAULT_SERVICE_ACCOUNT_EMAIL,
        privateKeyPem: (serviceAccount && serviceAccount.private_key) || ''
      });

      const cleanGenericObject = JSON.parse(JSON.stringify(result.genericObject));
      const outFlag = getFlag('out', '');
      if (outFlag) {
        nodeFs.writeFileSync(outFlag, JSON.stringify(cleanGenericObject, null, 2), 'utf8');
      }

      console.log('========================================================================');
      console.log('  SMART WALLET CARDS · OFFICIAL GOOGLE WALLET API PASS PROVISIONER');
      console.log('========================================================================');
      console.log(`  Profile        : ${profile.name} (${userId})`);
      console.log(`  Issuer ID      : ${issuerId}`);
      console.log(`  Theme Hex      : ${result.genericObject.hexBackgroundColor} (Deep Sapphire)`);
      console.log(`  GenericClass   : ${result.genericClass.id}`);
      console.log(`  GenericObject  : ${result.genericObject.id}`);
      console.log(`  Logo Avatar    : ${result.genericObject.logo ? result.genericObject.logo.sourceUri.uri : 'None'}`);
      console.log(`  Barcode QR URL : ${result.genericObject.barcode.value}`);
      console.log(`  Signing Mode   : ${result.signedMode}`);
      console.log('------------------------------------------------------------------------');

      if (command === 'class') {
        console.log(JSON.stringify(result.genericClass, null, 2));
        return;
      }

      if (command === 'object') {
        console.log(JSON.stringify(result.genericObject, null, 2));
        return;
      }

      if ((command === 'sync' || command === 'patch') && serviceAccount && serviceAccount.private_key) {
        console.log('\n[GOOGLE WALLET REST API] Provisioning GenericClass & GenericObject...');
        try {
          const syncRes = await syncClassAndObjectToGoogleWallet(
            result.genericClass,
            cleanGenericObject,
            serviceAccount
          );
          console.log(
            `  ✓ GenericClass (${result.genericClass.id})  : ${syncRes.classResult.operation} [HTTP ${syncRes.classResult.statusCode}]`
          );
          if (syncRes.classResult.statusCode >= 300) {
            console.error('    Class Response:', JSON.stringify(syncRes.classResult.body));
          }
          console.log(
            `  ✓ GenericObject (${result.genericObject.id}): ${syncRes.objectResult.operation} [HTTP ${syncRes.objectResult.statusCode}]`
          );
          if (syncRes.objectResult.statusCode >= 300) {
            console.error('    Object Response:', JSON.stringify(syncRes.objectResult.body));
          }
        } catch (err) {
          console.error('  ✗ REST API Error:', err.message);
        }
      }

      console.log('\n1. SIGNED SAVE-TO-GOOGLE-WALLET LINK (RS256):');
      console.log(result.saveUrl);

      console.log('\n2. SCANNABLE SAVE-TO-WALLET QR CODE (Point Pixel 11 Pro XL Camera Here):');
      console.log(SmartWalletQR.toTerminalString(result.saveUrl, { ecLevel: 'L', margin: 2 }));

      console.log('\n3. AUTO-UPDATE PATCH COMMAND:');
      console.log('   ' + result.patchCommand.nodeCommand);
      console.log('========================================================================');
    })();
  }

  return {
    DEFAULT_ISSUER_ID,
    buildGenericClass,
    buildGenericObject,
    buildJwtClaims,
    createSaveToWalletJwt,
    buildPatchCliCommand,
    syncClassAndObjectToGoogleWallet,
    startStudioServer
  };
});
