import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);
const defaultSiteUrl = "https://etsy-reverse-fee.online/";
const defaultBillingApi = "https://etsy-reverse-fee-billing-936568909385.europe-west2.run.app";
const siteUrl = (process.env.SITE_URL ?? defaultSiteUrl).replace(/\/?$/, "/");

if (!URL.canParse(siteUrl) || !siteUrl.startsWith("https://")) {
  throw new Error("SITE_URL must be an absolute https:// URL");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ["index.html", "styles.css", "analytics.js", "social-card.png", "robots.txt", "sitemap.xml", "404.html", "legal.css", "sample-listings.csv"]) {
  await cp(new URL(`../${entry}`, import.meta.url), new URL(entry, output));
}
for (const entry of ["terms", "privacy"]) {
  await cp(new URL(`../${entry}/`, import.meta.url), new URL(`${entry}/`, output), { recursive: true });
}
await cp(new URL("../src/", import.meta.url), new URL("src/", output), { recursive: true });

const appFile = new URL("src/app.js", output);
const appSource = await readFile(appFile, "utf8");
const billingApi = process.env.BILLING_API_URL ?? defaultBillingApi;
if (!billingApi || !URL.canParse(billingApi) || !billingApi.startsWith("https://")) {
  throw new Error("BILLING_API_URL must be an absolute https:// URL");
}
await writeFile(appFile, appSource.replace("__BILLING_API__", billingApi.replace(/\/$/, "")));

for (const entry of ["index.html", "robots.txt", "sitemap.xml", "terms/index.html", "privacy/index.html"]) {
  const file = new URL(entry, output);
  const source = await readFile(file, "utf8");
  await writeFile(file, source.replaceAll(defaultSiteUrl, siteUrl));
}
