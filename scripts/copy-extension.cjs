const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "extension", "instagram");
const dest = path.join(__dirname, "..", "public", "extensions", "instagram");

if (!fs.existsSync(src)) {
  console.warn("copy-extension: extension/instagram not found, skipping.");
  process.exit(0);
}

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

const files = [
  "manifest.json",
  "background.js",
  "content-script.js",
  "dashboard.html",
  "dashboard.js",
  "popup.html",
  "popup.js",
];
if (fs.existsSync(path.join(src, "injected.js"))) files.push("injected.js");

for (const file of files) {
  const from = path.join(src, file);
  const to = path.join(dest, file);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
    console.log("copy-extension:", file);
  }
}

console.log("copy-extension: done.");
