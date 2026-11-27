import React from "react";

// Intentionally has no editable input: every expression is entered through large keys.
// All actual RM parsing and validation is delegated to the existing App.jsx calculator.
const ROWS = [
  [{key:"AC",label:"AC",kind:"util"}, {key:"(",label:"(",kind:"util"}, {key:")",label:")",kind:"util"}, {key:"DEL",label:"⌫",kind:"util"}],
  [{key:"7",label:"7"}, {key:"8",label:"8"}, {key:"9",label:"9"}, {key:"÷",label:"÷",kind:"op"}],
  [{key:"4",label:"4"}, {key:"5",label:"5"}, {key:"6",label:"6"}, {key:"×",label:"×",kind:"op"}],
  [{key:"1",label:"1"}, {key:"2",label:"2"}, {key:"3",label:"3"}, {key:"-",label:"−",kind:"op"}],
  [{key:"0",label:"0"}, {key:".",label:"."}, {key:"=",label:"=",kind:"equals"}, {key:"+",label:"+",kind:"op"}],
];

export default function FinanceCalculatorKeypad({ expression, result, onKey, onEquals, onFill, isChinese = true }) {
  return (
    <div className="mh-calc-keypad" aria-label={isChinese ? "数字键盘计算器" : "Numeric keypad calculator"}>
      <div className="mh-calc-keypad__screen" aria-live="polite">
        <p className="text-xs font-semibold tracking-wide text-slate-400">{isChinese ? "普通 RM 计算" : "Normal RM arithmetic"}</p>
        <output className="mh-calc-keypad__expression" aria-label={isChinese ? "计算表达式" : "Calculation expression"}>{expression || " "}</output>
        <output className="mh-calc-keypad__result" aria-label={isChinese ? "计算结果" : "Calculation result"}>
          {result === null ? " " : "RM " + Number(result).toLocaleString("en-MY", {minimumFractionDigits:2, maximumFractionDigits:2})}
        </output>
      </div>
      <div className="mh-calc-keypad__keys" role="group" aria-label={isChinese ? "计算器按键" : "Calculator keys"}>
        {ROWS.flat().map(({key,label,kind}) => (
          <button key={key} type="button" onClick={() => key === "=" ? onEquals() : onKey(key)}
            aria-label={key === "AC" ? (isChinese ? "全部清除" : "Clear all") :
              key === "DEL" ? (isChinese ? "退格" : "Backspace") :
              key === "=" ? (isChinese ? "计算结果" : "Equals") :
              key === "×" ? (isChinese ? "乘" : "Multiply") :
              key === "÷" ? (isChinese ? "除" : "Divide") : label}
            className={"mh-calc-keypad__key" + (kind ? " mh-calc-keypad__key--"+kind : "")}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" className="mh-calc-keypad__fill" onClick={onFill}>
        {isChinese ? "计算并填入金额" : "Calculate & Fill Amount"}
      </button>
    </div>
  );
}
