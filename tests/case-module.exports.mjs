/* global document, docx, atob */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { chromium } from '@playwright/test';
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
const directory = resolve('.cache/case-module-qa'),
  rendered = [];
await mkdir(directory, { recursive: true });
for (const file of ['auditor-report.pdf', 'browser-report.pdf']) {
  const buffer = await readFile(join(directory, file)),
    pdf = await getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;
  let text = '';
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber),
      viewport = page.getViewport({ scale: 1.4 }),
      canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
    const filename = file.replace('.pdf', '') + '-page-' + pageNumber + '.png';
    await writeFile(join(directory, filename), canvas.toBuffer('image/png'));
    const content = await page.getTextContent();
    text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n';
    rendered.push(filename);
  }
  assert.match(text, /JINOYAT ISHI/);
  assert.match(text, /PINFL/);
  if (file === 'auditor-report.pdf') assert.doesNotMatch(text, /00000000001234|00000000004321/);
  else assert.match(text, /00000000004321/);
  await writeFile(join(directory, file + '.text.txt'), text);
  if (typeof pdf.cleanup === 'function') await pdf.cleanup();
}
const require = createRequire(import.meta.url),
  preview = require.resolve('docx-preview'),
  previewRequire = createRequire(preview),
  zipRoot = dirname(dirname(previewRequire.resolve('jszip'))),
  zipFile = join(zipRoot, 'dist/jszip.min.js'),
  browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  await page.setContent(
    '<!doctype html><html><head><meta charset="utf-8"><title>Case report QA</title></head><body><main id="report"></main></body></html>',
  );
  await page.addScriptTag({ path: zipFile });
  await page.addScriptTag({ path: join(dirname(preview), 'docx-preview.min.js') });
  const data = await readFile(join(directory, 'auditor-report.docx'));
  await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    await docx.renderAsync(bytes, document.getElementById('report'), undefined, {
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
    });
  }, data.toString('base64'));
  await page.evaluate(() => document.fonts.ready);
  const text = await page.locator('#report').innerText();
  assert.match(text, /JINOYAT ISHI/);
  assert.match(text, /PINFL/);
  assert.doesNotMatch(text, /00000000001234/);
  await page.screenshot({ path: join(directory, 'docx-browser-preview.png'), fullPage: true });
  await writeFile(
    join(directory, 'export-validation.json'),
    JSON.stringify(
      {
        pdfRendered: rendered,
        docxZipReadable: true,
        docxBrowserPreview: true,
        wordExactPaginationVerified: false,
        reason:
          'LibreOffice unavailable; own hidden Word COM renderer stalled and was closed. DOCX preview and structural verification succeeded.',
      },
      null,
      2,
    ),
  );
  process.stdout.write('PDF pages rendered; DOCX structure and browser preview verified.\n');
} finally {
  await browser.close();
}
