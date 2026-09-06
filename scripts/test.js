// 테스트 실행기. 라이브러리를 더 넣지 않고 Node 의 node:test 와 프로젝트의 typescript 만 쓴다.
//   npm test
// src/ 아래 *.test.ts 를 모두 찾아 실행한다. 테스트는 네이티브 모듈(expo-*) 없이 순수 로직만 다룬다.

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

// .ts 파일을 그 자리에서 CommonJS 로 바꿔 require 할 수 있게 한다
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
};

function findTests(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") findTests(full, out);
    } else if (entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

const root = path.join(__dirname, "..", "src");
const files = findTests(root);
if (files.length === 0) {
  console.error("테스트 파일이 없습니다 (src/**/*.test.ts)");
  process.exit(1);
}
for (const f of files) require(f);
