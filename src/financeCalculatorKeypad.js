// Display-only keypad input construction; all monetary validation/evaluation remains in App.jsx.
// The keypad uses ordinary RM math (not cents-keypad parsing).
const OPERATOR = new Set(["+", "-", "×", "÷"]);
const MAX_EXPRESSION_LENGTH = 100;

export function nextCalculatorText(previous, key) {
  const text = String(previous ?? "");
  if (key === "AC") return "";
  if (key === "DEL") return text.slice(0, -1);
  if (text.length >= MAX_EXPRESSION_LENGTH) return text;
  if (typeof key !== "string" || !/^(?:[0-9]|[.+\-×÷()])$/.test(key)) return text;

  const last = text.slice(-1);
  if (OPERATOR.has(key)) {
    if (!text) return key === "-" ? "-" : "";
    if (last === "(" && key !== "-") return text;
    if (OPERATOR.has(last)) {
      // Keep unary minus after an opening bracket; otherwise replace a mistyped operator.
      if (last === "-" && text.endsWith("(-")) return text;
      return text.slice(0, -1) + key;
    }
    if (last === ".") return text.slice(0, -1) + key;
    return text + key;
  }
  if (key === ".") {
    if (last === ")") return text;
    const current = text.split(/[+\-×÷()]/).at(-1) ?? "";
    if (current.includes(".")) return text;
    return text + (current ? "." : "0.");
  }
  if (key === "(") {
    if (/[0-9.)]/.test(last)) return text;
    return text + "(";
  }
  if (key === ")") {
    const openings = (text.match(/\(/g) || []).length;
    const closings = (text.match(/\)/g) || []).length;
    if (openings <= closings || !/[0-9)]/.test(last)) return text;
    return text + ")";
  }
  if (key >= "0" && key <= "9") {
    if (last === ")") return text;
    return text + key;
  }
  return text;
}
