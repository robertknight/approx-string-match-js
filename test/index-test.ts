import { assert } from "chai";

import search, { Match, multiSearch } from "../src";

function repeat(str: string, n: number) {
  let out = "";
  while (n > 0) {
    out += str;
    n -= 1;
  }
  return out;
}

interface Fixtures {
  [s: string]: Array<[string, string, Match[]]>;
}

const fixtures: Fixtures = {
  // Each fixture is a tuple of:
  // [text, pattern, matches],

  exactMatch: [
    ["three blind mice", "blind", [{ start: 6, end: 11, errors: 0 }]],
    ["three blind mice", "three", [{ start: 0, end: 5, errors: 0 }]]
  ],

  oneError: [
    // One delete from pattern
    ["three blind mice", "bliind", [{ start: 6, end: 11, errors: 1 }]],
    // One insert from pattern
    ["three blind mice", "blnd", [{ start: 6, end: 11, errors: 1 }]],
    // One substitution or one deletion
    [
      "three blind mice",
      "thrae",
      [{ start: 0, end: 4, errors: 1 }, { start: 0, end: 5, errors: 1 }]
    ],
    // One substitution
    ["facebook", "fccebook", [{ start: 0, end: 8, errors: 1 }]],
    // One insert
    // nb. This can be viewed as:
    //  - A mismatch with 'f' replaced with 'a' in the text ([1,8])
    //  - A mismatch with 'a' inserted in the text ([0,8])
    [
      "facebook",
      "fcebook",
      [{ start: 1, end: 8, errors: 1 }, { start: 0, end: 8, errors: 1 }]
    ]
  ],

  manyErrors: [
    [
      "foursquare andseven",
      "four square and seven",
      [{ start: 0, end: 19, errors: 2 }]
    ],
    ["four squareand seven", "square  and", [{ start: 5, end: 14, errors: 2 }]]
  ],

  unicode: [
    // Non-BMP unicode chars currently count as 2 chars when counting errors.
    // This is consistent with the fact that JS strings are measured in UTF-16
    // code units, but we probably want to change this.
    ["sm😊le", "smile", [{ start: 0, end: 6, errors: 2 }]],
    ["sm😊le", "sm😊le", [{ start: 0, end: 6, errors: 0 }]]
  ],

  longPattern: [
    // Patterns where the length exceeds the size of a word. This matters for
    // algorithms which use bit-parallel operations.
    [
      repeat("foo", 5) + repeat("bar", 20) + repeat("baz", 5),
      repeat("bar", 20),
      [{ start: 15, end: 75, errors: 0 }]
    ],
    [
      repeat("foo", 5) +
        repeat("bar", 10) +
        "zog" +
        repeat("bar", 10) +
        repeat("baz", 5),
      repeat("bar", 20),
      [{ start: 15, end: 75, errors: 3 }, { start: 15, end: 78, errors: 3 }]
    ]
  ]
};

function check(
  searchFn: typeof search,
  text: string,
  pattern: string,
  matches: Match[]
) {
  const maxErrors = pattern.length;
  const expectedMatches = matches;

  // Keep only the closest matches.
  let actualMatches = searchFn(text, pattern, maxErrors);
  const minErrors = Math.min(...actualMatches.map(m => m.errors));
  actualMatches = actualMatches.filter(m => m.errors === minErrors);

  // Not all algorithms report all possible matches with the minimum error
  // count. In that case, require only one to match.
  if (actualMatches.length === 1 && matches.length > 1) {
    const am = actualMatches[0];
    assert.ok(
      expectedMatches.some(
        m => am.start === m.start && am.end === m.end && am.errors === m.errors // eslint-disable-line comma-dangle
      )
    );
  } else {
    assert.deepEqual(actualMatches, expectedMatches);
  }
}

describe("search", () => {
  context("when there are no errors", () => {
    fixtures.exactMatch.forEach(([text, pattern, matches], idx) => {
      it(`finds matches (${idx})`, () => {
        check(search, text, pattern, matches);
      });
    });
  });

  context("when there is one error", () => {
    fixtures.oneError.forEach(([text, pattern, matches], idx) => {
      it(`finds matches (${idx})`, () => {
        check(search, text, pattern, matches);
      });
    });
  });

  context("when there are many errors", () => {
    fixtures.manyErrors.forEach(([text, pattern, matches], idx) => {
      it(`finds matches (${idx})`, () => {
        check(search, text, pattern, matches);
      });
    });
  });

  context("when pattern contains non-BMP unicode chars", () => {
    fixtures.unicode.forEach(([text, pattern, matches], idx) => {
      it(`finds matches (${idx})`, () => {
        check(search, text, pattern, matches);
      });
    });
  });

  context("when there is no match", () => {
    it("returns an empty array", () => {
      const matches = search("four candles", "foouur", 1);
      assert.deepEqual(matches, []);
    });
  });

  context('when the text is "long"', () => {
    it("finds a match with a short pattern", () => {
      const text = `
  A great discovery solves a great problem but there is a grain of discovery in
  the solution of any problem.
  `;
      const pattern = "discvery";
      const matches = search(text, pattern, 2);
      matches.forEach(m => {
        assert.equal(text.slice(m.start, m.end), "discovery");
      });
    });
  });

  it('returns correct match if "maxErrors" exceeds pattern length by word size', () => {
    assert.deepEqual(search("four score", "score", 50), [
      {
        start: 5,
        end: 10,
        errors: 0
      }
    ]);
  });

  context("when there are multiple matches", () => {
    it("returns all matches", () => {
      const text = repeat("foo bar ", 5);
      assert.equal(search(text, "foo", 0).length, 5);
    });
  });

  it("allows an empty text", () => {
    assert.deepEqual(search("", "foo", 0), []);
  });

  it("allows an empty pattern", () => {
    assert.deepEqual(search("foo", "", 0), []);
  });

  context("when pattern length equals block size", () => {
    const text =
      'This is a string which exceeds the "word size" of the JS language.';

    it("finds matches", () => {
      const start = 1;
      const end = 33;
      const pat = text.slice(start, end);
      assert.deepEqual(search(text, pat, 0), [{ start, end, errors: 0 }]);
    });
  });

  context("when pattern length exceeds block size", () => {
    it("finds matches", () => {
      const text =
        'This is a string which exceeds the "word size" of the JS language.';
      const start = 23;
      const end = 56;
      const pat = text.slice(start, end);
      assert.deepEqual(search(text, pat, 0), [{ start, end, errors: 0 }]);
    });

    fixtures.longPattern.forEach(([text, pattern, matches], idx) => {
      it(`returns matches ${idx}`, () => {
        check(search, text, pattern, matches);
      });
    });

    it("returns all matches for a long pattern", () => {
      const str =
        'This is a string which exceeds the "word size" of the JS language.';
      const text = repeat(str, 5);
      assert.equal(search(text, str, 0).length, 5);
    });
  });
});

describe("multiSearch", () => {
  it("finds the best matches for each pattern", () => {
    const text = "one two three four five six";
    const patterns = ["one", "twwo", "fivve"];

    const matches = multiSearch(text, patterns, 2);

    assert.deepEqual(matches[0], [{ start: 0, end: 3, errors: 0 }]);
    assert.deepEqual(matches[1], [{ start: 4, end: 7, errors: 1 }]);
    assert.deepEqual(matches[2], [{ start: 19, end: 23, errors: 1 }]);
  });
});
