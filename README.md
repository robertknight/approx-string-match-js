# approx-string-match

A library for approximate string matching.

This can be used to find occurrences of a pattern P (of length _m_) in a text T
(of length _n_) allowing for up to a given number of errors (_k_), where errors may
include insertions, substitutions or deletions of characters from the pattern.

For example the pattern "annd" occurs in the string "four score and seven" with
one error.

The implementation uses a bit-parallel algorithm by G. Myers [1] which, to the
best of my knowledge, is the state of the art algorithm for the online version
of the problem (where the text and pattern cannot be preprocessed in advance).
Its complexity is _O((k/w) * n)_ where _k_ <= _m_ and _w_ is the word size (32
in JavaScript). See comments in the code for more details.

## Usage

```
npm install --save approx-string-match
```

```js
// Use `import search from 'approx-string-match'` if using ES6 imports.
var search = require('approx-string-match').default;

var text = 'Four score and seven';
var pattern = 'annd';
var matches = search(text, pattern, 2 /* max errors */);
console.log(matches);

// Outputs `[{ start: 11, end: 14, errors: 1 }]`
```

## JavaScript-specific Notes

#### Word size

The algorithm uses bitwise operations on integers. Since JavaScript only
supports bitwise operations on 32-bit integers, that is the word size,
regardless of the platform.

If JS gains support for bitwise operations on larger integers in future, that
support could be used to speed up this library.

#### Unicode

The library currently works on _code units_ rather than _code points_, where the
code unit is a UTF-16 value. What this means is that a change to a unicode
character which requires multiple characters to represent in a JavaScript
string, such as emoji, would actually count as two changes rather than one. This
is because such chars require two elements to represent in a string (eg.
`"😊".length` is 2).

## Related reading

For an overview of the different approaches to approximate string matching and
the history of the development of solutions, there is a good survey paper [2].

## References

[1] G. Myers, “[A Fast Bit-Vector Algorithm for Approximate String Matching Based on
Dynamic
Programming](https://scholar.google.com/scholar?q=A+Fast+Bit-Vector+Algorithm+for+Approximate+String+Matching+Based+on+Dynamic+Programming),”
vol. 46, no. 3, pp. 395–415, 1999.

[2] G. Navarro, “[A guided tour to approximate string
matching](https://scholar.google.com/scholar?q=A+guided+tour+to+approximate+string+matching),”
ACM Comput.  Surv., vol. 33, no. 1, pp. 31–88, 2001.
