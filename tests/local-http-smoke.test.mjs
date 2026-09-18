import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const siteRoot = resolve("dist");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = normalize(pathname).replace(/^([/\\])+/, "") || "index.html";
    let filePath = resolve(join(siteRoot, relative));
    assert.ok(filePath === siteRoot || filePath.startsWith(`${siteRoot}\\`) || filePath.startsWith(`${siteRoot}/`));
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, "index.html");
    const body = await readFile(filePath);
    response.writeHead(200, { "content-type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not Found");
  }
});

await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
try {
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const [citizen, admin, config, adapter] = await Promise.all([
    fetch(`${origin}/`),
    fetch(`${origin}/admin/`),
    fetch(`${origin}/runtime-config.js`),
    fetch(`${origin}/kakao-map.js`)
  ]);
  assert.equal(citizen.status, 200);
  assert.equal(admin.status, 200);
  assert.equal(config.status, 200);
  assert.equal(adapter.status, 200);
  assert.match(await citizen.text(), /kakao-map\.js/);
  assert.match(await admin.text(), /kakao-map\.js/);
  assert.match(await config.text(), /kakaoJavaScriptKey/);
  console.log("Local HTTP smoke tests passed");
} finally {
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
}
