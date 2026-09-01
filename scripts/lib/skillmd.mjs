// Shared SKILL.md helpers for the dsh-skills-hub build pipeline (zero-dependency).
// Mirrors the parsing/validation rules of the DSH dsh-skills-manager market contract v1.

export const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// YAML block scalar header detection, e.g.  ">", "|-", ">", ">-", "|+", ">+"
const BLOCK_SCALAR_RE = /^([>|])([+-]?)$/;

/**
 * Parse the YAML frontmatter block of a SKILL.md.
 *
 * Handles three value forms:
 *   1. inline scalar     ->  key: value            (with optional quotes)
 *   2. folded block      ->  key: >  (folded lines on following indented lines)
 *   3. literal block     ->  key: |  (literal lines on following indented lines)
 *
 * Chomping indicators (+ keep / - strip) and the plain block markers (> / |)
 * are honored; the DSH contract needs a single-line description, so callers
 * collapse with `collapseDescription`.
 *
 * @param {string} content the full SKILL.md text (or any --- frontmatter block)
 * @returns {object|null} fields map, or null when no frontmatter block exists.
 */
export function parseFrontmatter(content) {
  const stripped = String(content).replace(/^\uFEFF/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(stripped);
  if (!m) return null;

  const lines = m[1].split(/\r?\n/);
  const fields = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().length === 0) { i++; continue; } // blank lines between keys
    const idx = line.indexOf(":");
    if (idx <= 0) { i++; continue; } // skip lines without a colon
    const key = line.slice(0, idx).trim();
    const rest = line.slice(idx + 1); // keep leading spaces (indentation matters for blocks)
    const restTrimmed = rest.trim();

    // ----- block scalar marker -----
    let blockMatch = null;
    let mm = null; // regex match for a block scalar header, visible below the else block
    if (restTrimmed.length === 0) {
      blockMatch = undefined; // "key:" alone -> empty value
    } else {
      mm = BLOCK_SCALAR_RE.exec(restTrimmed);
      blockMatch = mm ? mm : null;
    }

    if (blockMatch) {
      // Collect following indented lines as the block body. A line belongs to the
      // block when it is blank OR indented deeper than the key column; the first
      // line at or shallower than key indentation starts the next key.
      const blockLines = [];
      const keyCol = line.indexOf(key);
      let end = i + 1;
      while (end < lines.length) {
        const bl = lines[end];
        const blank = bl.trim().length === 0;
        const lead = bl.length - bl.trimStart().length;
        const inBlock = blank || lead > keyCol;
        if (!blank && !inBlock) break; // next key reached
        blockLines.push(bl);
        end++;
      }
      i = end;

      if (mm) {
        const styleChar = mm[1];     // '>' or '|'
        const chomp = mm[2];         // '', '+', or '-'
        // strip trailing blank lines before applying chomping
        let trimmedLines = blockLines.slice();
        if (chomp !== "+") {
          while (trimmedLines.length && trimmedLines[trimmedLines.length - 1].trim().length === 0) {
            trimmedLines.pop();
          }
          if (chomp === "-") {
            while (trimmedLines.length && trimmedLines[trimmedLines.length - 1].trim().length === 0) {
              trimmedLines.pop();
            }
          }
        }
        // normalize indentation to the minimum non-blank indentation
        const nonBlank = trimmedLines.filter((l) => l.trim().length > 0);
        const minIndent = nonBlank.length ? Math.min(...nonBlank.map((l) => l.length - l.trimStart().length)) : 0;
        const core = trimmedLines.map((l) => (l.trim().length === 0 ? "" : l.slice(minIndent)));
        if (styleChar === ">") {
          // folded: join lines with a space, blank line = paragraph boundary
          const folded = [];
          for (const ln of core) {
            if (ln.trim().length === 0) folded.push("\n");
            else folded.push(ln);
          }
          fields[key] = folded.join(" ").replace(/ \n /g, "\n").trim();
        } else {
          // literal
          fields[key] = core.join("\n").trim();
        }
      } else { // "key:" alone
        fields[key] = "";
      }
      continue;
    }

    // ----- inline scalar -----
    let val = restTrimmed;
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
      // unescape like a real YAML parser: \" -> " and \\ -> \  (so re-reading a
      // description we wrote earlier is idempotent, never accumulating escapes)
      val = val.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
    fields[key] = val.replace(/\s+$/, "");
    i++;
  }
  return fields;
}

/**
 * Collapse a parsed description into a single line ≤ `limit` chars (DSH contract §4).
 * Newlines fold to spaces; a hard cap is applied at a word boundary.
 * @param {string} d raw description (may contain newlines from a block scalar)
 * @param {number} limit max length (default 500, DSH contract)
 * @returns {string} single-line trimmed description
 */
