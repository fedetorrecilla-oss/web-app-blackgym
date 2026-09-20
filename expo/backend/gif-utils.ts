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
// normalizeGifFrameDelays re-times every frame to a small uniform delay
// (default 90ms) so the exact same frames play back as continuous motion
// instead of hold-flip-hold-flip. It's a pure in-place byte patch of each
// Graphic Control Extension's delay field — same frames, same file size,
// no re-encoding of the (unrelated) LZW-compressed pixel data — so there's
// zero quality loss and no new dependency.

const GCE_LABEL = 0xf9; // Graphic Control Extension
const EXTENSION_INTRODUCER = 0x21;
const IMAGE_DESCRIPTOR = 0x2c;
const TRAILER = 0x3b;

/**
 * Rewrites the per-frame delay of every frame in a GIF to `delayCentiseconds`
 * (GIF delay units are 1/100s; 9 -> 90ms). Returns a new Buffer; the input
 * is not mutated. If the input isn't a well-formed GIF, it's returned
 * unchanged (best-effort — we never want a bad parse to corrupt an image).
 */
export function normalizeGifFrameDelays(input: Buffer, delayCentiseconds = 9): Buffer {
  if (input.length < 13 || input.toString("ascii", 0, 3) !== "GIF") {
    return input;
  }

  const bytes = Buffer.from(input); // copy — never mutate the caller's buffer
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

  try {
    while (i < bytes.length) {
      const blockId = bytes[i];

      if (blockId === EXTENSION_INTRODUCER) {
        const label = bytes[i + 1];
        if (label === GCE_LABEL) {
          const blockSize = bytes[i + 2]; // spec-fixed at 4, but read it anyway
          // Delay time is a little-endian uint16 at offset i+4/i+5.
          bytes.writeUInt16LE(delayCentiseconds, i + 4);
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
        // Unknown/unexpected block — bail out rather than risk corrupting
        // the file; caller gets back what we've patched so far is fine
        // since we only ever overwrite existing delay bytes in place.
        break;
      }
    }
  } catch {
    // Any out-of-bounds read means our parse assumptions didn't hold for
    // this file — return the (still valid, just un-retimed) original.
    return input;
  }

  return bytes;
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
