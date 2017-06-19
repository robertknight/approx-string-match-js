# approx-string-match

A library for approximate string matching.

This can be used to find occurrences of a pattern P (of length _m_) in a text T
(of length _n_) allowing for a number of errors (_k_), where errors may
include insertions, substitutions or deletions of characters from the pattern.

For example the pattern "annd" occurs in the string "four score and seven" with
one error.

The implementation uses a bit-parallel algorithm by G. Myers which, to the best
of my knowledge, is the state of the art algorithm for the online version of the
problem (where the text and pattern cannot be preprocessed in advance). Its
complexity is _O((k/w) * n)_ where _k_ <= _m_. See comments in the code for more
details.

G. Myers, “[A Fast Bit-Vector Algorithm for Approximate String Matching Based on
Dynamic
Programming](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.332.9395&rep=rep1&type=pdf),”
vol. 46, no. 3, pp. 395–415, 1999.

## Usage

```
npm install --save approx-string-match
```

```js
// Or `import search from 'approx-string-match'` if using ES6 imports.
var search = require('approx-string-match').default;

var text = 'Four score and seven';
var pattern = 'annd';
var matches = search(text, pattern, 2 /* max errors */);
console.log(matches);

// Outputs `[{ start: 11, end: 14, errors: 1 }]`
```
