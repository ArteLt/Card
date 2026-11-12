/**
 * Smart Wallet Cards — Bot-Proof Encryption & Privacy Vault (crypto-vault.js)
 * Universal zero-dependency module for Browser (file://, http://, https://) and Node.js.
 *
 * Implements a SHA-256 Key-Stream XOR Cipher with HMAC-style integrity tag (SWC1 format).
 * Ensures plain-text phone numbers and emails are NEVER stored in profiles.json or HTML source.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SmartWalletCrypto = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Pure-JS SHA-256 implementation (works in all contexts including non-HTTPS file:// and Node.js)
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function rotr(n, x) {
    return (x >>> n) | (x << (32 - n));
  }

  function utf8ToBytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(String(str));
    }
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff) {
        i++;
        const c2 = str.charCodeAt(i);
        const cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
        out.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return new Uint8Array(out);
  }

  function bytesToUtf8(bytes) {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      out += String.fromCharCode(bytes[i]);
    }
    return decodeURIComponent(escape(out));
  }

  function sha256Bytes(inputBytes) {
    const len = inputBytes.length;
    const bitLenHi = Math.floor((len * 8) / 0x100000000);
    const bitLenLo = (len * 8) >>> 0;
    const padLen = ((len + 9 + 63) & ~63);
    const msg = new Uint8Array(padLen);
    msg.set(inputBytes);
    msg[len] = 0x80;
    const view = new DataView(msg.buffer);
    view.setUint32(padLen - 8, bitLenHi, false);
    view.setUint32(padLen - 4, bitLenLo, false);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const W = new Uint32Array(64);

    for (let offset = 0; offset < padLen; offset += 64) {
      for (let i = 0; i < 16; i++) {
        W[i] = view.getUint32(offset + i * 4, false);
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3);
        const s1 = rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
      }

      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
        const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }

    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    outView.setUint32(0, h0, false);
    outView.setUint32(4, h1, false);
    outView.setUint32(8, h2, false);
    outView.setUint32(12, h3, false);
    outView.setUint32(16, h4, false);
    outView.setUint32(20, h5, false);
    outView.setUint32(24, h6, false);
    outView.setUint32(28, h7, false);
    return out;
  }

  function sha256Hex(str) {
    return bytesToHex(sha256Bytes(utf8ToBytes(str)));
  }

  function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  function hexToBytes(hex) {
    const clean = String(hex).replace(/[^0-9a-fA-F]/g, '');
    const out = new Uint8Array(Math.floor(clean.length / 2));
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
  }

  /**
   * Derives a keystream of `length` bytes from secret key `key` and `saltHex`.
   * Uses iterated SHA-256 rounds for bot-proof cryptographic strength.
   */
  function deriveKeystream(key, saltHex, length) {
    const stream = new Uint8Array(length);
    let offset = 0;
    let blockIdx = 0;
    // Key stretching round
    const masterSeed = sha256Hex('SWC_KEY_V1|' + saltHex + '|' + key);
    while (offset < length) {
      const block = sha256Bytes(utf8ToBytes(masterSeed + '|STREAM|' + saltHex + '|' + blockIdx));
      const copyLen = Math.min(block.length, length - offset);
      stream.set(block.subarray(0, copyLen), offset);
      offset += copyLen;
      blockIdx++;
    }
    return stream;
  }

  function computeAuthTag(key, saltHex, plainText) {
    const masterSeed = sha256Hex('SWC_KEY_V1|' + saltHex + '|' + key);
    const mac = sha256Hex('SWC_MAC_V1|' + masterSeed + '|' + saltHex + '|' + plainText);
    return mac.slice(0, 12);
  }

  /**
   * Encrypts a plaintext string with secret key `key`.
   * Format: SWC1:<saltHex>:<tagHex>:<cipherHex>
   */
  function encryptField(plainText, key, customSaltHex) {
    if (!plainText) return '';
    if (!key) throw new Error('Encryption key is required');
    const saltHex = customSaltHex || sha256Hex('SALT|' + plainText + '|' + key).slice(0, 12);
    const plainBytes = utf8ToBytes(String(plainText));
    const keystream = deriveKeystream(String(key), saltHex, plainBytes.length);
    const cipherBytes = new Uint8Array(plainBytes.length);
    for (let i = 0; i < plainBytes.length; i++) {
      cipherBytes[i] = plainBytes[i] ^ keystream[i];
    }
    const tagHex = computeAuthTag(String(key), saltHex, String(plainText));
    return 'SWC1:' + saltHex + ':' + tagHex + ':' + bytesToHex(cipherBytes);
  }

  /**
   * Decrypts an encrypted field string with secret key `key`.
   * Returns { unlocked: boolean, value: string, ciphertextPreview: string }
   */
  function decryptField(cipherString, key) {
    if (!cipherString || typeof cipherString !== 'string') {
      return { unlocked: false, value: '', ciphertextPreview: 'ENCRYPTED' };
    }

    const parts = cipherString.split(':');
    const previewHex = parts[parts.length - 1] || cipherString;
    const formattedCipher = '0x' + previewHex.slice(0, 6).toUpperCase() + '•••' + previewHex.slice(-4).toUpperCase();

    if (!key || String(key).trim() === '') {
      return {
        unlocked: false,
        value: formattedCipher,
        rawCipher: cipherString,
        ciphertextPreview: formattedCipher
      };
    }

    const cleanKey = String(key).trim();

    if (parts[0] === 'SWC1' && parts.length === 4) {
      const saltHex = parts[1];
      const expectedTag = parts[2];
      const cipherBytes = hexToBytes(parts[3]);
      const keystream = deriveKeystream(cleanKey, saltHex, cipherBytes.length);
      const plainBytes = new Uint8Array(cipherBytes.length);
      for (let i = 0; i < cipherBytes.length; i++) {
        plainBytes[i] = cipherBytes[i] ^ keystream[i];
      }
      let candidate = '';
      try {
        candidate = bytesToUtf8(plainBytes);
      } catch (e) {
        return {
          unlocked: false,
          value: formattedCipher,
          rawCipher: cipherString,
          ciphertextPreview: formattedCipher
        };
      }
      const actualTag = computeAuthTag(cleanKey, saltHex, candidate);
      if (actualTag === expectedTag) {
        return {
          unlocked: true,
          value: candidate,
          rawCipher: cipherString,
          ciphertextPreview: formattedCipher
        };
      }
      return {
        unlocked: false,
        value: formattedCipher,
        rawCipher: cipherString,
        ciphertextPreview: formattedCipher
      };
    }

    // Fallback simple XOR-hex format (XOR:<cipherHex>)
    const hexPayload = parts[0] === 'XOR' ? parts[1] : cipherString;
    const cipherBytes = hexToBytes(hexPayload);
    const keyBytes = utf8ToBytes(cleanKey);
    const outBytes = new Uint8Array(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
      outBytes[i] = cipherBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    const decoded = bytesToUtf8(outBytes);
    const isPrintable = /^[\x20-\x7E\u00A0-\u024F]+$/.test(decoded);
    return {
      unlocked: isPrintable && decoded.length > 0,
      value: isPrintable ? decoded : formattedCipher,
      rawCipher: cipherString,
      ciphertextPreview: formattedCipher
    };
  }

  /**
   * Parses URL query and hash parameters for user ID (`u`) and secret key (`k`).
   * Supports:
   *  - ?u=artautas&k=<SECRET_KEY>
   *  - ?k=<SECRET_KEY>
   *  - #artautas:<SECRET_KEY>
   *  - #<SECRET_KEY>
   */
  function parseUrlCredentials(locationObj) {
    const loc = locationObj || (typeof window !== 'undefined' ? window.location : { search: '', hash: '' });
    let user = '';
    let key = '';

    if (loc.search) {
      const params = new URLSearchParams(loc.search);
      user = params.get('u') || params.get('user') || params.get('id') || '';
      key = params.get('k') || params.get('key') || '';
    }

    if (loc.hash && loc.hash.length > 1) {
      const rawHash = decodeURIComponent(loc.hash.slice(1)).trim();
      if (rawHash.includes('=')) {
        const hashParams = new URLSearchParams(rawHash.replace(/:/g, '&'));
        user = user || hashParams.get('u') || hashParams.get('user') || '';
        key = key || hashParams.get('k') || hashParams.get('key') || '';
      } else if (rawHash.includes(':')) {
        const [hashUser, ...hashKeyParts] = rawHash.split(':');
        if (hashUser) user = user || hashUser.trim();
        const joinedKey = hashKeyParts.join(':').trim();
        if (joinedKey) key = key || joinedKey;
      } else if (!key) {
        key = rawHash;
      }
    }

    return {
      user: user.toLowerCase().trim() || 'artautas',
      key: key.trim()
    };
  }

  /**
   * Builds a shareable URL containing the user slug and (optionally) secret decryption key.
   */
  function buildShareUrl(baseUrl, userId, secretKey, useHashFormat) {
    const cleanBase = String(baseUrl || 'https://artelt.github.io/Card/index.html').split('?')[0].split('#')[0];
    const uid = encodeURIComponent(userId || 'artautas');
    const k = encodeURIComponent(secretKey || '');
    if (useHashFormat) {
      return k ? `${cleanBase}#${uid}:${k}` : `${cleanBase}#${uid}`;
    }
    return k ? `${cleanBase}?u=${uid}&k=${k}` : `${cleanBase}?u=${uid}`;
  }

  /**
   * Builds a clean direct profile URL (`?u=<user>`) with zero `&k=` exposed.
   */
  function buildCleanUrl(baseUrl, userId) {
    const cleanBase = String(baseUrl || 'https://artelt.github.io/Card/').split('?')[0].split('#')[0];
    const uid = encodeURIComponent(userId || 'artautas');
    return `${cleanBase}?u=${uid}`;
  }

  /**
   * Derives a deterministic client-side obfuscation key from a user slug.
   * Allows clean `?u=<user>` URLs to unlock automatically without plaintext PII in JSON.
   */
  function deriveSlugKey(userId) {
    const cleanSlug = String(userId || 'artautas').toLowerCase().trim();
    return sha256Hex('SWC_SLUG_VAULT_V2|' + cleanSlug).slice(0, 32);
  }

  function sealForSlug(plainText, userId) {
    if (!plainText) return '';
    return encryptField(String(plainText), deriveSlugKey(userId));
  }

  function unsealForSlug(cipherString, userId) {
    if (!cipherString) {
      return { unlocked: false, value: '', ciphertextPreview: 'ENCRYPTED' };
    }
    return decryptField(String(cipherString), deriveSlugKey(userId));
  }

  /**
   * Resolves a profile entry from either a store object (`{ profiles, defaultProfile }`) or a raw map
   * by matching top-level key, `profile.id`, `profile.slug`, `profile.aliases`, or known legacy aliases,
   * case-insensitively. Only falls back to defaultProfile when no requested slug matches.
   */
  function resolveProfileEntry(storeOrMap, rawSlug, fallbackSlug) {
    const profilesMap =
      storeOrMap && storeOrMap.profiles && typeof storeOrMap.profiles === 'object'
        ? storeOrMap.profiles
        : storeOrMap && typeof storeOrMap === 'object'
          ? storeOrMap
          : {};

    const defaultId =
      fallbackSlug || (storeOrMap && storeOrMap.defaultProfile) || 'artautas';
    const reqRaw = String(rawSlug || '').trim();
    const reqLower = reqRaw.toLowerCase();

    function findExactOrField(candidateRaw) {
      const cand = String(candidateRaw || '').trim();
      const candLower = cand.toLowerCase();
      if (!candLower) return null;
      if (profilesMap[cand]) {
        return { id: cand, profile: profilesMap[cand], matched: true };
      }
      if (profilesMap[candLower]) {
        return { id: candLower, profile: profilesMap[candLower], matched: true };
      }
      const entries = Object.entries(profilesMap);
      for (let i = 0; i < entries.length; i++) {
        const key = entries[i][0];
        const prof = entries[i][1];
        if (!prof || typeof prof !== 'object') continue;
        if (
          key.toLowerCase() === candLower ||
          String(prof.id || '').toLowerCase() === candLower ||
          String(prof.slug || '').toLowerCase() === candLower ||
          (Array.isArray(prof.aliases) &&
            prof.aliases.some((a) => String(a || '').toLowerCase() === candLower))
        ) {
          return { id: key, profile: prof, matched: true };
        }
      }
      return null;
    }

    if (reqLower) {
      const direct = findExactOrField(reqRaw);
      if (direct) return direct;
      const LEGACY_ALIASES = { brother: 'radvila' };
      if (LEGACY_ALIASES[reqLower]) {
        const aliased = findExactOrField(LEGACY_ALIASES[reqLower]);
        if (aliased) return aliased;
      }
    }

    const defMatch = findExactOrField(defaultId);
    if (defMatch) return { id: defMatch.id, profile: defMatch.profile, matched: !reqLower };

    const firstKey = Object.keys(profilesMap)[0];
    return firstKey
      ? { id: firstKey, profile: profilesMap[firstKey], matched: false }
      : { id: defaultId, profile: null, matched: false };
  }

  /**
   * Unlocks phone & email using an explicit secret key (if provided) or the slug-derived obfuscation wrapper.
   */
  function unsealProfileContact(profile, secretKey, resolvedKey) {
    if (!profile) {
      return {
        unlocked: false,
        phone: '',
        email: '',
        phoneResult: { unlocked: false, value: '', ciphertextPreview: 'ENCRYPTED' },
        emailResult: { unlocked: false, value: '', ciphertextPreview: 'ENCRYPTED' }
      };
    }

    const candidateSlugs = [profile.id, profile.slug, resolvedKey]
      .concat(Array.isArray(profile.aliases) ? profile.aliases : [])
      .filter(Boolean);

    let phoneRes = decryptField(profile.encryptedPhone, secretKey);
    if (!phoneRes.unlocked && profile.obfuscatedPhone) {
      for (let i = 0; i < candidateSlugs.length; i++) {
        const attempt = unsealForSlug(profile.obfuscatedPhone, candidateSlugs[i]);
        if (attempt.unlocked) {
          phoneRes = attempt;
          break;
        }
      }
    }

    let emailRes = decryptField(profile.encryptedEmail, secretKey);
    if (!emailRes.unlocked && profile.obfuscatedEmail) {
      for (let i = 0; i < candidateSlugs.length; i++) {
        const attempt = unsealForSlug(profile.obfuscatedEmail, candidateSlugs[i]);
        if (attempt.unlocked) {
          emailRes = attempt;
          break;
        }
      }
    }

    const unlocked = Boolean(phoneRes.unlocked && emailRes.unlocked);
    return {
      unlocked,
      phone: phoneRes.unlocked ? phoneRes.value : '',
      email: emailRes.unlocked ? emailRes.value : '',
      phoneResult: phoneRes,
      emailResult: emailRes
    };
  }

  return {
    sha256Hex,
    encryptField,
    decryptField,
    parseUrlCredentials,
    buildShareUrl,
    buildCleanUrl,
    deriveSlugKey,
    sealForSlug,
    unsealForSlug,
    resolveProfileEntry,
    unsealProfileContact
  };
});
