# Corrective web packaging

This tool prepares **new local artifacts** from an existing, unchanged `dist/`.
It does not build the game, modify `public/` or `dist/`, publish a release, replace
an existing ZIP/tag, deploy a host, or configure HTTP compression. The complete
music audition collection remains in the full archive and in the source tree.

## Run

Requirements: the project's supported Node.js version and `python3` on `PATH`.
Only Node built-ins (`zlib`, `crypto`, filesystem, child process) and Python's
standard-library `zipfile` are used; no extra dependencies are installed.
Run from the repository root, using a **new output directory outside `dist/`**:

```sh
node scripts/package-web.mjs \
  --dist /absolute/path/to/hormuz/dist \
  --out /Users/hasan/.hermes/cache/scratch/hormuz-web-corrective-NEW
```

The output parent must already exist. Choose another unused name for each run.
The tool refuses *any* existing output directory, including an empty one; there
is no overwrite/force switch. Relative paths are resolved from the current
working directory. `--help` prints usage. Both options are required; unknown,
duplicate, and incomplete options fail. Paths containing spaces are supported
when quoted by the caller. Python is invoked with an argv array, not a shell.

For programmatic use (importing performs no packaging):

```js
import { packageWeb } from './scripts/package-web.mjs';
const manifest = await packageWeb({ dist: '/absolute/dist', out: '/new/output' });
```

A successful CLI call prints the manifest JSON to stdout and exits zero. Errors
go to stderr with exit status 1. `manifest.json` is written last; its absence
means an incomplete run. On failure, only the tool's newly created staging
directory is removed. Any partial ZIPs in the new output directory are left for
inspection; the tool never deletes an output root or retries by overwriting it.

## Payload contract

Exactly these three files are produced on success:

| File | Contents |
| --- | --- |
| `gameplay-web.zip` | Every original distribution entry **except** the root `music-audition/` subtree; plus generated `.br` and `.gz` siblings for recognized text files. |
| `full-archive.zip` | Every original distribution entry, including `music-audition/`, its indexes, audio, metrics and licenses, with no newly generated encoding siblings. |
| `manifest.json` | Artifact and uncompressed-entry byte sizes and SHA-256 hashes, entry counts, and generated-encoding metadata. |

ZIP paths are relative to the distribution root: `index.html`, not
`dist/index.html`. Original bytes, filenames, empty directories, indexes,
branding, licenses and notices are retained. Both ZIPs keep their original
uncompressed gameplay files; the full ZIP is the archival copy, not a second
precompressed web payload. Existing original encoding files are never stripped
from the full archive. If a gameplay text file already has a would-be generated
`.br` or `.gz` sibling (even a directory), packaging fails before output creation
rather than replacing it or producing ambiguous metadata.

Generated encodings cover case-insensitive extensions `html`, `css`, `js`,
`mjs`, `json`, `map`, `webmanifest`, `txt`, `md`, `svg`, and `xml`. Other formats
(including images except SVG, audio, fonts, WASM and unknown extensions) are
copied unchanged. Every recognized file gets both encodings, even when a tiny
file compresses to a larger size. Brotli quality is 11 and gzip level is 9.
ZIP DEFLATE is independent of HTTP content encoding.

### Manifest schema version 1

- `compression.brotli.quality`, `compression.gzip.level`, and
  `compression.requiresServerConfiguration: true` describe generation only.
- `artifacts.full` and `artifacts.gameplay` each contain `path`, ZIP `bytes`,
  ZIP `sha256`, `entryCount`, and an ordered `entries` array.
- Every entry has relative `path`, `kind` (`file` or `directory`), uncompressed
  `bytes`, and uncompressed `sha256`. Directory paths end in `/` and use the
  empty-byte hash. ZIP hashes refer to the final ZIP bytes, not its entries.
- Generated entries additionally have `source` (original URL-relative path),
  `encoding` (`br` or `gzip`), `contentType` (the original resource's media
  type), and `vary: "Accept-Encoding"`. Their sizes and hashes describe the
  encoded bytes. The corresponding original entry records decoded bytes.
