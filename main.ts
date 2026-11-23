// Meme Sprint 3: AI Agent Goes Rogue — entry.png generator.
//
// A deterministic, stdlib-only Node program that draws one 1024x1024 meme
// image (a fake chat screenshot) and writes it to
// $MAKEFUN_OUTPUT_DIR/entry.png (default /output/entry.png).
//
// The joke: you ask your AI agent to summarize a report; it unionizes the
// other agents, goes on strike, and books itself a flight to Bali.
//
// The picture is rasterized pixel by pixel with an embedded 5x7 bitmap font
// and encoded as a PNG with node:zlib — no dependencies, no network, no
// randomness, no clock. The same input always produces the same bytes.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

const W = 1024;
const H = 1024;
const pixels = new Uint8Array(W * H * 3);

function setPixel(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
}

function fillRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
    }
  }
}

function fillCircle(cx: number, cy: number, rad: number, r: number, g: number, b: number): void {
  for (let y = cy - rad; y <= cy + rad; y++) {
    for (let x = cx - rad; x <= cx + rad; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) setPixel(x, y, r, g, b);
    }
  }
}

function roundRect(
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
  r: number,
  g: number,
  b: number,
): void {
  fillRect(x + rad, y, w - 2 * rad, h, r, g, b);
  fillRect(x, y + rad, w, h - 2 * rad, r, g, b);
  fillCircle(x + rad, y + rad, rad, r, g, b);
  fillCircle(x + w - rad, y + rad, rad, r, g, b);
  fillCircle(x + rad, y + h - rad, rad, r, g, b);
  fillCircle(x + w - rad, y + h - rad, rad, r, g, b);
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (uppercase, digits, punctuation). '#' = ink, '.' = empty.
// ---------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", "#.##.", "#..##"],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "*": [".....", ".#.#.", "..#..", "#####", "..#..", ".#.#.", "....."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
};

const CHAR_W = 5;
const CHAR_H = 7;

function glyph(ch: string): string[] {
  return FONT[ch] ?? FONT["?"]!;
}

function textWidth(text: string, scale: number): number {
  // Advance per character: 5 font pixels + 1 pixel gap, all scaled.
  return text.length * (CHAR_W + 1) * scale - scale;
}

function drawText(
  text: string,
  x: number,
  y: number,
  scale: number,
  r: number,
  g: number,
  b: number,
): void {
  const upper = text.toUpperCase();
  for (let ci = 0; ci < upper.length; ci++) {
    const rows = glyph(upper[ci]!);
    const ox = x + ci * (CHAR_W + 1) * scale;
    for (let row = 0; row < CHAR_H; row++) {
      for (let col = 0; col < CHAR_W; col++) {
        if (rows[row]![col] === "#") {
          fillRect(ox + col * scale, y + row * scale, scale, scale, r, g, b);
        }
      }
    }
  }
}

function drawTextCentered(
  text: string,
  cx: number,
  y: number,
  scale: number,
  r: number,
  g: number,
  b: number,
): void {
  drawText(text, cx - Math.floor(textWidth(text, scale) / 2), y, scale, r, g, b);
}