export function collapseDescription(d, limit = 500) {
  const s = String(d == null ? "" : d).replace(/\s*\r?\n\s*/g, " ").replace(/\s+/g, " ").trim();
  if (s.length <= limit) return s;
  const cut = s.slice(0, limit);
  const at = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("."), cut.lastIndexOf(","));
  return (at > 200 ? cut.slice(0, at) : cut).replace(/\s+$/, "").trim();
}

/**
 * Shorten a description to ≤ 500 chars at a sentence/word boundary (DSH contract §4),
 * used by the upstream importer so vendored files stay installable.
 * @param {string} d raw description
 * @returns {string}
 */
export function shortenDescription(d) {
  const s = collapseDescription(d, 500);
  if (s.length <= 500) return s;
  const cut = s.slice(0, 500);
  const idx = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf("; "), cut.lastIndexOf(" "));
  if (idx > 200) return cut.slice(0, idx + 1).trim();
  return cut.trim();
}

/**
 * Clean a description for embedding in a double-quoted YAML scalar, so it
 * validates with BOTH this lib's parser and the official DSH market validator
 * (which strips surrounding quotes but does NOT unescape `\"`), and stays valid
 * YAML for the `yaml` lib used by skill-filesystem.
 *
 * Strategy: never leave ASCII `"` or `\` inside the quoted value. ASCII double
 * quotes are converted to real paired curly quotes (“ ”); a stray full-width
 * solidus from an earlier mangled pass (`／“`) is repaired. Single quotes and
 * other plain text pass through untouched.
 * @param {string} d raw single-line description
 * @returns {string} cleaned text safe to wrap in `description: "..."`
 */
export function cleanQuotedDescription(d) {
  return String(d)
    .replace(/／“/g, "“")                       // repair earlier ／“ mangling
    .replace(/“([^“”\n]*)“/g, "“$1”")          // pair stray “…“ into “…”
    .replace(/"([^"\n]*)"/g, "“$1”")           // pair ASCII "…" into “…”
    .replace(/"/g, "“")                         // lone ASCII quote -> left curly
    .replace(/[\\]/g, "／");                    // backslash (would be an escape in YAML) -> fullwidth solidus
}

/**
 * Rewrite the frontmatter description to a single quoted line (keeps the rest intact).
 * Handles BOTH inline and block-scalar (">", "|", ">-", "|-" etc.) descriptions:
 * the marker line plus its following indented body lines are replaced wholesale by
 * `description: "..."`.
 *
 * IMPORTANT: the DSH market validator (`dsh-skills-manager/lib/market/validate.js`)
 * strips surrounding quotes but does NOT unescape `\"`. So embedded quotes are
 * converted to full-width curly forms via cleanQuotedDescription() — every parser
 * (this lib, the official validator, and the YAML lib used by skill-filesystem)
 * reads identical clean single-line text.
 * @param {string} content full SKILL.md text
 * @param {string} newDescription single-line replacement text
 * @returns {string} content with description rewritten
 */
export function rewriteDescription(content, newDescription) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(content).replace(/^\uFEFF/, ""));
  if (!m) return content;
  const fmLines = m[1].split(/\r?\n/);
  const descIdx = fmLines.findIndex((l) => l.trim().startsWith("description:"));
  if (descIdx < 0) return content; // no description line, leave as-is
  // description body = the marker line plus subsequent lines indented deeper than the key column
  const keyCol = fmLines[descIdx].indexOf("description");
  let end = descIdx + 1;
  while (end < fmLines.length) {
    const bl = fmLines[end];
    const blank = bl.trim().length === 0;
    const lead = bl.length - bl.trimStart().length;
    if (!blank && !(lead > keyCol)) break;
    end++;
  }
  const esc = cleanQuotedDescription(newDescription);
  const newFmBody = fmLines.slice(0, descIdx)
    .concat(['description: "' + esc + '"'])
    .concat(fmLines.slice(end));
  const newFm = "---\n" + newFmBody.join("\n") + "\n---";
  return String(content).replace(m[0], newFm);
}

/**
 * Validate a SKILL.md against the DSH market contract (fail-closed).
 * @returns {{ok:true, fm:object, desc:string}|{ok:false, reason:string}}
 */
export function validateSkillFile(content, expectedName) {
  const fm = parseFrontmatter(content);
  if (!fm) return { ok: false, reason: "missing frontmatter" };
  const name = String(fm.name || "").trim();
  if (!name || !ID_RE.test(name) || name.length > 64) {
    return { ok: false, reason: "invalid/missing name" };
  }
  if (expectedName != null && name !== expectedName) {
    return { ok: false, reason: "name mismatch: " + name + " != " + expectedName };
  }
  const description = collapseDescription(String(fm.description || "")).replace(/\s+$/, "");
  if (!description) {
    return { ok: false, reason: "description missing" };
  }
  if (description.length > 500) {
    return { ok: false, reason: "description too long (" + description.length + ")" };
  }
  return { ok: true, fm: { ...fm, description }, desc: description };
}