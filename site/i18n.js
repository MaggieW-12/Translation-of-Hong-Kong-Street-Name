(() => {
  const storageKey = "hk-street-name-language";
  const supported = ["en", "zh"];

  const copy = {
    en: {
      all: "All",
      resultOne: "result",
      resultMany: "results",
      networkSummary: "{terms} English terms and {chars} Chinese components across {links} links.",
      noData: "No entries match the current filters.",
      categories: {
        all: "All strategies",
        phonetic_transliteration: "Phonetic",
        semantic_translation: "Semantic",
        hybrid_phonetic_semantic: "Hybrid",
        conventional_or_indirect: "Conventional",
      },
      checked: { all: "All entries", yes: "Checked", no: "Not yet checked" },
      scoreAll: "All scores",
      roadAll: "All road types",
      count: "{count} shown",
      active: "Active:",
      searchActive: "search “{value}”",
      scoreBand: "sound score {value}",
      linkOne: "link",
      linkMany: "links",
      chartRoot: "street names",
      enter: "Open this term in the search",
    },
    zh: {
      all: "全部",
      resultOne: "項結果",
      resultMany: "項結果",
      networkSummary: "{terms} 個英文詞、{chars} 個中文字及 {links} 個連繫。",
      noData: "沒有符合目前條件的資料。",
      categories: {
        all: "所有策略",
        phonetic_transliteration: "音譯",
        semantic_translation: "意譯",
        hybrid_phonetic_semantic: "音意混合",
        conventional_or_indirect: "慣用或間接",
      },
      checked: { all: "全部資料", yes: "已核對", no: "尚未核對" },
      scoreAll: "全部分數",
      roadAll: "全部道路類型",
      count: "顯示 {count} 項",
      active: "目前條件：",
      searchActive: "搜尋「{value}」",
      scoreBand: "語音分數 {value}",
      linkOne: "個連繫",
      linkMany: "個連繫",
      chartRoot: "街道名稱",
      enter: "在搜尋器打開此詞",
    },
  };

  let language = "en";

  function interpolate(text, values = {}) {
    return String(text).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  }

  function t(key, values = {}) {
    const parts = key.split(".");
    let value = copy[language];
    for (const part of parts) {
      value = value?.[part];
    }
    return interpolate(value ?? key, values);
  }

  function apply(lang, persist = true) {
    language = supported.includes(lang) ? lang : "en";
    document.documentElement.dataset.lang = language;
    document.documentElement.lang = language === "zh" ? "zh-Hant" : "en";

    document.querySelectorAll("[data-en][data-zh]").forEach((element) => {
      element.textContent = element.dataset[language];
    });
    document.querySelectorAll("[data-en-placeholder][data-zh-placeholder]").forEach((element) => {
      element.placeholder = element.dataset[`${language}Placeholder`];
    });
    document.querySelectorAll("[data-en-aria][data-zh-aria]").forEach((element) => {
      element.setAttribute("aria-label", element.dataset[`${language}Aria`]);
    });
    document.querySelectorAll("[data-en-title][data-zh-title]").forEach((element) => {
      element.title = element.dataset[`${language}Title`];
    });
    document.querySelectorAll("[data-language-choice]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.languageChoice === language),
      );
    });

    if (persist) {
      try {
        localStorage.setItem(storageKey, language);
      } catch {
        // Local storage may be unavailable in privacy-restricted browsers.
      }
    }

    const url = new URL(window.location.href);
    if (language === "en") {
      url.searchParams.delete("lang");
    } else {
      url.searchParams.set("lang", language);
    }
    window.history.replaceState({}, "", url);
    document.dispatchEvent(
      new CustomEvent("app:language", { detail: { language } }),
    );
  }

  function initialLanguage() {
    const requested = new URLSearchParams(window.location.search).get("lang");
    if (supported.includes(requested)) return requested;
    try {
      const saved = localStorage.getItem(storageKey);
      if (supported.includes(saved)) return saved;
    } catch {
      // Fall through to English.
    }
    return "en";
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-language-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        apply(button.dataset.languageChoice);
      });
    });
    apply(initialLanguage(), false);
  });

  window.APP_I18N = {
    apply,
    get language() {
      return language;
    },
    t,
  };
})();
