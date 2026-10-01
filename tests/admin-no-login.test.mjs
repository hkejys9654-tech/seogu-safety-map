import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, adminScript, serviceScript, rules] = await Promise.all([
  readFile(new URL("../admin/index.html", import.meta.url), "utf8"),
  readFile(new URL("../admin/app.js", import.meta.url), "utf8"),
  readFile(new URL("../firebase-service.js", import.meta.url), "utf8"),
  readFile(new URL("../firestore.rules", import.meta.url), "utf8")
]);

assert.doesNotMatch(html, /id="auth-gate"|id="sign-in"|id="sign-out"/);
assert.match(html, /<section id="admin-app" class="view" aria-labelledby="admin-title">/);
assert.doesNotMatch(adminScript, /startAuthentication|signInAdmin|onAuthChanged|checkAdmin/);
assert.match(adminScript, /const ADMIN_LABEL = "관리자";/);
assert.doesNotMatch(serviceScript, /firebase-auth\.js|GoogleAuthProvider|signInWithPopup/);
assert.match(rules, /match \/reports\/\{reportId\}[\s\S]*?allow read: if true;/);
assert.match(rules, /request\.resource\.data\.reviewerEmail == '관리자'/);
assert.match(rules, /request\.resource\.data\.updatedBy == '관리자'/);
assert.match(rules, /request\.resource\.data\.updatedAt is timestamp/);
assert.match(rules, /request\.resource\.data\.editedAt is timestamp/);
assert.doesNotMatch(rules, /request\.resource\.data\.(?:updatedAt|editedAt) == request\.time/);

console.log("admin no-login checks passed");
