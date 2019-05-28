/**
 * Implementation of Myers' online approximate string matching algorithm [1].
 *
 * This has O((k/w) * n) complexity where `n` is the length of the text, `k` is
 * the maximum number of errors allowed (always <= the pattern length) and `w`
 * is the word size. Because JS only supports bitwise operations on 32 bit
 * integers, `w` is 32.
 *
 * As far as I am aware, there aren't any online algorithms which are
 * significantly better for a wide range of input parameters. The problem can be
 * solved faster using "filter then verify" approaches which first filter out
 * regions of the text that cannot match using a "cheap" check and then verify
 * the remaining potential matches. The verify step requires an algorithm such
 * as this one however.
 *
 * The algorithm's approach is essentially to optimize the classic dynamic
 * programming solution to the problem by computing columns of the matrix in
 * word-sized chunks (ie. dealing with 32 chars of the pattern at a time) and
 * avoiding calculating regions of the matrix where the minimum error count is
 * guaranteed to exceed the input threshold.
 *
 * The paper consists of two parts, the first describes the core algorithm for
 * matching patterns <= the size of a word (implemented by `advanceBlock` here).
 * The second uses the core algorithm as part of a larger block-based algorithm
 * to handle longer patterns.
 *
 * [1] G. Myers, “A Fast Bit-Vector Algorithm for Approximate String Matching
 * Based on Dynamic Programming,” vol. 46, no. 3, pp. 395–415, 1999.
 */

/**
 * Represents a match returned by a call to `search`.
 */
export interface Match {
  /** Start offset within the text string of the match. */
  start: number;
  /** End offset within the text string of the match. */
  end: number;
  /**
   * The number of differences (insertions, deletions or substitutions) between
   * the pattern and the approximate match in the text.
   */
  errors: number;
}

function reverse(s: string) {
  return s
    .split("")
    .reverse()
    .join("");
}

/**
 * Given the ends of approximate matches for `pattern` in `text`, find
 * the start of the matches.
 *
 * @param findEndFn - Function for finding the end of matches in
 * text.
 * @return Matches with the `start` property set.
 */
function findMatchStarts(
  text: string,
  pattern: string,
  matches: Match[],
  findEndFn: (t: string, p: string, k: number) => Match[]
) {
  const minCost = Math.min(...matches.map(m => m.errors));
  return matches
    .filter(m => m.errors === minCost)
    .map(m => {
      // Find start of each match by reversing the pattern and matching segment
      // of text and searching for an approx match with the same number of
      // errors.
      const minStart = Math.max(0, m.end - pattern.length - m.errors);
      const textRev = reverse(text.slice(minStart, m.end));
      const patRev = reverse(pattern);

      // If there are multiple possible start points, choose the one that
      // maximizes the length of the match.
      const start = findEndFn(textRev, patRev, m.errors).reduce((min, rm) => {
        if (m.end - rm.end < min) {
          return m.end - rm.end;
        }
        return min;
      }, m.end);

      return {
        start,
        end: m.end,
        errors: m.errors
      };
    });
}

/**
 * Internal context used when calculating blocks of a column.
 */
interface Context {
  /**
   * Bit-arrays of positive vertical deltas.
   *
   * ie. `P[b][i]` is set if the vertical delta for the i'th row in the b'th
   * block is positive.
   */
  P: Uint32Array;
  /** Bit-arrays of negative vertical deltas. */
  M: Uint32Array;
  /**
   * Map of alphabet character value to bit-arrays indicating where that
   * character appears in the pattern.
   *
   * ie. `peq[v][b][i]` is set if the i'th character in the b'th segment of the
   * pattern is equal to the character value `v`, where 'v' is the result of
   * String.charCodeAt(...).
   */
  peq: Map<number, Uint32Array>;
  /** Bit masks with a single bit set indicating the last row in each block. */
  lastRowMask: Uint32Array;
}

/**
 * Block calculation step of the algorithm.
 *
 * From Fig 8. on p. 408 of [1].
 *
 * @param ctx - The pattern context object
 * @param peq - The `peq` array for the current character (`ctx.peq.get(ch)`)
 * @param b - The block level
 * @param hIn - Horizontal input delta ∈ {1,0,-1}
 * @return Horizontal output delta
 */
function advanceBlock(ctx: Context, peq: Uint32Array, b: number, hIn: number) {
  let pV = ctx.P[b];
  let mV = ctx.M[b];
  let eq = peq[b];
  let hOut = 0;

  // Step 1: Compute horizontal deltas.
  const xV = eq | mV;
  if (hIn < 0) {
    eq |= 1;
  }
  const xH = (((eq & pV) + pV) ^ pV) | eq;

  let pH = mV | ~(xH | pV);
  let mH = pV & xH;

  // Step 2: Update score (value of last row of this block).
  if (pH & ctx.lastRowMask[b]) {
    hOut += 1;
  } else if (mH & ctx.lastRowMask[b]) {
    hOut -= 1;
  }

  // Step 3: Update vertical deltas for use when processing next char.
  pH <<= 1;
  mH <<= 1;

  if (hIn < 0) {
    mH |= 1;
  } else if (hIn > 0) {
    pH |= 1;
  }

  pV = mH | ~(xV | pH);
  mV = pH & xV;

  ctx.P[b] = pV;
  ctx.M[b] = mV;

  return hOut;
}

