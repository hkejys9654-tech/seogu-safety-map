import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(
  new URL("../.github/workflows/deploy-pages.yml", import.meta.url),
  "utf8"
);

assert.match(workflow, /id-token:\s*write/);
assert.match(workflow, /google-github-actions\/auth@v2/);
assert.match(
  workflow,
  /projects\/681010600408\/locations\/global\/workloadIdentityPools\/github-actions\/providers\/seogu-safety-map/
);
assert.match(
  workflow,
  /github-firestore-deployer@seogu-safety-map\.iam\.gserviceaccount\.com/
);
assert.match(
  workflow,
  /firebase deploy --only firestore:rules --project seogu-safety-map --non-interactive/
);
assert.doesNotMatch(workflow, /service_account_key|FIREBASE_TOKEN/);

console.log("Firestore automatic deployment checks passed");
