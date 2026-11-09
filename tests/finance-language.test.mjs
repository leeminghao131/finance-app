import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FINANCE_LANGUAGE_KEY, readFinanceLanguage, persistFinanceLanguage,
  translateFinanceText, builtInFinanceCategory,
} from "../src/financeLanguage.js";

const source=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const app=source("App.jsx");
const layer=source("FinanceLanguageLayer.jsx");
const files=[
  "App.jsx","FinanceTransferPanel.jsx","FinanceBudgetPanel.jsx",
  "FinanceForecastPanel.jsx","FinanceCsvImportPanel.jsx",
  "FinanceExcelExportPanel.jsx","FinanceOverlay.jsx",
];

test("Language selector is next to the Sound button and both views offer a switch",()=>{
  assert.match(app,/\{soundEnabled \? "🔊" : "🔇"\} Sound<\/button><FinanceLanguageButton/);
  assert.match(app,/<FinanceLanguageProvider><FinanceVisualizerAppContent \/><\/FinanceLanguageProvider>/);
  assert.ok((app.match(/<FinanceLanguageButton \/>/g)||[]).length>=2);
  assert.match(layer,/🌐 \{language === "zh" \? "中文" : "EN"\}/);
  assert.match(layer,/const toggleLanguage = \(\) => setLanguage\(current => current === "zh" \? "en" : "zh"\)/);
});

test("Language setting persists per browser and cannot write to cloud finance tables",()=>{
  const db=new Map();
  const storage={getItem:k=>db.get(k),setItem:(k,v)=>db.set(k,v)};
  assert.equal(readFinanceLanguage(storage),"zh");
  persistFinanceLanguage(storage,"en");
  assert.equal(db.get(FINANCE_LANGUAGE_KEY),"en");
  assert.equal(readFinanceLanguage(storage),"en");
  persistFinanceLanguage(storage,"zh");
  assert.equal(readFinanceLanguage(storage),"zh");
  persistFinanceLanguage(storage,"invalid");
  assert.equal(readFinanceLanguage(storage),"zh");
  assert.doesNotMatch(layer,/\.from\("(records|transfers|user_settings|monthly_budgets)"\)/);
  assert.doesNotMatch(layer,/\.insert\(|\.update\(|\.delete\(/);
});

test("Bilingual UI covers core app areas and complete screen titles",()=>{
  for(const [sourceText,chinese] of [
    ["Personal Finance Dashboard","个人财务看板"],
    ["Total Income","总收入"],
    ["Filtered Expense","筛选支出"],
    ["Money Transfer","资金转账"],
    ["Transaction Records","交易记录"],
    ["Monthly Budget / 分类预算","月度预算"],
    ["Cash Flow Forecast / 现金流预测","现金流预测"],
    ["Expected Income / 预计收入","预计收入"],
    ["CSV Import Preview / 导入预览","CSV 导入预览"],
    ["Complete Excel Export / 完整数据导出","完整 Excel 导出"],
    ["Recycle Bin / 回收站","回收站"],
    ["Sign out","退出登录"],
    ["Sound","声音"],
    ["Import CSV","导入 CSV"],
    ["Export Excel","导出 Excel"],
    ["Invalid login credentials","邮箱或密码错误"],
    ["Last 7 days","最近 7 天"],
  ]) {
    assert.equal(translateFinanceText(sourceText,"zh"),chinese,sourceText);
  }
  assert.equal(translateFinanceText("月度预算","en"),"Monthly Budget");
  assert.equal(translateFinanceText("记账可视化软件","en"),"Personal Finance Visualizer");
});

test("Canonical stored category names display in English but do not alter the originals",()=>{
  const names={
    "饮食":"Food & Drinks","教育":"Education","住房":"Housing",
    "日用":"Daily Essentials","交通":"Transportation",
    "娱乐":"Entertainment","运动":"Sports & Fitness",
    "医疗":"Medical","美容":"Beauty",
  };
  for(const [chinese,english] of Object.entries(names)){
    assert.equal(builtInFinanceCategory(chinese,"en"),english);
    assert.equal(builtInFinanceCategory(chinese,"zh"),chinese);
    assert.equal(translateFinanceText(english,"zh"),chinese);
  }
  assert.equal(translateFinanceText("My custom entry","zh"),"My custom entry");
  assert.equal(translateFinanceText("RM2500.00","zh"),"RM2500.00");
  assert.equal(translateFinanceText("2026-11-09","en"),"2026-11-09");
  assert.equal(translateFinanceText("💚 Income","zh"),"💚 收入");
});

test("Dynamic list counts, date filters and budget labels are translated without altering numbers",()=>{
  assert.equal(translateFinanceText("7 transfers · Latest 5 shown by default","zh"),"7 笔转账 · 默认只显示最近 5 笔");
  assert.equal(translateFinanceText("2 recoverable transfers","zh"),"2 笔可恢复转账");
  assert.equal(translateFinanceText("Show more (25 remaining)","zh"),"显示更多（剩余 25 条）");
  assert.equal(translateFinanceText("Budget for 2026-11 (RM)","zh"),"2026-11 预算（RM）");
  assert.equal(translateFinanceText("Save budget for 2026-11","zh"),"保存 2026-11 月份预算");
  assert.equal(translateFinanceText("Current filter: 最近 7 天","en"),"Current filter: Last 7 days");
  assert.equal(translateFinanceText("100.00","zh"),"100.00");
});

test("Translation boundary never touches select/input values and includes Vercel portal dialogs",()=>{
  assert.match(layer,/createTreeWalker\(node, NodeFilter\.SHOW_ELEMENT \| NodeFilter\.SHOW_TEXT\)/);
  assert.match(layer,/MutationObserver/);
  assert.match(layer,/document\.body/);
  assert.match(layer,/element\.setAttribute\(attribute, translated\)/);
  assert.match(layer,/data-i18n-ignore/);
  assert.doesNotMatch(layer,/\.value\s*=\s*translated/);
  assert.doesNotMatch(layer,/\.setItem\(.*category/);
  assert.match(layer,/document\.documentElement\.lang = language === "zh" \? "zh-CN" : "en"/);
  for(const file of files) assert.ok(source(file).length>100, file);
  assert.match(app,/data-i18n-ignore=\{field === "note"/);
});

test("Mixed-language legacy captions normalize in both directions", () => {
  assert.equal(translateFinanceText("今日摘要 ·","en"),"Today's overview ·");
  assert.equal(translateFinanceText("最大消费排行 ·","en"),"Largest expenses ·");
  assert.equal(translateFinanceText("记账可视化软件 · Data synced with Supabase cloud ·","en"),"Personal Finance Visualizer · Data synced with Supabase cloud ·");
  assert.equal(translateFinanceText("记账可视化软件 · Data synced with Supabase cloud ·","zh"),"记账可视化软件 · 数据已同步至 Supabase 云端 ·");
  assert.equal(translateFinanceText("Saved snapshot · version 3","zh"),"已保存的月度快照 · 版本 3");
  assert.equal(translateFinanceText("Income RM100.00 · Expense RM25.00","zh"),"收入 RM100.00 · 支出 RM25.00");
  assert.equal(translateFinanceText("Note, amount...","zh"),"备注、金额…");
});
