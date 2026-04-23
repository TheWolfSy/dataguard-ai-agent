import ts from "typescript";
import fs from "node:fs";

const file = process.argv[2];
if (!file) process.exit(2);
const text = fs.readFileSync(file, "utf8");
const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

let found = null;
sf.forEachChild((node) => {
  if (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
    found = node;
  }
});

if (!found) {
  console.log("no default function export found");
  process.exit(1);
}

const body = found.body;
const returns = [];
const visit = (n) => {
  if (ts.isReturnStatement(n)) returns.push(n);
  ts.forEachChild(n, visit);
};
visit(body);

const start = sf.getLineAndCharacterOfPosition(found.getStart(sf));
const end = sf.getLineAndCharacterOfPosition(found.getEnd());
console.log(`default export function: lines ${start.line + 1}-${end.line + 1}`);
console.log(`body statements: ${body.statements.length}`);
console.log(`return statements: ${returns.length}`);

const topReturns = body.statements.filter(ts.isReturnStatement);
console.log(`top-level returns: ${topReturns.length}`);
