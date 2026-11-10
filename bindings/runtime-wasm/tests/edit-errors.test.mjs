import assert from "node:assert/strict";
import { test } from "node:test";
import { startCore } from "../js/client.js";

test("Worker edit failures retain diagnostic fields and legacy Error shape", async () => {
  const originalWorker = globalThis.Worker;
  let response;
  globalThis.Worker = class {
    listeners = {};
    addEventListener(name, callback) { this.listeners[name] = callback; }
    postMessage({ id }) { queueMicrotask(() => this.listeners.message({ data: { id, ...response } })); }
    terminate() {}
  };
  const core = startCore();
  try {
    response = { error: "a refused edit", code: "RNL8619", name: "edit-set-nothing", diagnostics: [{ line: 2 }] };
    await assert.rejects(core.write({ write: {} }), (error) => {
      assert.equal(error.message, response.error);
      assert.equal(error.code, response.code);
      assert.equal(error.diagnosticName, response.name);
      assert.deepEqual(error.diagnostics, response.diagnostics);
      return true;
    });
    response = { error: "legacy failure" };
    await assert.rejects(core.write({ write: {} }), (error) => {
      assert.equal(error.message, response.error);
      assert.equal(Object.hasOwn(error, "code"), false);
      assert.equal(Object.hasOwn(error, "diagnostics"), false);
      return true;
    });
  } finally {
    core.terminate();
    globalThis.Worker = originalWorker;
  }
});
