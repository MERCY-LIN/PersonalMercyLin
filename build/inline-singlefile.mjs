// Inlines the built JS/CSS of a Vite dist folder into index.html so the page
// is a single self-contained HTML file that works from a `file://` URL.
//
// Usage: node inline-singlefile.mjs <dist-dir>
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const distDir = process.argv[2];
if (!distDir) {
  console.error("usage: node inline-singlefile.mjs <dist-dir>");
  process.exit(1);
}

const indexPath = path.join(distDir, "index.html");
let html = await readFile(indexPath, "utf8");

async function replaceAsync(source, pattern, replacer) {
  const matches = [...source.matchAll(pattern)];
  const parts = [];
  let cursor = 0;
  for (const match of matches) {
    parts.push(source.slice(cursor, match.index));
    parts.push(await replacer(...match));
    cursor = match.index + match[0].length;
  }
  parts.push(source.slice(cursor));
  return parts.join("");
}

function localPath(href) {
  const clean = href.split("?")[0].split("#")[0].replace(/^\.\//, "").replace(/^\//, "");
  return path.join(distDir, clean);
}

// Stylesheets -> <style>
html = await replaceAsync(
  html,
  /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  async (match, href) => {
    const css = await readFile(localPath(href), "utf8");
    return `<style>\n${css}\n</style>`;
  },
);

// Module preload hints are pointless once everything is inlined.
html = html.replace(/[ \t]*<link[^>]*rel="modulepreload"[^>]*>\s*\n?/g, "");

// Module scripts -> inline <script type="module">
html = await replaceAsync(
  html,
  /<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
  async (match, src) => {
    const code = await readFile(localPath(src), "utf8");
    return `<script type="module">\n${code.replace(/<\/script>/gi, "<\\/script>")}\n</script>`;
  },
);

if (/<script[^>]*src="http/i.test(html) || /<link[^>]*href="http/i.test(html)) {
  console.warn("warning: output still references remote URLs");
}

await writeFile(indexPath, html);
console.log(`inlined single file: ${indexPath} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
