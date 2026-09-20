// Utilities for post-processing GIFs downloaded from ExerciseDB.
//
// The free ExerciseDB ("Basic", $0/mo) plan's demonstration GIFs are
// genuinely animated (they're not broken or single-frame), but they're
// timed as "hold end position → quick transition → hold other end position
// → quick transition back", with the two long holds eating ~2 of every 3
// seconds of the loop. To a viewer that reads as "it's just flipping
// between two photos" rather than a moving exercise demo, even though the
// underlying frames are real. Confirmed by parsing an imported GIF's actual
// GIF89a block structure: 12 real frames, but delays like
// [100,10,10,10,10,10,100,10,10,10,10,10] (in 1/100s units) — i.e. two
// 1-second holds bracketing two 0.5s transition bursts.
//
// normalizeGifFrameDelays fixes this WITHOUT changing the total loop time
// (whoever built the GIF presumably tuned that to roughly match how long a
// real rep takes): it sums the original per-frame delays and redistributes
// that same total evenly across every frame, clamped to a sane per-frame
// range. So a 12-frame GIF whose delays summed to 3.0s ends up at a smooth,
// even 250ms/frame — same overall pace, no more hold-flip-hold-flip. A
// first version of this used a fixed ~90ms/frame, which was fast enough
// (11fps, cramming a whole rep into ~1s) to look choppy/stepped rather than
// fluid — that's what "queda entrecortado" was pointing at.
//
// It's a pure in-place byte patch of each Graphic Control Extension's delay
// field — same frames, same file size, no re-encoding of the (unrelated)
// LZW-compressed pixel data — so there's zero quality loss and no new
// dependency.

const GCE_LABEL = 0xf9; // Graphic Control Extension
const EXTENSION_INTRODUCER = 0x21;
const IMAGE_DESCRIPTOR = 0x2c;
const TRAILER = 0x3b;

// Per-frame delay bounds after redistribution, in centiseconds (1/100s).
// Floor avoids an unnaturally-fast strobe if the original total was tiny;
// ceiling avoids sluggishness if it was unusually long. 3.0s/12 = 25cs sits
// comfortably inside this range.
const MIN_DELAY_CS = 6; // 60ms (~16.7fps) — guards against a near-zero original total
const MAX_DELAY_CS = 40; // 400ms (2.5fps) — generous ceiling, guards against a pathologically long original total
const FALLBACK_DELAY_CS = 10; // used only if the file had no GCE delays at all

/**
 * Redistributes a GIF's total animation time evenly across all its frames,
 * instead of whatever hold/burst pattern it originally had. Keeps the same
 * overall loop duration (sum of original delays), same frame count, same
 * pixel data — only the per-frame timing changes. Returns a new Buffer; the
 * input is not mutated. If the input isn't a well-formed GIF, or something
 * about its structure doesn't match our parsing assumptions, it's returned
 * unchanged (best-effort — we never want a bad parse to corrupt an image).
 */
export function normalizeGifFrameDelays(input: Buffer): Buffer {
  if (input.length < 13 || input.toString("ascii", 0, 3) !== "GIF") {
    return input;
  }

  const bytes = Buffer.from(input); // copy — never mutate the caller's buffer

  try {
    const gceOffsets = findGraphicControlExtensionOffsets(bytes);
    if (gceOffsets.length === 0) return input;

    const totalDelayCs = gceOffsets.reduce((sum, off) => sum + bytes.readUInt16LE(off + 4), 0);
    const evenDelayCs =
      totalDelayCs > 0
        ? clamp(Math.round(totalDelayCs / gceOffsets.length), MIN_DELAY_CS, MAX_DELAY_CS)
        : FALLBACK_DELAY_CS;

    for (const off of gceOffsets) {
      bytes.writeUInt16LE(evenDelayCs, off + 4);
    }
  } catch {
    // Any out-of-bounds read means our parse assumptions didn't hold for
    // this file — return the (still valid, just un-retimed) original.
    return input;
  }

  return bytes;
}

/** Walks the GIF89a block structure and returns the byte offset of each
 *  Graphic Control Extension's introducer (0x21) — its delay time field is
 *  always at offset+4/offset+5, little-endian. */
function findGraphicControlExtensionOffsets(bytes: Buffer): number[] {
  let i = 6;
  i += 2; // logical screen width
  i += 2; // logical screen height
  const packed = bytes[i];
  const gctFlag = (packed & 0x80) !== 0;
  const gctSize = 2 << (packed & 0x07);
  i += 1; // packed fields
  i += 1; // background color index
  i += 1; // pixel aspect ratio
  if (gctFlag) i += gctSize * 3;

  const offsets: number[] = [];

  while (i < bytes.length) {
    const blockId = bytes[i];

    if (blockId === EXTENSION_INTRODUCER) {
      const label = bytes[i + 1];
      if (label === GCE_LABEL) {
        const blockSize = bytes[i + 2]; // spec-fixed at 4, but read it anyway
        offsets.push(i);
        i += 2 + 1 + blockSize + 1; // introducer+label, size byte, data, terminator
      } else {
        i += 2;
        i = skipSubBlocks(bytes, i);
      }
    } else if (blockId === IMAGE_DESCRIPTOR) {
      i += 1 + 2 + 2 + 2 + 2; // descriptor id, left, top, width, height
      const imgPacked = bytes[i];
      i += 1;
      const lctFlag = (imgPacked & 0x80) !== 0;
      const lctSize = 2 << (imgPacked & 0x07);
      if (lctFlag) i += lctSize * 3;
      i += 1; // LZW minimum code size
      i = skipSubBlocks(bytes, i);
    } else if (blockId === TRAILER) {
      break;
    } else {
      // Unknown/unexpected block — bail out rather than risk misreading
      // the rest of the file.
      break;
    }
  }

  return offsets;
}

function skipSubBlocks(bytes: Buffer, start: number): number {
  let i = start;
  while (true) {
    const size = bytes[i];
    i += 1;
    if (size === 0) break;
    i += size;
  }
  return i;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
