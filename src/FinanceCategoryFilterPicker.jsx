import React from "react";

// Opens inside the existing FinanceOverlay; selections only change dashboard view.
export default function FinanceCategoryFilterPicker({ choices, selectedKey, onSelect, formatCategoryLabel, isChinese }) {
  const sections = [
    { type: "expense", label: isChinese ? "支出分类" : "Expense Categories" },
    { type: "income", label: isChinese ? "收入分类" : "Income Categories" },
  ];
  return (
    <div className="mh-category-picker">
      <button type="button" aria-pressed={selectedKey === "all"}
        className={"mh-category-picker__item " + (selectedKey === "all" ? "is-selected" : "")}
        onClick={() => onSelect("all")}>
        <span>{isChinese ? "全部分类" : "All Categories"}</span>
        <span aria-hidden="true">{selectedKey === "all" ? "✓" : ""}</span>
      </button>
      {sections.map(section => (
        <section key={section.type} className="mh-category-picker__section">
          <h3 className="mh-category-picker__heading">{section.label}</h3>
          <div className="mh-category-picker__choices">
            {choices.filter(choice => choice.type === section.type).map(choice => (
              <button key={choice.key} type="button" aria-pressed={selectedKey === choice.key}
                className={"mh-category-picker__item " + (selectedKey === choice.key ? "is-selected" : "")}
                onClick={() => onSelect(choice.key)}>
                <span className="min-w-0 break-words" data-i18n-ignore>{formatCategoryLabel(choice.category)}</span>
                <span aria-hidden="true">{selectedKey === choice.key ? "✓" : ""}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
