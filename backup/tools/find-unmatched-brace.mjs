import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node tools/find-unmatched-brace.mjs <file>");
  process.exit(2);
}

const s = fs.readFileSync(file, "utf8");

// Very small scanner: skips strings and comments, tracks `{}` balance.
let i = 0;
const stack = [];
let mode = "code"; // code | line | block | string
let quote = "";

while (i < s.length) {
  const ch = s[i];
  const n = s[i + 1];

  if (mode === "code") {
    if (ch === "/" && n === "*") {
      mode = "block";
      i += 2;
      continue;
    }
    if (ch === "/" && n === "/") {
      mode = "line";
      i += 2;
      continue;
    }
    if (ch === "'" || ch === `"` || ch === "`") {
      mode = "string";
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "{") stack.push(i);
    if (ch === "}") stack.pop();
    i += 1;
    continue;
  }

  if (mode === "line") {
    if (ch === "\n") mode = "code";
    i += 1;
    continue;
  }

  if (mode === "block") {
    if (ch === "*" && n === "/") {
      mode = "code";
      i += 2;
      continue;
    }
    i += 1;
    continue;
  }

  // string
  if (ch === "\\") {
    i += 2;
    continue;
  }
  if (ch === quote) {
    mode = "code";
    quote = "";
    i += 1;
    continue;
  }
  i += 1;
}

if (mode !== "code") {
  console.log(`scanner ended inside: ${mode}${quote ? ` (${quote})` : ""}`);
}

if (!stack.length) {
  console.log("balanced");
  process.exit(0);
}

const positions = stack.slice(-10).map((pos) => {
  const before = s.slice(0, pos);
  const line = before.split(/\r?\n/).length;
  const col = pos - before.lastIndexOf("\n");
  const lineText = s.split(/\r?\n/)[line - 1] ?? "";
  return { file, line, col, lineText };
});

for (const p of positions) {
  console.log(`${p.file}:${p.line}:${p.col}`);
  console.log(p.lineText);
}
