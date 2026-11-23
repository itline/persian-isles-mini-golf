# Self-contained Edge packaging

Build the production game first. The compact programmatic profile is the recommended single-file upload; the CLI without `compact` retains multiple encoded representations and is larger.

```sh
npm run build
node --input-type=module -e '
import {buildEdge} from "./scripts/build-edge.mjs";
console.log(buildEdge({
  dist: "dist",
  output: "/absolute/new-output.js",
  origin: "https://mini-golf.hasan-xcqij.arvanedge.ir",
  cover: "docs/images/hormuz-cover.png",
  compact: true
}));'
```

Output must not already exist. Supply the exact deployed HTTPS origin; canonical links and Open Graph image URLs are generated from it. The script embeds the local assets and does not fetch a third-party origin or contain account credentials.

Compact mode stores WASM gzip once and synthesizes identity responses using `DecompressionStream('gzip')`. Other assets use one identity copy; actual text compression is a hosting-layer behavior that must be observed after upload. The adapter uses the fetch-event interface and workerd's `encodeBody: 'manual'` response extension. Local workerd acceptance is not proof of every provider/runtime configuration. The corrected v0.2.0 decoder, gzip/identity WASM, share image and real browser input were observed working on the selected Arvan origin; each replacement still needs hosted verification.

Hashed assets receive immutable cache headers; HTML and notices revalidate. ETags, conditional GET, HEAD and encoding negotiation are implemented. Only existing Hormuz journey and exact holes 1–9 receive dedicated metadata. Query values are bounded and HTML-escaped; shared scores are not remotely validated.

The compact invocation above omits legacy hashed bundles; explicitly supplying `previousDist` can still include them. Old tabs may require Refresh. Existing save keys are preserved but browser storage remains origin-bound; changing domains does not migrate saves.

After upload, verify the version header, HTML canonical/OG URLs, share image, exact JS/CSS/WASM resource URLs, gzip and identity decoded WASM equality, missing asset 404, absence of production QA hooks, and real gameplay input. Verify mobile controls and all four preview-only islands. Never claim that a file upload alone proves a successful deployment.
