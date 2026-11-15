# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.3] - 2026-11-15

 - Re-release of v2.0.2 with fixes to the package build (https://github.com/robertknight/approx-string-match-js/pull/23)

## [2.0.2] - 2026-11-15

 - Fix an issue where the `start` reported for a match could be too early, so
   the error count between `start` and `end` exceeded `errors`
   [#21](https://github.com/robertknight/approx-string-match-js/pull/21) (thanks
   @trackoor for the report)

## [2.0.1] - 2026-10-09

 - Update dependencies (thanks @EmilyRagan) [#19](https://github.com/robertknight/approx-string-match-js/pull/19)

## [2.0.0] - 2021-11-21

### Breaking changes

 - This package has been converted to ES module format. To use it you will need a
   version of Node and other tooling which supports ES modules. The package does
   not include a CommonJS build, please file an issue if you need one.

 - This package is now built as modern JavaScript (ES 2017) and will no longer
   work in IE 11.

### Fixes

 - Fixed incorrect results when pattern length is a multiple of 32 and `maxErrors`
   is smaller than the pattern length by at least 32. [#13](https://github.com/robertknight/approx-string-match-js/pull/13)
