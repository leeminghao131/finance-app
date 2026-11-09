import React, { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  readFinanceLanguage, persistFinanceLanguage, translateFinanceText,
} from "./financeLanguage.js";

const LanguageContext = createContext(null);
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const ATTRIBUTES = ["placeholder", "title", "aria-label"];
const OMIT = "script, style, noscript, textarea, input, pre, code, [contenteditable], [data-i18n-ignore]";

function shouldSkip(element) {
  return !!element?.closest?.(OMIT);
}

function updateTextNode(node, language) {
  if (node?.nodeType !== 3 || shouldSkip(node.parentElement)) return;
  const actual = node.nodeValue;
  let cached = originalText.get(node);
  if (!cached) {
    cached = { original: actual, rendered: null };
    originalText.set(node, cached);
  } else if (actual !== cached.original && actual !== cached.rendered) {
    // React has changed this text node: rebase the original source copy.
    cached.original = actual;
  }
  const translated = translateFinanceText(cached.original, language);
  cached.rendered = translated;
  if (actual !== translated) node.nodeValue = translated;
}

function updateAttribute(element, attribute, language) {
  if (shouldSkip(element) || !element.hasAttribute(attribute)) return;
  const actual = element.getAttribute(attribute);
  let all = originalAttributes.get(element);
  if (!all) { all = new Map(); originalAttributes.set(element, all); }
  let state = all.get(attribute);
  if (!state) {
    state = { original: actual, rendered: null };
    all.set(attribute, state);
  } else if (actual !== state.original && actual !== state.rendered) {
    state.original = actual;
  }
  const translated = translateFinanceText(state.original, language);
  state.rendered = translated;
  if (actual !== translated) element.setAttribute(attribute, translated);
}

function localizeNode(node, language) {
  if (!node) return;
  if (node.nodeType === 3) {
    updateTextNode(node, language);
    return;
  }
  if (node.nodeType !== 1 || shouldSkip(node)) return;
  for (const key of ATTRIBUTES) updateAttribute(node, key, language);
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current;
  while ((current = walker.nextNode())) {
    if (current.nodeType === 3) updateTextNode(current, language);
    else if (!shouldSkip(current)) {
      for (const key of ATTRIBUTES) updateAttribute(current, key, language);
    }
  }
}

// UI translation runs only on rendered text/attributes. It never changes input
// values, select option values, user notes marked data-i18n-ignore or cloud data.
function FinanceLanguageObserver({ language }) {
  const currentLanguage = useRef(language);
  useLayoutEffect(() => {
    currentLanguage.current = language;
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title = language === "zh" ? "记账可视化软件" : "Personal Finance Visualizer";
    localizeNode(document.body, language);
  }, [language]);

  useLayoutEffect(() => {
    const observer = new MutationObserver((mutations) => {
      const languageNow = currentLanguage.current;
      for (const change of mutations) {
        if (change.type === "characterData") {
          updateTextNode(change.target, languageNow);
        } else if (change.type === "attributes") {
          updateAttribute(change.target, change.attributeName, languageNow);
        } else if (change.type === "childList") {
          for (const added of change.addedNodes) localizeNode(added, languageNow);
        }
      }
    });
    observer.observe(document.body, {
      childList: true, characterData: true, attributes: true, subtree: true,
      attributeFilter: ATTRIBUTES,
    });
    localizeNode(document.body, currentLanguage.current);
    return () => observer.disconnect();
  }, []);
  return null;
}

export function FinanceLanguageProvider({ children }) {
  const [language, setLanguage] = useState(() =>
    readFinanceLanguage(typeof window === "undefined" ? null : window.localStorage)
  );
  const toggleLanguage = () => setLanguage(current => current === "zh" ? "en" : "zh");
  useLayoutEffect(() => {
    persistFinanceLanguage(typeof window === "undefined" ? null : window.localStorage, language);
  }, [language]);
  const value = useMemo(() => ({ language, toggleLanguage }), [language]);
  return (
    <LanguageContext.Provider value={value}>
      <FinanceLanguageObserver language={language} />
      {children}
    </LanguageContext.Provider>
  );
}

export function useFinanceLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("FinanceLanguageProvider is required");
  return context;
}

export function FinanceLanguageButton({ className = "" }) {
  const { language, toggleLanguage } = useFinanceLanguage();
  const title = language === "zh" ? "切换至英文" : "Switch to Chinese";
  return (
    <button type="button" onClick={toggleLanguage}
      title={title} aria-label={title} aria-pressed={language === "en"}
      className={"rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white ring-1 ring-slate-600 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 " + className}>
      🌐 {language === "zh" ? "中文" : "EN"}
    </button>
  );
}

export function localizedFinanceAlert(message, language = null) {
  const current = language || readFinanceLanguage(typeof window === "undefined" ? null : window.localStorage);
  return window.alert(translateFinanceText(String(message), current));
}
export function localizedFinanceConfirm(message, language = null) {
  const current = language || readFinanceLanguage(typeof window === "undefined" ? null : window.localStorage);
  return window.confirm(translateFinanceText(String(message), current));
}
