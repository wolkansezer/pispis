// src/ → www/ : yerel köprüyü paketler, uygulama sayfasını tam bir HTML belgesine çevirir.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";

mkdirSync("www", { recursive: true });

await build({
  entryPoints: ["src/native.js"],
  bundle: true,
  format: "iife",
  minify: true,
  target: ["safari15"],
  outfile: "www/native.js",
  logLevel: "warning"
});

const app = readFileSync("src/app.html", "utf8");
const head = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="format-detection" content="telephone=no">
<title>Pışpış</title>
<script src="native.js"></script>
</head>
<body>
`;
writeFileSync("www/index.html", head + app + "\n</body>\n</html>\n");
copyFileSync("assets/icon-1024.png", "www/icon.png");
console.log("www/ hazır");
