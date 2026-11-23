import fs from "node:fs";
import path from "node:path";

const localesRoot = path.resolve("public/locales");
const locales = ["en", "hi", "de", "fr", "ja", "ar"];
const namespaces = ["claims", "dashboard", "dashboardLayout", "addClaims", "adminUsers", "approvals", "payments"];

const flatten = (value, prefix = "") =>
  Object.entries(value).flatMap(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? flatten(child, fullKey)
      : [fullKey];
  });

let hasDifferences = false;
for (const namespace of namespaces) {
  const keysByLocale = Object.fromEntries(
    locales.map((locale) => {
      const file = path.join(localesRoot, locale, `${namespace}.json`);
      return [locale, new Set(flatten(JSON.parse(fs.readFileSync(file, "utf8"))))];
    })
  );
  const reference = keysByLocale.en;
  for (const locale of locales.slice(1)) {
    const missing = [...reference].filter((key) => !keysByLocale[locale].has(key));
    const extra = [...keysByLocale[locale]].filter((key) => !reference.has(key));
    if (missing.length || extra.length) {
      hasDifferences = true;
      console.log(`${namespace}/${locale}: missing=[${missing.join(", ")}] extra=[${extra.join(", ")}]`);
    }
  }
}

if (hasDifferences) {
  process.exitCode = 1;
} else {
  console.log("All locale namespace key sets match.");
}
