const { assert } = require('chai');

const search = require('../dist').default;

function repeat(str, n) {
  let out = '';
  while (n > 0) {
    out += str;
    n -= 1;
  }
  return out;
}

const fixtures = {
  // Each fixture is a tuple of:
  // [text, pattern, matches],

  exactMatch: [
    ['three blind mice', 'blind', [{ start: 6, end: 11, errors: 0 }]],
    ['three blind mice', 'three', [{ start: 0, end: 5, errors: 0 }]],
  ],

  oneError: [
    // One delete from pattern
    ['three blind mice', 'bliind', [{ start: 6, end: 11, errors: 1 }]],
    // One insert from pattern
    ['three blind mice', 'blnd', [{ start: 6, end: 11, errors: 1 }]],
    // One substitution or one deletion
    ['three blind mice', 'thrae', [
      { start: 0, end: 4, errors: 1 },
      { start: 0, end: 5, errors: 1 },
    ]],
    // One substitution
    ['facebook', 'fccebook', [{ start: 0, end: 8, errors: 1 }]],
    // One insert
    // nb. This can be viewed as:
    //  - A mismatch with 'f' replaced with 'a' in the text ([1,8])
    //  - A mismatch with 'a' inserted in the text ([0,8])
    ['facebook', 'fcebook', [
      { start: 1, end: 8, errors: 1 },
      { start: 0, end: 8, errors: 1 },
    ]],
  ],

  manyErrors: [
    ['foursquare andseven', 'four square and seven', [{ start: 0, end: 19, errors: 2 }]],
    ['four squareand seven', 'square  and', [{ start: 5, end: 14, errors: 2 }]],
  ],

  unicode: [
    // Non-BMP unicode chars currently count as 2 chars when counting errors.
    // This is consistent with the fact that JS strings are measured in UTF-16
    // code units, but we probably want to change this.
    ['sm😊le', 'smile', [{ start: 0, end: 6, errors: 2 }]],
    ['sm😊le', 'sm😊le', [{ start: 0, end: 6, errors: 0 }]],
  ],

  longPattern: [
    // Patterns where the length exceeds the size of a word. This matters for
    // algorithms which use bit-parallel operations.
    [
      repeat('foo', 5) + repeat('bar', 20) + repeat('baz', 5),
      repeat('bar', 20),
      [{ start: 15, end: 75, errors: 0 }],
    ],
    [
      repeat('foo', 5) + repeat('bar', 10) + 'zog' + repeat('bar', 10) + repeat('baz', 5),
      repeat('bar', 20),
      [{ start: 15, end: 75, errors: 3 },
       { start: 15, end: 78, errors: 3 }],
    ],
  ],
};

function check(searchFn, text, pattern, matches) {
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
    assert.ok(expectedMatches.some(m =>
      am.start === m.start &&
      am.end === m.end &&
      am.errors === m.errors // eslint-disable-line comma-dangle
    ));
  } else {
    assert.deepEqual(actualMatches, expectedMatches);
  }
}

describe('search', () => {
  fixtures.exactMatch.forEach(([text, pattern, matches], idx) => {
    it(`finds exact matches (${idx})`, () => {
      check(search, text, pattern, matches);
    });
  });

  fixtures.oneError.forEach(([text, pattern, matches], idx) => {
    it(`finds matches with one error (${idx})`, () => {
      check(search, text, pattern, matches);
    });
  });

  fixtures.manyErrors.forEach(([text, pattern, matches], idx) => {
    it(`finds matches with many errors (${idx})`, () => {
      check(search, text, pattern, matches);
    });
  });

  fixtures.unicode.forEach(([text, pattern, matches], idx) => {
    it(`finds matches in text with complex chars (${idx})`, () => {
      check(search, text, pattern, matches);
    });
  });

  it('returns an empty array if there is no match for the given error limit', () => {
    const matches = search('four candles', 'foouur', 1);
    assert.deepEqual(matches, []);
  });

  it('finds a match with a short pattern in a long text', () => {
    const text = `
A great discovery solves a great problem but there is a grain of discovery in
the solution of any problem.
`;
    const pattern = 'discvery';
    const matches = search(text, pattern, 2);
    matches.forEach((m) => {
      assert.equal(text.slice(m.start, m.end), 'discovery');
    });
  });

  fixtures.longPattern.forEach(([text, pattern, matches], idx) => {
    it(`supports patterns > 32 chars ${idx}`, () => {
      check(search, text, pattern, matches);
    });
  });

  it('returns correct match if "maxErrors" exceeds pattern length by word size', () => {
    assert.deepEqual(search('four score', 'score', 50), [{
      start: 5,
      end: 10,
      errors: 0,
    }]);
  });
});
