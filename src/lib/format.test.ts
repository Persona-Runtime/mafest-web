import { describe, expect, test } from "vitest";
import { baseDateSummary } from "./format";
import type { InterpretedDomain } from "./types";

const d = (
  domain: InterpretedDomain["domain"],
  label: string,
  base_date: string | null,
): InterpretedDomain => ({ domain, label, status: "FOUND", base_date });

describe("baseDateSummary", () => {
  test("모두 같으면 하나로 합친다", () => {
    expect(
      baseDateSummary([
        d("kr_etf", "국내 ETF", "2026-08-21"),
        d("xx_etf", "해외 ETF", "2026-08-21"),
      ]),
    ).toEqual([{ label: null, date: "2026-08-21" }]);
  });

  test("다르면 상품군별로 나열한다(단일 기준일을 가정하지 않는다)", () => {
    expect(
      baseDateSummary([
        d("kr_etf", "국내 ETF", "2026-08-21"),
        d("bond", "채권", "2026-08-14"),
      ]),
    ).toEqual([
      { label: "국내 ETF", date: "2026-08-21" },
      { label: "채권", date: "2026-08-14" },
    ]);
  });

  test("기준일이 없으면 비운다", () => {
    expect(baseDateSummary([d("fund", "공모펀드", null)])).toEqual([]);
  });
});
