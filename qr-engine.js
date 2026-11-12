/**
 * Smart Wallet Cards — Zero-Dependency ISO/IEC 18004 QR Code Engine (qr-engine.js)
 * Universal module for Browser (SVG & HTML5 Canvas) and Node.js (Terminal ANSI & SVG).
 * Supports QR Versions 1..40, Byte Mode (UTF-8), Error Correction Levels L, M, Q, H.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SmartWalletQR = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Error Correction Level constants
  const ECC_LEVELS = {
    L: { ordinal: 0, formatBits: 1 },
    M: { ordinal: 1, formatBits: 0 },
    Q: { ordinal: 2, formatBits: 3 },
    H: { ordinal: 3, formatBits: 2 }
  };

  // Number of error correction codewords per block for Versions 1..40 and ECC levels L, M, Q, H
  const EC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];

  // Number of error correction blocks for Versions 1..40 and ECC levels L, M, Q, H
  const NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];

  function toUtf8ByteArray(str) {
    str = encodeURI(str);
    const result = [];
    for (let i = 0; i < str.length; i++) {
      if (str.charAt(i) !== '%') {
        result.push(str.charCodeAt(i));
      } else {
        result.push(parseInt(str.substr(i + 1, 2), 16));
        i += 2;
      }
    }
    return result;
  }

  function appendBits(val, len, bb) {
    for (let i = len - 1; i >= 0; i--) {
      bb.push((val >>> i) & 1);
    }
  }

  function getBit(x, i) {
    return ((x >>> i) & 1) !== 0;
  }

  function getNumRawDataModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function getNumDataCodewords(ver, ecl) {
    return (
      Math.floor(getNumRawDataModules(ver) / 8) -
      EC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver]
    );
  }

  function reedSolomonMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function reedSolomonComputeDivisor(degree) {
    const result = [];
    for (let i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = reedSolomonMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = reedSolomonMultiply(root, 0x02);
    }
    return result;
  }

  function reedSolomonComputeRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
      const factor = b ^ result.shift();
      result.push(0);
      divisor.forEach((coef, i) => {
        result[i] ^= reedSolomonMultiply(coef, factor);
      });
    }
    return result;
  }

  function getAlignmentPatternPositions(ver) {
    if (ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) {
      result.splice(1, 0, pos);
    }
    return result;
  }

  function encodeMatrix(text, ecLevelChar) {
    const ecl = ECC_LEVELS[String(ecLevelChar || 'M').toUpperCase()] || ECC_LEVELS.M;
    const dataBytes = toUtf8ByteArray(String(text));
    const bitLen = dataBytes.length * 8;

    let version = 1;
    let dataCapacityBits = 0;
    for (version = 1; version <= 40; version++) {
      dataCapacityBits = getNumDataCodewords(version, ecl) * 8;
      const ccBits = version <= 9 ? 8 : 16;
      if (4 + ccBits + bitLen <= dataCapacityBits) break;
    }
    if (version > 40) {
      throw new Error('QR payload exceeds maximum capacity');
    }

    const bb = [];
    // Byte mode indicator (0100)
    appendBits(0b0100, 4, bb);
    appendBits(dataBytes.length, version <= 9 ? 8 : 16, bb);
    for (const b of dataBytes) appendBits(b, 8, bb);

    // Terminator bits
    appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
    appendBits(0, (8 - (bb.length % 8)) % 8, bb);
    for (let padByte = 0xec; bb.length < dataCapacityBits; padByte ^= 0xec ^ 0x11) {
      appendBits(padByte, 8, bb);
    }

    const dataCodewords = [];
    for (let i = 0; i < bb.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bb[i + j];
      dataCodewords.push(byte);
    }

    // Add Reed-Solomon ECC and interleave
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][version];
    const blockEcLen = EC_CODEWORDS_PER_BLOCK[ecl.ordinal][version];
    const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);

    const blocks = [];
    const rsDiv = reedSolomonComputeDivisor(blockEcLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = dataCodewords.slice(k, k + shortBlockLen - blockEcLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = reedSolomonComputeRemainder(dat, rsDiv);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }

    const allCodewords = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEcLen || j >= numShortBlocks) {
          allCodewords.push(block[i]);
        }
      });
    }

    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => Array(size).fill(false));
    const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

    function setFunctionModule(x, y, isDark) {
      modules[y][x] = isDark;
      isFunction[y][x] = true;
    }

    function drawFinderPattern(x, y) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) {
            setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
          }
        }
      }
    }

    function drawAlignmentPattern(x, y) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }

    // Timing patterns
    for (let i = 0; i < size; i++) {
      setFunctionModule(6, i, i % 2 === 0);
      setFunctionModule(i, 6, i % 2 === 0);
    }

    // Finder patterns
    drawFinderPattern(3, 3);
    drawFinderPattern(size - 4, 3);
    drawFinderPattern(3, size - 4);

    // Alignment patterns
    const alignPatPos = getAlignmentPatternPositions(version);
    const numAlign = alignPatPos.length;
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        if (!((i === 0 && j === 0) || (i === 0 && j === numAlign - 1) || (i === numAlign - 1 && j === 0))) {
          drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
        }
      }
    }

    // Reserve format bits
    for (let i = 0; i <= 5; i++) setFunctionModule(8, i, false);
    setFunctionModule(8, 7, false);
    setFunctionModule(8, 8, false);
    setFunctionModule(7, 8, false);
    for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, false);
    for (let i = 0; i < 8; i++) setFunctionModule(size - 1 - i, 8, false);
    for (let i = 8; i < 15; i++) setFunctionModule(8, size - 15 + i, false);
    setFunctionModule(8, size - 8, true);

    // Version bits (Version >= 7)
    if (version >= 7) {
      let rem = version;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = getBit(bits, i);
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunctionModule(a, b, bit);
        setFunctionModule(b, a, bit);
      }
    }

    // Draw codewords in zig-zag scan
    let bitIdx = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunction[y][x] && bitIdx < allCodewords.length * 8) {
            modules[y][x] = getBit(allCodewords[bitIdx >>> 3], 7 - (bitIdx & 7));
            bitIdx++;
          }
        }
      }
    }

    function drawFormatBits(mask) {
      const data = (ecl.formatBits << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((data << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setFunctionModule(8, i, getBit(bits, i));
      setFunctionModule(8, 7, getBit(bits, 6));
      setFunctionModule(8, 8, getBit(bits, 7));
      setFunctionModule(7, 8, getBit(bits, 8));
      for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, getBit(bits, i));
      for (let i = 0; i < 8; i++) setFunctionModule(size - 1 - i, 8, getBit(bits, i));
      for (let i = 8; i < 15; i++) setFunctionModule(8, size - 15 + i, getBit(bits, i));
      setFunctionModule(8, size - 8, true);
    }

    function applyMask(mask) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (isFunction[y][x]) continue;
          let invert = false;
          switch (mask) {
            case 0: invert = (x + y) % 2 === 0; break;
            case 1: invert = y % 2 === 0; break;
            case 2: invert = x % 3 === 0; break;
            case 3: invert = (x + y) % 3 === 0; break;
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
            case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
            case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          }
          if (invert) modules[y][x] = !modules[y][x];
        }
      }
    }

    function computePenalty() {
      let score = 0;
      for (let y = 0; y < size; y++) {
        let runColor = false, runX = 0;
        let runColorY = false, runY = 0;
        for (let x = 0; x < size; x++) {
          if (modules[y][x] === runColor) {
            runX++;
            if (runX === 5) score += 3;
            else if (runX > 5) score++;
          } else {
            runColor = modules[y][x];
            runX = 1;
          }
          if (modules[x][y] === runColorY) {
            runY++;
            if (runY === 5) score += 3;
            else if (runY > 5) score++;
          } else {
            runColorY = modules[x][y];
            runY = 1;
          }
        }
      }
      for (let y = 0; y < size - 1; y++) {
        for (let x = 0; x < size - 1; x++) {
          const c = modules[y][x];
          if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) {
            score += 3;
          }
        }
      }
      return score;
    }

    let bestMask = 0;
    let minPenalty = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m);
      drawFormatBits(m);
      const p = computePenalty();
      if (p < minPenalty) {
        minPenalty = p;
        bestMask = m;
      }
      applyMask(m); // revert
    }
    applyMask(bestMask);
    drawFormatBits(bestMask);

    return {
      version,
      size,
      modules
    };
  }

  /**
   * Generates a crisp inline SVG string for the given QR payload.
   */
  function toSvgString(text, options) {
    const opts = Object.assign(
      {
        ecLevel: 'M',
        margin: 2,
        darkColor: '#071529',
        lightColor: '#FFFFFF',
        rounded: true
      },
      options || {}
    );
    const qr = encodeMatrix(text, opts.ecLevel);
    const total = qr.size + opts.margin * 2;
    let paths = '';
    const r = opts.rounded ? 0.16 : 0;

    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.modules[y][x]) {
          const px = x + opts.margin;
          const py = y + opts.margin;
          if (r > 0) {
            paths += `<rect x="${px}" y="${py}" width="1" height="1" rx="${r}" ry="${r}" />`;
          } else {
            paths += `M${px},${py}h1v1h-1z`;
          }
        }
      }
    }

    const body =
      r > 0
        ? `<g fill="${opts.darkColor}" shape-rendering="geometricPrecision">${paths}</g>`
        : `<path d="${paths}" fill="${opts.darkColor}" shape-rendering="crispEdges"/>`;

    const bgRect =
      opts.lightColor && opts.lightColor !== 'transparent'
        ? `<rect width="100%" height="100%" rx="1.5" ry="1.5" fill="${opts.lightColor}"/>`
        : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="100%" height="100%" role="img" aria-label="QR Code">${bgRect}${body}</svg>`;
  }

  /**
   * Draws a high-resolution QR code onto a 2D Canvas context at (x, y, pixelSize, pixelSize).
   */
  function drawOnCanvas(ctx, text, x, y, pixelSize, options) {
    const opts = Object.assign(
      {
        ecLevel: 'M',
        margin: 2,
        darkColor: '#071529',
        lightColor: '#FFFFFF',
        borderRadius: 16
      },
      options || {}
    );

    const qr = encodeMatrix(text, opts.ecLevel);
    const totalModules = qr.size + opts.margin * 2;
    const cellSize = pixelSize / totalModules;

    ctx.save();
    // Draw rounded background pad if not transparent
    if (opts.lightColor && opts.lightColor !== 'transparent') {
      ctx.fillStyle = opts.lightColor;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, pixelSize, pixelSize, opts.borderRadius);
      } else {
        ctx.rect(x, y, pixelSize, pixelSize);
      }
      ctx.fill();
    }

    ctx.fillStyle = opts.darkColor;
    for (let r = 0; r < qr.size; r++) {
      for (let c = 0; c < qr.size; c++) {
        if (qr.modules[r][c]) {
          const rx = x + (c + opts.margin) * cellSize;
          const ry = y + (r + opts.margin) * cellSize;
          ctx.fillRect(Math.floor(rx), Math.floor(ry), Math.ceil(cellSize), Math.ceil(cellSize));
        }
      }
    }
    ctx.restore();
    return qr;
  }

  /**
   * Renders a compact UTF-8 half-block QR code for terminal CLI output (wallet-api.js).
   */
  function toTerminalString(text, options) {
    const opts = Object.assign({ ecLevel: 'L', margin: 2 }, options || {});
    const qr = encodeMatrix(text, opts.ecLevel);
    const total = qr.size + opts.margin * 2;

    function isDark(x, y) {
      const mx = x - opts.margin;
      const my = y - opts.margin;
      if (mx < 0 || mx >= qr.size || my < 0 || my >= qr.size) return false;
      return qr.modules[my][mx];
    }

    const lines = [];
    for (let y = 0; y < total; y += 2) {
      let line = '  ';
      for (let x = 0; x < total; x++) {
        const top = isDark(x, y);
        const bot = y + 1 < total ? isDark(x, y + 1) : false;
        if (top && bot) line += ' ';
        else if (top && !bot) line += '▄';
        else if (!top && bot) line += '▀';
        else line += '█';
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  return {
    encodeMatrix,
    toSvgString,
    drawOnCanvas,
    toTerminalString
  };
});
