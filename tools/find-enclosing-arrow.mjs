import ts from "typescript";
import fs from "node:fs";

const file = process.argv[2];
const targetLine = Number(process.argv[3] ?? 0);
if (!file || !targetLine) process.exit(2);

const text = fs.readFileSync(file, "utf8");
const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const lines = text.split(/\r?\n/);
let pos = 0;
for (let i = 0; i < targetLine - 1; i++) pos += (lines[i]?.length ?? 0) + 1;

let bestDecl = null;
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer)) {
    const init = node.initializer;
    if (init.getStart(sf) <= pos && pos < init.getEnd()) {
      bestDecl = node;
    }
  }
  ts.forEachChild(node, visit);
};
visit(sf);

if (!bestDecl) {
  console.log("no enclosing arrow variable found");
  process.exit(1);
}

const name = bestDecl.name.getText(sf);
const init = bestDecl.initializer;
const start = sf.getLineAndCharacterOfPosition(init.getStart(sf));
const end = sf.getLineAndCharacterOfPosition(init.getEnd());
console.log(`${name}: lines ${start.line + 1}-${end.line + 1}`);
