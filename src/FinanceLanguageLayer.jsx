import React, { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  readFinanceLanguage, persistFinanceLanguage, translateFinanceText,
} from "./financeLanguage.js";

const LanguageContext = createContext(null);
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const ATTRIBUTES = ["placeholder", "title", "aria-label"];
const OMIT = "script, style, noscript, pre, code, [contenteditable], [data-i18n-ignore]";

function shouldSkip(element) {
  return !!element?.closest?.(OMIT);
}

function updateTextNode(node, language) {
  if (node?.nodeType !== 3 || shouldSkip(node.parentElement) || node.parentElement?.closest?.("textarea, input")) return;
  const actual = node.nodeValue;
  let cached = originalText.get(node);
  if (!cached) {
    cached = { original: actual, rendered: null };
    originalText.set(node, cached);
  } else if (actual !== cached.original && actual !== cached.rendered) {
    // React has changed this text node: rebase the original source copy.
    cached.original = actual;
  }
  if (cached.language === language && actual === cached.rendered) return;
  const translated = translateFinanceText(cached.original, language);
  cached.language = language;
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
  if (state.language === language && actual === state.rendered) return;
  const translated = translateFinanceText(state.original, language);
  state.language = language;
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
      // React can emit overlapping mutations for the same new subtree.
      // Translate each added root once, then skip descendant text/attributes
      // already covered by that root. Keep the exact synchronous translation
      // semantics and leave all user content/input values untouched.
      const addedRoots = new Set();
      const changedText = new Set();
      const changedAttributes = new Map();
      for (const change of mutations) {
        if (change.type === "childList") {
          for (const added of change.addedNodes) addedRoots.add(added);
        } else if (change.type === "characterData") {
          changedText.add(change.target);
        } else if (change.type === "attributes") {
          let attributes = changedAttributes.get(change.target);
          if (!attributes) {
            attributes = new Set();
            changedAttributes.set(change.target, attributes);
          }
          attributes.add(change.attributeName);
        }
      }
      const coveredByAddedAncestor = node => {
        for (let parent = node.parentNode; parent; parent = parent.parentNode) {
          if (addedRoots.has(parent)) return true;
        }
        return false;
      };
      for (const root of addedRoots) {
        if (root.isConnected && !coveredByAddedAncestor(root)) localizeNode(root, languageNow);
      }
      for (const node of changedText) {
        if (node.isConnected && !addedRoots.has(node) && !coveredByAddedAncestor(node))
          updateTextNode(node, languageNow);
      }
      for (const [element, attributes] of changedAttributes) {
        if (!element.isConnected || addedRoots.has(element) || coveredByAddedAncestor(element)) continue;
        for (const attribute of attributes) updateAttribute(element, attribute, languageNow);
      }
    });
    observer.observe(document.body, {
      childList: true, characterData: true, attributes: true, subtree: true,
      attributeFilter: ATTRIBUTES,
    });
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

export function FinanceLanguageButton({ className = "", compactOnMobile = false }) {
  const { language, toggleLanguage } = useFinanceLanguage();
  const title = language === "zh" ? "切换至英文" : "Switch to Chinese";
  return (
    <button type="button" onClick={toggleLanguage}
      title={title} aria-label={title} aria-pressed={language === "en"}
      className={"rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white ring-1 ring-slate-600 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 " + className}>
      {compactOnMobile ? <><span aria-hidden="true">🌐</span><span className="hidden sm:inline"> {language === "zh" ? "中文" : "EN"}</span></> : <>🌐 {language === "zh" ? "中文" : "EN"}</>}
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
