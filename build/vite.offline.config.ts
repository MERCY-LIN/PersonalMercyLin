// Offline build configuration for DSPONLINE.
//
// Goal: produce a fully self-contained web build that runs from a plain
// `file://` URL (double-click on macOS) with no network access and no server.
//
// Differences from the default build:
//   1. `base: "./"` so every emitted asset URL is relative.
//   2. Every `new Worker(new URL("./x.worker.ts", import.meta.url), opts)`
//      call is rewritten to an inline worker (`?worker&inline`) so workers
//      load from a Blob URL instead of a `file://` subresource (browsers
//      block file:// worker scripts from an opaque origin).
//   3. `DSP_OFFLINE_SINGLE_FILE=1` additionally disables code splitting and
//      CSS splitting so the whole app ends up in a single HTML file.
import { defineConfig, type Plugin } from "vite";
import base from "./vite.config";

const singleFile = process.env.DSP_OFFLINE_SINGLE_FILE === "1";

function parseStringLiteral(code: string, start: number): { value: string; end: number } | null {
  const quote = code[start];
  if (quote !== "\"" && quote !== "'" && quote !== "`") return null;
  let i = start + 1;
  while (i < code.length) {
    const ch = code[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === quote) return { value: code.slice(start + 1, i), end: i + 1 };
    i += 1;
  }
  return null;
}

function skipWhitespace(code: string, index: number): number {
  let i = index;
  while (i < code.length && /\s/.test(code[i])) i += 1;
  return i;
}

/** Returns the index just past the matching ")" for the "(" at openIndex. */
function matchParen(code: string, openIndex: number): number {
  let depth = 0;
  let i = openIndex;
  while (i < code.length) {
    const ch = code[i];
    if (ch === "\"" || ch === "'" || ch === "`") {
      const literal = parseStringLiteral(code, i);
      if (!literal) return -1;
      i = literal.end;
      continue;
    }
    if (ch === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      if (end === -1) return -1;
      i = end + 2;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return -1;
}

/**
 * Rewrites `new Worker(new URL("./x.worker.ts", import.meta.url), options)`
 * into `new __dspInlineWorkerN(options)` backed by an inline worker import,
 * so the worker source ships inside the JS bundle instead of a file.
 */
function inlineWorkerCalls(): Plugin {
  return {
    name: "dsp-offline-inline-workers",
    enforce: "pre",
    transform(code) {
      if (!code.includes("new Worker(")) return null;
      const marker = "new Worker(";
      const imports = new Map<string, string>();
      let out = "";
      let cursor = 0;
      let changed = false;
      while (true) {
        const index = code.indexOf(marker, cursor);
        if (index === -1) {
          out += code.slice(cursor);
          break;
        }
        const callOpen = index + marker.length - 1;
        const callEnd = matchParen(code, callOpen);
        if (callEnd === -1) {
          out += code.slice(cursor, callOpen + 1);
          cursor = callOpen + 1;
          continue;
        }
        const passThrough = () => {
          out += code.slice(cursor, callEnd);
          cursor = callEnd;
        };
        const firstArg = skipWhitespace(code, callOpen + 1);
        if (!code.startsWith("new URL(", firstArg)) {
          passThrough();
          continue;
        }
        const urlOpen = firstArg + "new URL(".length - 1;
        const urlEnd = matchParen(code, urlOpen);
        if (urlEnd === -1) {
          passThrough();
          continue;
        }
        const literalStart = skipWhitespace(code, urlOpen + 1);
        const literal = parseStringLiteral(code, literalStart);
        if (!literal) {
          passThrough();
          continue;
        }
        const commaIndex = skipWhitespace(code, literal.end);
        if (code[commaIndex] !== ",") {
          passThrough();
          continue;
        }
        const metaStart = skipWhitespace(code, commaIndex + 1);
        if (!code.startsWith("import.meta.url", metaStart)) {
          passThrough();
          continue;
        }
        const specifier = literal.value;
        if (!specifier.startsWith(".")) {
          passThrough();
          continue;
        }
        let alias = imports.get(specifier);
        if (!alias) {
          alias = `__dspInlineWorker${imports.size}`;
          imports.set(specifier, alias);
        }
        let options = code.slice(urlEnd, callEnd - 1).trim();
        if (options.startsWith(",")) options = options.slice(1).trim();
        if (options.endsWith(",")) options = options.slice(0, -1).trim();
        out += code.slice(cursor, index) + `new ${alias}(${options})`;
        cursor = callEnd;
        changed = true;
      }
      if (!changed) return null;
      const header = [...imports.entries()]
        .map(([specifier, alias]) => `import ${alias} from ${JSON.stringify(`${specifier}?worker&inline`)};`)
        .join("\n");
      return { code: `${header}\n${out}`, map: null };
    },
  };
}

const basePlugins = (Array.isArray(base.plugins) ? base.plugins : []).filter(Boolean);

export default defineConfig({
  ...base,
  base: "./",
  plugins: [...basePlugins, inlineWorkerCalls()],
  // Worker sub-builds do not inherit the top-level plugin list, but the game
  // also creates workers from inside workers (e.g. the multicore planet
  // workers spawned by the simulation worker). Those nested creations must be
  // inlined as well, otherwise they resolve against the blob: URL of their
  // parent worker and fail outside of a web server.
  worker: {
    ...base.worker,
    plugins: () => [inlineWorkerCalls()],
  },
  build: {
    ...base.build,
    manifest: singleFile ? false : base.build?.manifest,
    cssCodeSplit: false,
    ...(singleFile
      ? {
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          rolldownOptions: { output: { inlineDynamicImports: true } },
        }
      : {}),
  },
});
