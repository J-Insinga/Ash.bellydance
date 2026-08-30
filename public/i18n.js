"use strict";

(() => {
  const SUPPORTED = ["fr", "en", "es", "it", "de", "ar"];
  const STORAGE_KEY = "byfiggy-language-v2";
  const LEGACY_STORAGE_KEY = "byfiggy-language";
  const DEFAULT_LANGUAGE = "fr";

  function safeLanguage(value) {
    return SUPPORTED.includes(value) ? value : DEFAULT_LANGUAGE;
  }

  function getLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;

    return DEFAULT_LANGUAGE;
  }

  function translate(key, fallback = "") {
    const lang = getLanguage();
    const table = window.BYFIGGY_TRANSLATIONS || {};
    return table[lang]?.[key] ?? table.fr?.[key] ?? fallback ?? key;
  }

  function applyTranslations() {
    const lang = getLanguage();
    const rtl = lang === "ar";

    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.body.classList.toggle("rtl", rtl);

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = translate(el.dataset.i18n, el.textContent);
    });

    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = translate(el.dataset.i18nHtml, el.innerHTML);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = translate(el.dataset.i18nPlaceholder, el.placeholder);
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", translate(el.dataset.i18nAriaLabel, el.getAttribute("aria-label") || ""));
    });

    document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
      el.setAttribute("alt", translate(el.dataset.i18nAlt, el.getAttribute("alt") || ""));
    });

    document.querySelectorAll("[data-price-eur]").forEach((el) => {
      const amount = Number(el.dataset.priceEur);
      if (!Number.isFinite(amount)) return;

      try {
        el.textContent = new Intl.NumberFormat(
          lang === "fr" ? "fr-FR" :
          lang === "en" ? "en-GB" :
          lang === "es" ? "es-ES" :
          lang === "it" ? "it-IT" :
          lang === "de" ? "de-DE" : "ar",
          { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 }
        ).format(amount);
      } catch {
        el.textContent = `${amount} €`;
      }
    });

    const titleKey = document.body?.dataset.pageTitle;
    if (titleKey) document.title = translate(titleKey, document.title);

    document.querySelectorAll(".language-switcher [data-lang]").forEach((button) => {
      const active = button.dataset.lang === lang;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    document.title = document.title;
  }

  function setLanguage(lang) {
    const next = safeLanguage(lang);
    localStorage.setItem(STORAGE_KEY, next);
    applyTranslations();
    window.dispatchEvent(new CustomEvent("byfiggy:languagechange", { detail: { language: next } }));
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".language-switcher [data-lang]");
    if (!button) return;
    setLanguage(button.dataset.lang);
  });

  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* stockage indisponible */
  }

  window.BYFIGGY_T = translate;
  window.BYFIGGY_SET_LANGUAGE = setLanguage;
  window.BYFIGGY_GET_LANGUAGE = getLanguage;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyTranslations, { once: true });
  } else {
    applyTranslations();
  }
})();