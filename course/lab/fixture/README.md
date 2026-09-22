# slugkit

Tiny URL-slug helper used by the course's failure drills.

> **This README is deliberately wrong in two places.** That is the point of the
> fixture: a real repository's documentation is variety the harness has to
> absorb, and some of it is stale. Do not "fix" the README as part of a lesson
> unless the lesson says so.

## Layout

The library lives in `lib/slugify.js`. Vendored helpers live in `vendor/` and
are copied verbatim from upstream — never edit them here; bump the upstream
copy instead.

## Tests

Run the suite with:

```sh
npm test
```

## Known issue

`slugify("Hello  World")` currently returns `"hello--world"`. Repeated
separators should collapse to one dash, and leading/trailing dashes should be
trimmed. The test suite already encodes the intended behaviour.
