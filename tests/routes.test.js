import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { parseRoute, practicePath } from "../src/routes.js";

test("practice URLs round-trip identifiers and reject malformed paths", () => {
  const source = { kind: "youtube", videoId: "dQw4w9WgXcQ" };
  for (const id of [undefined, "phrase-123", "older phrase #1"]) {
    const route = parseRoute(practicePath(source, id));
    assert.equal(route.videoId, source.videoId);
    assert.equal(route.phraseId, id || null);
  }
  for (const path of [
    "/pr/nope",
    "/pr/dQw4w9WgXcQ/bad%2Fid",
    "/pr/dQw4w9WgXcQ/%ZZ",
    "/pr/dQw4w9WgXcQ/one/two",
  ])
    assert.equal(parseRoute(path).error, true);
  assert.equal(parseRoute("/saved").view, "saved");
  assert.equal(parseRoute("/training").view, "training");
  assert.equal(practicePath({ kind: "file" }, "phrase"), "/");
});

test("CloudFront serves deep links without rewriting missing static files", () => {
  const context = vm.createContext({});
  vm.runInContext(
    readFileSync(new URL("../infra/route-request.js", import.meta.url), "utf8"),
    context,
  );
  for (const uri of [
    "/pr/dQw4w9WgXcQ",
    "/pr/dQw4w9WgXcQ/phrase-123",
    "/pr/dQw4w9WgXcQ/older%20phrase%20%231",
    "/saved",
    "/training/",
  ]) {
    for (const method of ["GET", "HEAD"])
      assert.equal(
        context.handler({ request: { uri, method } }).uri,
        "/index.html",
      );
  }
  for (const uri of [
    "/assets/missing.js",
    "/recordings/audio/missing.mp3",
    "/recordings/catalog.json",
    "/favicon.svg",
    "/unrelated",
    "/pr/invalid",
  ])
    assert.equal(context.handler({ request: { uri, method: "GET" } }).uri, uri);
  assert.equal(
    context.handler({ request: { uri: "/saved", method: "POST" } }).uri,
    "/saved",
  );
});
