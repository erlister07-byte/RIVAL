// Actual handler fault injection: no network, credentials, or database mutations.
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const path = require("node:path"), cp = require("node:child_process");
const root = path.resolve(__dirname, "../../..");
const ts = require(path.join(root, "node_modules/typescript"));
const source = process.env.SECURITY_QA_BASELINE
  ? cp.execFileSync("git", ["show", "c901db82:supabase/functions/create-challenge/index.ts"], {cwd: root, encoding: "utf8"})
  : fs.readFileSync(path.join(root, "supabase/functions/create-challenge/index.ts"), "utf8");
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
const body = {sportId: 3, scheduledAt: "2030-01-01T12:00:00Z", locationName: "Local QA", challengeType: "casual", isOpen: true};
(async () => {
  const failures = [];
  for (const mode of ["database-failure", "unauthenticated", "unexpected-exception"]) {
    let handler;
    const chain = {select(){return this;}, eq(){return this;}, async maybeSingle(){
      if(mode === "unexpected-exception") throw new Error("LOCAL_DIAGNOSTIC_SENTINEL");
      return {data: null, error: {message: "LOCAL_DIAGNOSTIC_SENTINEL", code: "XX000"}};
    }};
    vm.runInNewContext(js, {exports: {}, Request, Response, Error, console: {error(){}},
      Deno: {env: {get: () => "synthetic-test-only"}, serve: fn => handler = fn},
      require: name => name.includes("auth.ts") ? {getAuthenticatedUserId: async () => {
        if (mode === "unauthenticated") throw new Error("Invalid or expired Supabase session");
        return "synthetic-actor";
      }} : name.includes("block.ts") ? {isPairBlocked: async () => false} : {createClient: () => ({from: () => chain})}
    });
    const response = await handler(new Request("http://localhost/create-challenge", {method: "POST", body: JSON.stringify(body)}));
    const payload = await response.json();
    try {
      assert.equal(response.status, mode === "unauthenticated" ? 401 : 500);
      assert.equal(payload.error, mode === "unauthenticated" ? "Authentication required" : "Unable to create challenge");
      console.log(mode + ": PASS");
    } catch { failures.push(mode); }
  }
  assert.deepEqual(failures, [], "Safe error regression failures");
})().catch(error => {console.error(error.message); process.exitCode = 1;});
