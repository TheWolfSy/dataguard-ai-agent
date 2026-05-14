import ts from "typescript";
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node tools/ts-syntax-check.mjs <file>");
  process.exit(2);
}

const sourceText = fs.readFileSync(file, "utf8");
const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const diagnostics = source.parseDiagnostics ?? [];
if (!diagnostics.length) {
  console.log("no parse diagnostics");
  process.exit(0);
}

for (const d of diagnostics.slice(0, 10)) {
  const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
  const pos = d.start ?? 0;
  const { line, character } = source.getLineAndCharacterOfPosition(pos);
  const lineText = sourceText.split(/\r?\n/)[line] ?? "";
  console.log(`${file}:${line + 1}:${character + 1}: ${msg}`);
  console.log(lineText);
}

process.exit(1);
