# Optional PDF preview

[Open the catalogue](../public/pdf-preview.html). It uses synthetic pages; consumers render real PDFs with their pinned local PDF.js distribution. The module is separate from the normal runtime and adds no PDF dependency to non-document pages.

```js
import {openPDF} from './shared-ui/pdf-preview.mjs';
const controller = new AbortController();
const dispose = await openPDF(stage, authorizedUrlOrArrayBuffer, {
  assetBase: new URL('./pdfjs/', location.href).href,
  sprite: './shared-ui/icons.svg',
  signal: controller.signal,
  title: 'Invoice.pdf',
  page: 1,
});
// On close, abort pending loading/rendering and release canvas and worker.
controller.abort(); // or dispose()
```

Hosts authorize and verify sources before calling. ArrayBuffers are copied so PDF.js cannot detach the host's original. URLs, workers, character maps, fonts and decoders stay on the host's configured origin. PDF scripting stays disabled. `loadLibrary` can supply an already selected PDF.js module.

The basic viewer renders one page at a time, Previous/Next, a native page field, shared zoom commands and accessible extracted text. It preserves the requested page and rerenders when its container width changes. Closing and leaving the page release resources; browser history caching does not dispose a live view.

If rendering fails and a source URL (or explicit `fallbackUrl`) exists, it offers a native browser PDF frame. Native PDF support varies, especially in installed web apps; retain direct Open original and Download actions. With verified bytes and no fallback URL, errors return to the host's existing retry UI. This is a compatibility fallback, not a guarantee that every PDF works in every browser.

Build the optional catalogue/module with `node scripts/build-pdf-preview.mjs`. Install with `node scripts/install-pdf-preview.mjs --target /app/generated/shared-ui`, then verify with `--check`. Commit the generated module and its separate integrity manifest together. Do not edit consumer copies. This opt-in installer leaves the main UI bundle intact.
