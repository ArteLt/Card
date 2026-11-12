#!/usr/bin/env node
/**
 * Smart Wallet Cards — Official Google Wallet API Pass Generator & Auto-Updater (wallet-api.js)
 * Dual-mode module:
 *   1. Browser library (`window.SmartWalletPassAPI`) for `admin.html`
 *   2. Standalone Zero-Dependency Node.js CLI (`node wallet-api.js [generate|patch|class|object]`)
 *
 * Creates Google Wallet `GenericClass` & `GenericObject` in Deep Sapphire (#0D2340),
 * signs RS256 `https://pay.google.com/gp/v/save/<JWT>` links, renders scannable QR codes,
 * and executes `PATCH` updates to push live changes automatically to users' phones.
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

  /**
   * Builds the Google Wallet `GenericClass` payload (Template for Executive Business Cards).
   */
  function buildGenericClass(options) {
    const opts = Object.assign(
      {
        issuerId: '3388000000022948101',
        classSuffix: 'executive_sapphire_card'
      },
      options || {}
    );
    const classId = `${opts.issuerId}.${opts.classSuffix}`;

    return {
      id: classId,
      issuerName: 'Smart Wallet Executive Cards',
      reviewStatus: 'UNDER_REVIEW',
      multipleDevicesAndHoldersAllowedStatus: 'MULTIPLE_HOLDERS',
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['practice_areas']" }]
                  }
                },
                endItem: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['location']" }]
                  }
                }
              }
            },
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['direct_phone']" }]
                  }
                },
                endItem: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['direct_email']" }]
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
   * Builds the Google Wallet `GenericObject` payload in Deep Sapphire (#0D2340) for a specific user profile.
   */
  function buildGenericObject(profile, options) {
    const opts = Object.assign(
      {
        issuerId: (profile.walletConfig && profile.walletConfig.issuerId) || '3388000000022948101',
        classSuffix: (profile.walletConfig && profile.walletConfig.classSuffix) || 'executive_sapphire_card',
        objectSuffix: (profile.walletConfig && profile.walletConfig.objectSuffix) || `${profile.id}_card`,
        secretKey: '',
        hubBaseUrl: 'https://artelt.github.io/Card/index.html',
        heroBannerUrl: 'https://artelt.github.io/Card/hero-banner-1032x336.png',
        logoUrl: 'https://artelt.github.io/Card/artautas.jpg'
      },
      options || {}
    );

    const classId = `${opts.issuerId}.${opts.classSuffix}`;
    const objectId = `${opts.issuerId}.${opts.objectSuffix}`;

    const phoneDec = SmartWalletCrypto.decryptField(profile.encryptedPhone, opts.secretKey);
    const emailDec = SmartWalletCrypto.decryptField(profile.encryptedEmail, opts.secretKey);
    const phoneDisplay = phoneDec.unlocked ? phoneDec.value : 'Protected (Scan QR)';
    const emailDisplay = emailDec.unlocked ? emailDec.value : 'Protected (Scan QR)';

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

    const hexBg = (profile.theme && profile.theme.bgPrimary) || '#163A63';
    const linkedinUrl = profile.linkedin || 'https://www.linkedin.com/in/artautas/';
    const linkedinDisp =
      profile.linkedinDisplay || linkedinUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    let sloganText = String(profile.slogan || "LET'S CONNECT.").toUpperCase().trim();
    if (!sloganText.endsWith('.')) sloganText += '.';

    return {
      id: objectId,
      classId: classId,
      genericType: 'GENERIC_TYPE_UNSPECIFIED',
      hexBackgroundColor: hexBg,
      state: 'ACTIVE',
      cardTitle: {
        defaultValue: {
          language: 'en-US',
          value: 'DIGITAL EXECUTIVE CARD'
        }
      },
      subheader: {
        defaultValue: {
          language: 'en-US',
          value: taglineLines[0] || 'LAWYER (LL.M.) · LEGAL TRANSLATOR'
        }
      },
      header: {
        defaultValue: {
          language: 'en-US',
          value: profile.name || 'Artautas Šimkus, LL.M.'
        }
      },
      logo: {
        sourceUri: {
          uri: opts.logoUrl
        },
        contentDescription: {
          defaultValue: {
            language: 'en-US',
            value: profile.name || 'Artautas Šimkus, LL.M.'
          }
        }
      },
      heroImage: {
        sourceUri: {
          uri: opts.heroBannerUrl
        },
        contentDescription: {
          defaultValue: {
            language: 'en-US',
            value: `${profile.name} — ${sloganText} (1032x336 Hero Banner)`
          }
        }
      },
      barcode: {
        type: 'QR_CODE',
        value: shareUrl,
        alternateText: `${sloganText} · SCAN TO SAVE CONTACT`
      },
      textModulesData: [
        {
          id: 'practice_areas',
          header: 'EXPERTISE & FOCUS',
          body: taglineLines.join(' · ')
        },
        {
          id: 'location',
          header: 'LOCATION',
          body: profile.location || 'Heidelberg, Germany'
        },
        {
          id: 'direct_phone',
          header: 'PHONE (CELL)',
          body: phoneDisplay
        },
        {
          id: 'direct_email',
          header: 'EMAIL',
          body: emailDisplay
        },
        {
          id: 'linkedin',
          header: 'LINKEDIN',
          body: linkedinDisp
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
   */
  function buildJwtClaims(genericClass, genericObject, options) {
    const opts = Object.assign(
      {
        serviceAccountEmail: 'wallet-pass-issuer@smart-wallet-cards.iam.gserviceaccount.com',
        origins: ['https://artelt.github.io', 'http://localhost:8080'],
        includeClassInJwt: false
      },
      options || {}
    );

    const payload = {
      iss: opts.serviceAccountEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: opts.origins,
      payload: {
        genericObjects: [genericObject]
      }
    };

    if (opts.includeClassInJwt && genericClass) {
      payload.payload.genericClasses = [genericClass];
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
   * If no real GCP Service Account Private Key PEM is provided yet, creates a deterministic
   * preview signature (in browser) or signs with an ephemeral RSA-2048 key (in Node.js)
   * so the `https://pay.google.com/gp/v/save/<JWT>` link and QR code can be tested immediately.
   */
  async function createSaveToWalletJwt(profile, options) {
    const opts = Object.assign(
      {
        issuerId: (profile.walletConfig && profile.walletConfig.issuerId) || '3388000000022948101',
        classSuffix: (profile.walletConfig && profile.walletConfig.classSuffix) || 'executive_sapphire_card',
        objectSuffix: (profile.walletConfig && profile.walletConfig.objectSuffix) || `${profile.id}_card`,
        secretKey: '',
        serviceAccountEmail: 'wallet-pass-issuer@smart-wallet-cards.iam.gserviceaccount.com',
        privateKeyPem: '',
        hubBaseUrl: 'https://artelt.github.io/Card/index.html',
        heroBannerUrl: 'https://artelt.github.io/Card/hero-banner-1032x336.png',
        logoUrl: 'https://artelt.github.io/Card/artautas.jpg',
        includeClassInJwt: false
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
        // Generate an ephemeral RSA-2048 keypair so Node CLI produces a real RS256 cryptographic signature
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
    // 3. Browser Preview mode (no GCP service-account.json loaded yet)
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
    const issuerId = opts.issuerId || (profile.walletConfig && profile.walletConfig.issuerId) || '3388000000022948101';
    const objectSuffix =
      opts.objectSuffix || (profile.walletConfig && profile.walletConfig.objectSuffix) || `${uid}_card`;
    const resourceId = `${issuerId}.${objectSuffix}`;

    const nodeCmd = `node wallet-api.js patch --user ${uid}${keyArg} --issuer ${issuerId} --object ${objectSuffix}`;
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
   * Node.js OAuth2 Service Account Token Exchange + Google Wallet REST API PATCH execution.
   */
  function executeNodePatchRequest(genericObject, serviceAccountJson) {
    return new Promise((resolve, reject) => {
      if (!nodeCrypto || !nodeHttps) {
        return reject(new Error('PATCH network execution requires Node.js environment'));
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
      const tokenReq = nodeHttps.request(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(tokenBody)
          }
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              const tokenResp = JSON.parse(raw);
              if (!tokenResp.access_token) {
                return reject(new Error('OAuth2 token error: ' + raw));
              }
              const patchData = JSON.stringify(genericObject);
              const patchUrl = `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${encodeURIComponent(
                genericObject.id
              )}`;
              const patchReq = nodeHttps.request(
                patchUrl,
                {
                  method: 'PATCH',
                  headers: {
                    Authorization: `Bearer ${tokenResp.access_token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(patchData)
                  }
                },
                (pRes) => {
                  let pRaw = '';
                  pRes.on('data', (c) => (pRaw += c));
                  pRes.on('end', () => {
                    resolve({ statusCode: pRes.statusCode, body: pRaw });
                  });
                }
              );
              patchReq.on('error', reject);
              patchReq.write(patchData);
              patchReq.end();
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      tokenReq.on('error', reject);
      tokenReq.write(tokenBody);
      tokenReq.end();
    });
  }

  // ============================================================================
  // NODE.JS CLI RUNNER (`node wallet-api.js ...`)
  // ============================================================================
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    (async function runCli() {
      const args = process.argv.slice(2);
      const command = (args[0] && !args[0].startsWith('--') ? args[0] : 'generate').toLowerCase();

      function getFlag(name, fallback) {
        const idx = args.indexOf(`--${name}`);
        if (idx !== -1 && args[idx + 1]) return args[idx + 1];
        return fallback;
      }

      const userId = getFlag('user', 'artautas');
      const secretKey = getFlag('key', '');
      const issuerId = getFlag('issuer', '3388000000022948101');
      const classSuffix = getFlag('class', 'executive_sapphire_card');
      const hubBaseUrl = getFlag('url', 'https://artelt.github.io/Card/index.html');
      const saPath = getFlag('credentials', process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json');

      const profilesPath = nodePath.join(process.cwd(), 'profiles.json');
      if (!nodeFs.existsSync(profilesPath)) {
        console.error('Error: profiles.json not found in current directory.');
        process.exit(1);
      }

      const db = JSON.parse(nodeFs.readFileSync(profilesPath, 'utf8'));
      const profile = db.profiles[userId];
      if (!profile) {
        console.error(`Error: Profile "${userId}" not found in profiles.json. Available: ${Object.keys(db.profiles).join(', ')}`);
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
        serviceAccountEmail:
          (serviceAccount && serviceAccount.client_email) ||
          'wallet-pass-issuer@smart-wallet-cards.iam.gserviceaccount.com',
        privateKeyPem: (serviceAccount && serviceAccount.private_key) || ''
      });

      const outFlag = getFlag('out', '');
      if (outFlag) {
        nodeFs.writeFileSync(outFlag, JSON.stringify(result.genericObject, null, 2), 'utf8');
      }

      console.log('========================================================================');
      console.log('  SMART WALLET CARDS · OFFICIAL GOOGLE WALLET API PASS GENERATOR');
      console.log('========================================================================');
      console.log(`  Profile        : ${profile.name} (${userId})`);
      console.log(`  Theme Hex      : ${result.genericObject.hexBackgroundColor} (Deep Sapphire)`);
      console.log(`  GenericClass   : ${result.genericClass.id}`);
      console.log(`  GenericObject  : ${result.genericObject.id}`);
      console.log(`  Barcode URL    : ${result.genericObject.barcode.value}`);
      console.log(`  Signing Mode   : ${result.signedMode}`);
      if (outFlag) {
        console.log(`  Saved Payload  : ${outFlag}`);
      }
      console.log('------------------------------------------------------------------------');

      if (command === 'class') {
        console.log(JSON.stringify(result.genericClass, null, 2));
        return;
      }

      if (command === 'object') {
        console.log(JSON.stringify(result.genericObject, null, 2));
        return;
      }

      if (command === 'patch') {
        console.log('\n[PATCH AUTO-UPDATE] Pushing updated GenericObject to Google Wallet...');
        console.log(`Endpoint: ${result.patchCommand.endpoint}\n`);
        if (serviceAccount && serviceAccount.private_key && serviceAccount.client_email) {
          try {
            const resp = await executeNodePatchRequest(result.genericObject, serviceAccount);
            console.log(`HTTP Status: ${resp.statusCode}`);
            console.log(resp.body);
          } catch (err) {
            console.error('PATCH request failed:', err.message);
          }
        } else {
          console.log('No live GCP service-account.json detected in workspace.');
          console.log('Prepared GenericObject payload written to:', outObjectFile);
          console.log('\nRun with credentials or execute cURL:');
          console.log(result.patchCommand.curlCommand);
        }
        return;
      }

      // Default: `generate` / `jwt`
      console.log('\n1. SIGNED SAVE-TO-GOOGLE-WALLET LINK:');
      console.log(result.saveUrl);

      console.log('\n2. SCANNABLE QR CODE (Point Pixel / Android Camera at Terminal):');
      console.log(SmartWalletQR.toTerminalString(result.genericObject.barcode.value, { ecLevel: 'L', margin: 2 }));

      console.log('\n3. AUTO-UPDATE PATCH COMMAND (Push changes automatically to phones):');
      console.log('   ' + result.patchCommand.nodeCommand);
      console.log('\n   Or via REST API cURL:');
      console.log(
        result.patchCommand.curlCommand
          .split('\n')
          .map((l) => '   ' + l)
          .join('\n')
      );
      console.log('========================================================================');
    })();
  }

  return {
    buildGenericClass,
    buildGenericObject,
    buildJwtClaims,
    createSaveToWalletJwt,
    buildPatchCliCommand
  };
});
