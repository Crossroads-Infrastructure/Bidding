"use client";

import { useState } from "react";

// Recipe quantities (hours/unit, material qty/unit) are naturally awkward
// to enter directly -- you know "100 LF of silt fence per crew hour" or
// "14 LF of curb per yard of concrete," not the reciprocal the database
// actually stores. This lets either be typed in and always emits the
// stored per-unit value via onChange, so callers never need their own
// conversion math.
export function UnitRateInput({
  perUnitLabel,
  rateLabel,
  value,
  onChange,
  widthClassName = "w-24",
}: {
  perUnitLabel: string;
  rateLabel: string;
  value: string;
  onChange: (perUnitValue: string) => void;
  widthClassName?: string;
}) {
  const [mode, setMode] = useState<"per_unit" | "rate">("per_unit");

  const displayValue = (() => {
    if (value === "") return "";
    if (mode === "per_unit") return value;
    const n = Number(value);
    if (!n) return "";
    return String(1 / n);
  })();

  function handleInput(text: string) {
    if (text.trim() === "") {
      onChange("");
      return;
    }
    const n = Number(text);
    if (Number.isNaN(n)) return;
    onChange(mode === "rate" ? (n !== 0 ? String(1 / n) : "") : text);
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="any"
          placeholder={mode === "rate" ? rateLabel : perUnitLabel}
          value={displayValue}
          onChange={(e) => handleInput(e.target.value)}
          className={`${widthClassName} rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800`}
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "per_unit" | "rate")}
          className="rounded border border-zinc-300 bg-transparent px-1 py-1 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="per_unit">{perUnitLabel}</option>
          <option value="rate">{rateLabel}</option>
        </select>
      </div>
      {mode === "rate" && value !== "" && (
        <span className="text-[10px] text-zinc-400">= {Number(value).toFixed(4)} {perUnitLabel}</span>
      )}
    </div>
  );
}
