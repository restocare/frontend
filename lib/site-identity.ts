/** Single source of truth for RestoCare's identity, shared by JSON-LD emitters. */
export const SITE_URL = "https://www.restocare.in";
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const ORGANIZATION_REF = { "@id": ORGANIZATION_ID };

export const organizationJsonLd = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "RestoCare",
  legalName: "Restroedge Private Limited",
  url: SITE_URL,
  logo: "https://www.restocare.in/icon.png",
  email: "support@restocare.in",
  areaServed: { "@type": "AdministrativeArea", name: "Delhi NCR" },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+91-9953532995",
    contactType: "customer service",
    areaServed: "IN",
    availableLanguage: ["en", "hi"],
  },
  sameAs: [
    "https://www.instagram.com/restocare_/",
    "https://www.facebook.com/profile.php?id=61584401909814",
    "https://www.linkedin.com/company/resto-care1111/",
    "https://www.youtube.com/@restocare.1",
    "https://apps.apple.com/in/app/restocare-stop-revenue-loss/id6787001148",
    "https://play.google.com/store/apps/details?id=com.restocare.customer",
  ],
};

export const websiteJsonLd = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: SITE_URL,
  name: "RestoCare",
  publisher: ORGANIZATION_REF,
};

export function siteJsonLd(): string {
  const data = {
    "@context": "https://schema.org",
    "@graph": [organizationJsonLd, websiteJsonLd],
  };
  // "<" escaped so a value can never close the script tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
