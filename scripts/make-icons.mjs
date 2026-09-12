#!/usr/bin/env node
/**
 * Vygeneruje PNG ikony pro PWA z vektorové favicony.
 *
 * Kreslí se ručně do PNG bez knihovny: ikona je čtyři zaoblené čtverce
 * na tmavém pozadí, takže na ni stačí pár obdélníků a vlastní zápis PNG.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUT = resolve(import.meta.dirname, '../apps/portal/public');

// Barvy odpovídají tokenům (D-015): pozadí `noc`, dlaždice `original`,
// `logika`, `arkady` a `akce` — stejná čtveřice jako logo v hlavičce.
const BACKGROUND = [0x08, 0x09, 0x0c];
const TILES = [
  { color: [0x10, 0xb9, 0x81] },
  { color: [0x81, 0x8c, 0xf8] },
  { color: [0xf9, 0x73, 0x16] },
  { color: [0xf4, 0x3f, 0x5e] },
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function renderIcon(size) {
  // RGB rastr; každý řádek začíná filtrovým bajtem 0.
  const rows = [];
  // Maskovatelná ikona potřebuje volný okraj, proto dlaždice zabírají
  // jen prostřední 60 % plochy.
  const pad = Math.round(size * 0.2);
  const inner = size - pad * 2;
  const gap = Math.round(inner * 0.06);
  const tile = Math.round((inner - gap) / 2);
  const radius = Math.round(tile * 0.22);

  const inTile = (x, y, tx, ty) => {
    const lx = x - tx;
    const ly = y - ty;
    if (lx < 0 || ly < 0 || lx >= tile || ly >= tile) return false;
    // Zaoblené rohy
    const cx = lx < radius ? radius - lx : lx >= tile - radius ? lx - (tile - radius - 1) : 0;
    const cy = ly < radius ? radius - ly : ly >= tile - radius ? ly - (tile - radius - 1) : 0;
    return cx * cx + cy * cy <= radius * radius;
  };

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      let color = BACKGROUND;
      const positions = [
        [pad, pad], [pad + tile + gap, pad],
        [pad, pad + tile + gap], [pad + tile + gap, pad + tile + gap],
      ];
      for (let i = 0; i < 4; i++) {
        const [tx, ty] = positions[i];
        if (inTile(x, y, tx, ty)) {
          color = TILES[i].color;
          break;
        }
      }
      row[1 + x * 3] = color[0];
      row[2 + x * 3] = color[1];
      row[3 + x * 3] = color[2];
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bitová hloubka
  ihdr[9] = 2;  // barevný typ RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const file = resolve(OUT, `icon-${size}.png`);
  writeFileSync(file, renderIcon(size));
  console.log(`✓ ${file}`);
}
