import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);
const defaultSiteUrl = "https://etsy-reverse-fee.web.app/";
const siteUrl = (process.env.SITE_URL ?? defaultSiteUrl).replace(/\/?$/, "/");

if (!URL.canParse(siteUrl) || !siteUrl.startsWith("https://")) {
  throw new Error("SITE_URL must be an absolute https:// URL");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ["index.html", "styles.css", "robots.txt", "sitemap.xml", "404.html"]) {
  await cp(new URL(`../${entry}`, import.meta.url), new URL(entry, output));
}
await cp(new URL("../src/", import.meta.url), new URL("src/", output), { recursive: true });

for (const entry of ["index.html", "robots.txt", "sitemap.xml"]) {
  const file = new URL(entry, output);
  const source = await readFile(file, "utf8");
  await writeFile(file, source.replaceAll(defaultSiteUrl, siteUrl));
}
