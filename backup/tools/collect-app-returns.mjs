import ts from "typescript";

const file = process.argv[2];
if (!file) process.exit(2);

const configPath = ts.findConfigFile("./", ts.sys.fileExists, "tsconfig.json");
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, "./");
const program = ts.createProgram([file], parsed.options);
const checker = program.getTypeChecker();
const sf = program.getSourceFile(file);

let def = null;
sf.forEachChild((node) => {
  if (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
    def = node;
  }
});
if (!def?.body) process.exit(1);

const results = [];
const visit = (node, inNestedFn) => {
  const isNested =
    inNestedFn ||
    (ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      (ts.isFunctionDeclaration(node) && node !== def));

  if (ts.isReturnStatement(node)) {
    const pos = node.getStart(sf);
    const { line, character } = sf.getLineAndCharacterOfPosition(pos);
    const expr = node.expression;
    const exprType = expr ? checker.getTypeAtLocation(expr) : null;
    results.push({
      line: line + 1,
      col: character + 1,
      hasExpr: !!expr,
      exprType: exprType ? checker.typeToString(exprType) : "void",
    });
  }
  ts.forEachChild(node, (child) => visit(child, isNested));
};

visit(def.body, false);
results.sort((a, b) => a.line - b.line || a.col - b.col);
console.log(JSON.stringify(results, null, 2));