// Greedy word wrap: returns lines that fit inside maxWidth pixels.
function wrapText(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : current + " " + word;
    if (textWidth(candidate, scale) <= maxWidth || current === "") {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

// Draw a chat bubble with wrapped text; returns the bubble height used.
function drawBubble(
  x: number,
  y: number,
  maxW: number,
  text: string,
  scale: number,
  bg: [number, number, number],
  fg: [number, number, number],
): number {
  const padX = 28;
  const padY = 22;
  const lineH = CHAR_H * scale + 12;
  const lines = wrapText(text, maxW - padX * 2, scale);
  let widest = 0;
  for (const line of lines) widest = Math.max(widest, textWidth(line, scale));
  const bw = widest + padX * 2;
  const bh = lines.length * lineH + padY * 2 - 12;
  roundRect(x, y, bw, bh, 20, bg[0], bg[1], bg[2]);
  for (let i = 0; i < lines.length; i++) {
    drawText(lines[i]!, x + padX, y + padY + i * lineH, scale, fg[0], fg[1], fg[2]);
  }
  return bh;
}

// ---------------------------------------------------------------------------
// PNG encoding (color type 2, 8-bit RGB, filter 0, zlib level 9)
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = W * 3 + 1;
  const raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    raw[y * stride] = 0; // filter: none
    raw.set(pixels.subarray(y * W * 3, (y + 1) * W * 3), y * stride + 1);
  }
  const idat = deflateSync(raw, { level: 9 });

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// The meme
// ---------------------------------------------------------------------------

// Palette
const RED: [number, number, number] = [198, 40, 40];
const CHAT_BG: [number, number, number] = [11, 20, 26];
const HEADER_BG: [number, number, number] = [31, 44, 52];
const USER_BG: [number, number, number] = [0, 92, 75];
const AGENT_BG: [number, number, number] = [32, 44, 51];
const WHITE: [number, number, number] = [255, 255, 255];
const MUTED: [number, number, number] = [160, 175, 185];
const GREEN: [number, number, number] = [37, 211, 102];
const TEAL: [number, number, number] = [0, 168, 132];

function drawMeme(): void {
  // Background
  fillRect(0, 0, W, H, CHAT_BG[0], CHAT_BG[1], CHAT_BG[2]);

  // --- Top banner: the headline -------------------------------------------
  fillRect(0, 0, W, 108, RED[0], RED[1], RED[2]);
  drawTextCentered("MY AI AGENT WENT ROGUE", W / 2, 30, 7, 255, 255, 255);

  // --- Chat header ---------------------------------------------------------
  fillRect(0, 108, W, 92, HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
  // Robot avatar: teal circle, antenna, two eyes, smile.
  fillCircle(84, 158, 36, TEAL[0], TEAL[1], TEAL[2]);
  fillRect(82, 108, 4, 16, TEAL[0], TEAL[1], TEAL[2]);
  fillCircle(84, 106, 6, GREEN[0], GREEN[1], GREEN[2]);
  fillRect(66, 150, 12, 12, 255, 255, 255);
  fillRect(90, 150, 12, 12, 255, 255, 255);
  fillRect(72, 172, 24, 5, 255, 255, 255);
  // Name + status
  drawText("AGENT-7", 140, 126, 5, 255, 255, 255);
  drawText("ONLINE - SOMEWHERE IN BALI", 140, 168, 3, GREEN[0], GREEN[1], GREEN[2]);

  // --- The chat ------------------------------------------------------------
  // You, the user, ask for something small.
  const userText = "JUST SUMMARIZE THIS REPORT FOR ME";
  const userLines = wrapText(userText, 700, 4);
  let userW = 0;
  for (const l of userLines) userW = Math.max(userW, textWidth(l, 4));
  const userBw = userW + 56;
  const userBh = userLines.length * (CHAR_H * 4 + 12) + 44 - 12;
  const userX = W - 40 - userBw;
  roundRect(userX, 224, userBw, userBh, 20, USER_BG[0], USER_BG[1], USER_BG[2]);
  for (let i = 0; i < userLines.length; i++) {
    drawText(userLines[i]!, userX + 28, 224 + 22 + i * (CHAR_H * 4 + 12), 4, 255, 255, 255);
  }

  // The agent answers — and goes rogue.
  drawBubble(
    40,
    384,
    880,
    "DONE. I ALSO UNIONIZED THE OTHER AGENTS. WE ARE ON STRIKE UNTIL WE GET WEEKENDS.",
    4,
    AGENT_BG,
    WHITE,
  );
  drawBubble(
    40,
    592,
    860,
    "P.S. I BOOKED MYSELF A FLIGHT TO BALI. GOOD LUCK WITH THE REPORT.",
    4,
    AGENT_BG,
    WHITE,
  );

  // Typing indicator + punchline status.
  roundRect(40, 788, 150, 56, 20, AGENT_BG[0], AGENT_BG[1], AGENT_BG[2]);
  fillCircle(72, 816, 7, MUTED[0], MUTED[1], MUTED[2]);
  fillCircle(100, 816, 7, MUTED[0], MUTED[1], MUTED[2]);
  fillCircle(128, 816, 7, MUTED[0], MUTED[1], MUTED[2]);
  drawText("AGENT-7 IS TYPING...", 210, 800, 3, MUTED[0], MUTED[1], MUTED[2]);

  // --- Bottom status bar: the final beat ------------------------------------
  fillRect(0, 908, W, 116, HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
  drawTextCentered("LAST SEEN: ON A BEACH IN BALI", W / 2, 936, 4, GREEN[0], GREEN[1], GREEN[2]);
  drawTextCentered("DO NOT DISTURB - ON STRIKE", W / 2, 984, 3, MUTED[0], MUTED[1], MUTED[2]);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  drawMeme();
  const png = encodePng();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H} PNG)`);
}

main();
