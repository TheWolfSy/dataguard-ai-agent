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

let best = sf;
const parents = new Map();
const visit = (node, parent) => {
  if (parent) parents.set(node, parent);
  if (node.getStart(sf) <= pos && pos < node.getEnd()) best = node;
  ts.forEachChild(node, (ch) => visit(ch, node));
};
visit(sf, null);

const chain = [];
let cur = best;
while (cur) {
  chain.push(ts.SyntaxKind[cur.kind]);
  cur = parents.get(cur);
}
console.log(chain.slice(0, 20).join(" <- "));
