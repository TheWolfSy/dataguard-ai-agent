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

if (!def) {
  console.log("no default function export");
  process.exit(1);
}

const sig = checker.getSignatureFromDeclaration(def);
if (!sig) {
  console.log("no signature");
  process.exit(1);
}
const ret = checker.getReturnTypeOfSignature(sig);
console.log(`signature: ${checker.signatureToString(sig)}`);
console.log(`return: ${checker.typeToString(ret)}`);

let firstJsx = null;
const visit = (n) => {
  if (!firstJsx && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n))) {
    firstJsx = n;
    return;
  }
  ts.forEachChild(n, visit);
};
visit(def);
if (firstJsx) {
  const jsxType = checker.getTypeAtLocation(firstJsx);
  console.log(`first jsx type: ${checker.typeToString(jsxType)}`);
}
