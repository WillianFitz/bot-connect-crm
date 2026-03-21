const fs = require("fs");
const path = require("path");

function copyExtension(name, files) {
  const src  = path.join(__dirname, "..", "extension", name);
  const dest = path.join(__dirname, "..", "public", "extensions", name);

  if (!fs.existsSync(src)) {
    console.warn(`copy-extension: extension/${name} not found, skipping.`);
    return;
  }
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  for (const file of files) {
    const from = path.join(src, file);
    const to   = path.join(dest, file);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to);
      console.log("copy-extension:", file);
    }
  }
}

// Instagram extractor
copyExtension("instagram", [
  "manifest.json", "background.js", "content-script.js",
  "dashboard.html", "dashboard.js", "popup.html", "popup.js", "injected.js",
  "icon16.png", "icon48.png", "icon128.png",
]);

// Google Maps extractor
copyExtension("gmaps", [
  "manifest.json", "background.js", "content-script.js",
  "dashboard.html", "dashboard.js", "popup.html", "popup.js",
  "icon16.png", "icon48.png", "icon128.png",
]);

console.log("copy-extension: done.");