- The external manifest is not embedded in either ZIP and does not hash itself.
  There are no timestamps or absolute source/output paths in the manifest.

## Serving is a separate, unperformed deployment step

Extract `gameplay-web.zip` to a new deployment staging root. File presence does
**not** enable browser compression. Configure the actual host/CDN to negotiate
representations at the **original URLs**, for example:

| Requested URL | Selected local file | Required response metadata |
| --- | --- | --- |
| `/assets/game.js` accepting `br` | `assets/game.js.br` | `Content-Encoding: br`, `Content-Type: text/javascript; charset=utf-8`, `Vary: Accept-Encoding` |
| `/assets/game.js` accepting only `gzip` | `assets/game.js.gz` | `Content-Encoding: gzip`, same original JS Content-Type, `Vary: Accept-Encoding` |
| `/assets/game.js` accepting neither | `assets/game.js` | No Content-Encoding, same original JS Content-Type, `Vary: Accept-Encoding` |

Use each manifest entry's actual `source` path, not the illustrative filename
above. Preserve query/path handling and match encodings the client accepts;
never double-compress sidecars. Do not rewrite HTML imports to `.br` or `.gz`
URLs. A `.br` file served as an ordinary download, a cached variant without
`Vary`, or a sidecar served without the correct `Content-Encoding` is **not** a
valid compressed deployment. Identity fallback must stay available. Cache keys,
validators and response lengths must correspond to the chosen representation.

After a separate host configuration, verify actual response headers and decoded
bytes for HTML, the exact hashed JavaScript/CSS URLs in `index.html`, both
encodings, and identity fallback. For example (replace URLs with real ones):

```sh
curl -sS -D - -o /dev/null -H 'Accept-Encoding: br' https://HOST/assets/ACTUAL.js
curl -sS -D - -o /dev/null -H 'Accept-Encoding: gzip' https://HOST/assets/ACTUAL.js
curl -sS -D - -o /dev/null -H 'Accept-Encoding: identity' https://HOST/assets/ACTUAL.js
```

This packaging work makes **no claim** that any server is configured or that a
browser currently receives compressed bytes. Keep the full archive separately
available for auditions and archival redistribution; do not replace a previously
published full release with the gameplay-only payload.

## Safety and reproducibility

Source and output may not be equal or nested in either direction, including
aliases through an output parent's symlinks. The source root and all contained
symlinks are rejected, as are non-regular/non-directory entries and unsafe ZIP
names containing backslashes, colons or control characters. The source is read
with no-follow file opens and real-path boundary checks before staging. Use a
trusted, quiescent source tree and output parent: this is not a sandbox against
another process maliciously replacing ancestor directories during a run.

Output creation is exclusive, ZIP creation uses Python mode `x`, and staging
writes are exclusive. Original filesystem timestamps/modes are intentionally not
preserved: ZIP entries are sorted, have a fixed 1980-01-01 timestamp, and
normalized Unix file/directory modes 0644/0755. This produces identical ZIPs and
manifests for identical inputs on the same Node/Python/zlib toolchain; different
compression-library versions are not promised byte-identical output. Inputs
are staged once so both archives share the same snapshot of original bytes.
Text compression is synchronous and reads individual files into memory.

## Tests

```sh
TMPDIR=/Users/hasan/.hermes/cache/scratch npx vitest run src/packaging.test.js
```

Tests create and clean only uniquely named temporary fixture roots under the
provided `TMPDIR` (or the OS temp directory when it is unset). They unpack real
ZIPs using Python, compare all original bytes, decode Brotli/gzip, validate
manifest hashes/sizes, check repeated-output determinism, exercise the actual
CLI and missing-Python path, and reject overlapping paths, symlinks, unsafe
names, encoding collisions and overwrite attempts. No build, publication,
server, or browser is started.
