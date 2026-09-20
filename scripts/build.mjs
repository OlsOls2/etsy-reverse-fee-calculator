import { cp, mkdir, rm } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ["index.html", "styles.css", "robots.txt", "sitemap.xml", "404.html"]) {
  await cp(new URL(`../${entry}`, import.meta.url), new URL(entry, output));
}
await cp(new URL("../src/", import.meta.url), new URL("src/", output), { recursive: true });
