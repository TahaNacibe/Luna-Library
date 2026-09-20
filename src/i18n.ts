import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enTranslation from "./locales/en/translation.json";
import frTranslation from "./locales/fr/translation.json";
import arTranslation from "./locales/ar/translation.json";

/**
 * i18next configuration supporting English, French, and Arabic.
 * Updates document direction (dir="rtl" or "ltr") dynamically.
 */

const savedLanguage = localStorage.getItem("luna_language") || "en";

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: enTranslation,
    },
    fr: {
      translation: frTranslation,
    },
    ar: {
      translation: arTranslation,
    },
  },
  lng: savedLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

// Update document direction and lang attribute whenever language changes
const updateDocumentDirection = (lng: string) => {
  const isRtl = lng === "ar";
  document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", lng);
};

updateDocumentDirection(savedLanguage);

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("luna_language", lng);
  updateDocumentDirection(lng);
});

export default i18n;
