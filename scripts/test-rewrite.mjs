// Temporary verification: rewriteDescription must fully replace a block-scalar
// description (marker line + body lines) with a single quoted line, and must be
// a no-op for inline descriptions without dangling leftovers.
import { rewriteDescription, shortenDescription, validateSkillFile, parseFrontmatter } from "./lib/skillmd.mjs";

let failures = 0;
function check(name, cond, detail = "") {
  console.log((cond ? "[ok]   " : "[FAIL] ") + name + (detail ? "  " + detail : ""));
  if (!cond) failures++;
}

// 1) block-scalar description longer than 500 -> rewritten to one line, no dangling body
const longDesc = "word ".repeat(140); // ~700 chars
const fake = `---
name: test-block
description: >-
  ${longDesc}
  trailing body that must vanish
license: Keep
---

# body
`;
const out = rewriteDescription(fake, shortenDescription(longDesc));
const fm = out.slice(0, out.indexOf("\n---\n\n# body") + 5);
const bodyLines = fm.split("\n").filter((l) => /^  /.test(l) && l.trim().length > 0);
check("block desc rewritten to single line", /^description: "[^"]+"$/.test(fm.split("\n").find((l) => l.startsWith("description:")) || ""), "line=" + fm.split("\n").find((l) => l.startsWith("description:")));
check("no dangling block body lines", bodyLines.length === 0, "dangling=" + bodyLines.length);
check("license preserved", fm.includes("license: Keep"));
const p1 = validateSkillFile(out, "test-block");
check("rewritten file re-validates", p1.ok === true, p1.ok ? "len=" + p1.desc.length : p1.reason);

// 2) inline description, called with a replacement -> the line is replaced, rest intact
const inline = `---
name: test-inline
description: A short inline description
license: Keep
---
# body
`;
const out2 = rewriteDescription(inline, "short");
check("inline desc replaced", out2.includes("description: \"short\""));
check("inline rest preserved", out2.includes("license: Keep") && out2.includes("# body"));
const p2 = validateSkillFile(out2, "test-inline");
check("inline file re-validates", p2.ok === true && p2.desc === "short");

// 3) parseFrontmatter on the fake block scalar gives the folded text, not ">"
const f3 = parseFrontmatter(fake);
check("block marker parsed not literal", f3 && f3.description && !['>', '|-'].includes(f3.description.trim()), f3 ? "len=" + String(f3.description).length : "null");

console.log(failures === 0 ? "\nREWRITE TEST OK" : `\nREWRITE TEST FAILED: ${failures}`);
process.exitCode = failures === 0 ? 0 : 1;
