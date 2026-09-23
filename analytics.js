(() => {
  const measurementId = "G-XECHZYT8G1";
  const consentKey = "reverseprice.analytics-consent.v1";
  let loaded = false;

  if (!document.querySelector('link[rel~="icon"]')) {
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/svg+xml";
    favicon.href = "/favicon.svg";
    document.head.append(favicon);
  }

  function consent() {
    try {
      const value = localStorage.getItem(consentKey);
      return value === "granted" || value === "denied" ? value : null;
    } catch {
      return null;
    }
  }

  function safePageLocation() {
    const url = new URL(window.location.href);
    url.searchParams.delete("session_id");
    url.searchParams.delete("checkout");
    url.hash = "";
    return url.toString();
  }

  function track(name, parameters = {}) {
    if (!loaded || typeof window.gtag !== "function") return;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(name)) return;
    window.gtag("event", name, parameters);
  }

  function loadAnalytics() {
    if (loaded || consent() !== "granted") return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: safePageLocation(),
      page_title: document.title,
    });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.referrerPolicy = "strict-origin-when-cross-origin";
    script.dataset.reversepriceGa4 = measurementId;
    document.head.append(script);
  }

  function saveConsent(value) {
    try { localStorage.setItem(consentKey, value); } catch { /* Storage may be unavailable. */ }
    document.querySelector("[data-analytics-consent]")?.remove();
    if (value === "granted") {
      loadAnalytics();
    } else if (loaded && typeof window.gtag === "function") {
      window.gtag("consent", "update", { analytics_storage: "denied" });
    }
  }

  function showConsent(force = false) {
    if ((!force && consent()) || document.querySelector("[data-analytics-consent]")) return;
    const banner = document.createElement("aside");
    banner.dataset.analyticsConsent = "";
    banner.setAttribute("aria-label", "Analytics preferences");
    banner.innerHTML = '<div><strong>Help improve Take Home Fees</strong><span>Allow privacy-friendly Google Analytics so Mizzen Studios can see which pages and features help. Calculator values, CSV contents and Stripe session IDs are never sent.</span></div><div><button type="button" data-consent="denied">No thanks</button><button type="button" data-consent="granted">Allow analytics</button></div>';
    banner.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-consent]") : null;
      if (button) saveConsent(button.getAttribute("data-consent"));
    });
    document.body.append(banner);
  }

  window.addEventListener("reverseprice:analytics", (event) => {
    if (!(event instanceof CustomEvent) || !event.detail?.name) return;
    track(event.detail.name, event.detail.parameters);
  });

  function start() {
    document.querySelector("#analytics-settings")?.addEventListener("click", () => showConsent(true));
    loadAnalytics();
    showConsent();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
