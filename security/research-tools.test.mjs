import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html = readFileSync(new URL("../research-tools.html", import.meta.url), "utf8");

test("research tools page is Persian, responsive and has all three modules", () => {
  assert.match(html, /<html lang="fa" dir="rtl">/);
  assert.match(html, /name="viewport"/);
  for (const id of ["research", "policy", "economics"]) assert.match(html, new RegExp('id="' + id + '"'));
  for (const id of ["r-run", "p-run", "e-run"]) assert.match(html, new RegExp('id="' + id + '"'));
});

test("inline JavaScript parses", () => {
  const scripts = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
  assert.ok(scripts.length > 0, "expected an inline script");
  for (const script of scripts) assert.doesNotThrow(() => new Function(script[1]));
});

test("module copy clearly describes demo limitations", () => {
  assert.match(html, /نسخهٔ آزمایشی/);
  assert.match(html, /نیازمند بازبینی متخصص/);
  assert.match(html, /ارسال نمی‌شود/);
});