/**
 * Find the ends and error counts for matches of `pattern` in `text`.
 *
 * This is the block-based search algorithm from Fig. 9 on p.410 of [1].
 */
function findMatchEnds(text: string, pattern: string, maxErrors: number) {
  if (pattern.length === 0) {
    return [];
  }

  // Clamp error count so we can rely on the `maxErrors` and `pattern.length`
  // rows being in the same block below.
  maxErrors = Math.min(maxErrors, pattern.length);

  const matches = [];

  // Word size.
  const w = 32;

  // Index of maximum block level.
  const bMax = Math.ceil(pattern.length / w) - 1;

  // Context used across block calculations.
  const ctx = {
    bMax,
    P: new Uint32Array(bMax + 1),
    M: new Uint32Array(bMax + 1),
    peq: new Map<number, Uint32Array>(),
    lastRowMask: new Uint32Array(bMax + 1)
  };
  ctx.lastRowMask.fill(1 << 31);
  ctx.lastRowMask[bMax] = 1 << (pattern.length - 1) % w;

  // Calculate `ctx.peq` - a map of character values to bitmasks indicating
  // positions of that character within the pattern, where each bit represents
  // a position in the pattern.
  for (let c = 0; c < pattern.length; c += 1) {
    const val = pattern.charCodeAt(c);
    if (ctx.peq.has(val)) {
      // Duplicate char in pattern.
      continue;
    }

    const peq = new Uint32Array(bMax + 1);
    ctx.peq.set(val, peq);
    for (let b = 0; b <= bMax; b += 1) {
      peq[b] = 0;

      // Set all the bits where the pattern matches the current char (ch).
      // For indexes beyond the end of the pattern, always set the bit as if the
      // pattern contained a wildcard char in that position.
      for (let r = 0; r < w; r += 1) {
        const idx = b * w + r;
        if (idx >= pattern.length) {
          continue;
        }

        const match = pattern.charCodeAt(idx) === val;
        if (match) {
          peq[b] |= 1 << r;
        }
      }
    }
  }

  // Dummy "peq" array for chars in the text which do not occur in the pattern.
  const emptyPeq = new Uint32Array(bMax + 1);

  // Index of last-active block level in the column.
  let y = Math.max(0, Math.ceil(maxErrors / w) - 1);

  // Initialize maximum error count at bottom of each block.
  const score = new Uint32Array(bMax + 1);
  for (let b = 0; b <= y; b += 1) {
    score[b] = (b + 1) * w;
  }
  score[bMax] = pattern.length;

  // Initialize vertical deltas for each block.
  for (let b = 0; b <= y; b += 1) {
    ctx.P[b] = ~0;
    ctx.M[b] = 0;
  }

  // Process each char of the text, computing the error count for `w` chars of
  // the pattern at a time.
  for (let j = 0; j < text.length; j += 1) {
    // Lookup the bitmask representing the positions of the current char from
    // the text within the pattern.
    let peq = ctx.peq.get(text.charCodeAt(j));
    if (typeof peq === "undefined") {
      peq = emptyPeq;
    }

    // Calculate error count for blocks that we definitely have to process for
    // this column.
    let carry = 0;
    for (let b = 0; b <= y; b += 1) {
      carry = advanceBlock(ctx, peq, b, carry);
      score[b] += carry;
    }

    // Check if we also need to compute an additional block, or if we can reduce
    // the number of blocks processed for the next column.
    if (
      score[y] - carry <= maxErrors &&
      y < ctx.bMax &&
      (peq[y + 1] & 1 || carry < 0)
    ) {
      // Error count for bottom block is under threshold, increase the number of
      // blocks processed for this column & next by 1.
      y += 1;

      ctx.P[y] = ~0;
      ctx.M[y] = 0;

      const maxBlockScore = y === bMax ? pattern.length % w : w;
      score[y] =
        score[y - 1] + maxBlockScore - carry + advanceBlock(ctx, peq, y, carry);
    } else {
      // Error count for bottom block exceeds threshold, reduce the number of
      // blocks processed for the next column.
      while (y > 0 && score[y] >= maxErrors + w) {
        y -= 1;
      }
    }

    // If error count is under threshold, report a match.
    if (y === ctx.bMax && score[y] <= maxErrors) {
      matches.push({
        end: j + 1,
        errors: score[y],
        start: -1
      });
    }
  }

  return matches;
}

/**
 * Search for matches for `pattern` in `text` allowing up to `maxErrors` errors.
 */
export default function search(
  text: string,
  pattern: string,
  maxErrors: number
) {
  const matches = findMatchEnds(text, pattern, maxErrors);
  return findMatchStarts(text, pattern, matches, findMatchEnds);
}
