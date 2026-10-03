import { describe, expect, test } from "vitest";
import {
  ALL_SEARCH_FIXTURES,
  answered,
  meta,
  OUTCOME_FIXTURES,
  PRODUCT_FIXTURES,
} from "./fixtures";
import { OUTCOMES } from "./types";
import {
  ContractError,
  validateMeta,
  validateProductDetail,
  validateSearchResponse,
} from "./validate";

/*
 * 계약 테스트(37 W2). 픽스처가 계약(types.ts·validate.ts)을 지키는지 본다.
 * 서버(P7)도 같은 계약을 지켜야 하며, 실제 서버 대조는 api.live.test.ts가 한다.
 */

const clone = <T>(value: T): T => structuredClone(value);

describe("픽스처", () => {
  test("outcome 8종이 하나씩 있다", () => {
    expect(Object.keys(OUTCOME_FIXTURES).sort()).toEqual([...OUTCOMES].sort());
    for (const [outcome, fixture] of Object.entries(OUTCOME_FIXTURES))
      expect(fixture.outcome).toBe(outcome);
  });

  test.each(ALL_SEARCH_FIXTURES.map((f) => [f.request_id, f] as const))(
    "검색 응답 %s 가 계약을 지킨다",
    (_, fixture) => {
      expect(() => validateSearchResponse(clone(fixture))).not.toThrow();
    },
  );

  test("상품 상세와 메타가 계약을 지킨다", () => {
    expect(PRODUCT_FIXTURES.length).toBeGreaterThan(0);
    for (const detail of PRODUCT_FIXTURES)
      expect(() => validateProductDetail(clone(detail))).not.toThrow();
    expect(() => validateMeta(clone(meta))).not.toThrow();
  });

  test("결과 행의 상품은 모두 상세가 있다", () => {
    for (const fixture of ALL_SEARCH_FIXTURES)
      for (const group of fixture.results)
        for (const row of group.rows)
          expect(
            PRODUCT_FIXTURES.some(
              (p) =>
                p.domain === group.domain && p.product_id === row.product_id,
            ),
          ).toBe(true);
  });

  test("합성 값만 쓴다: 상품명은 SAMPLE·DEMO로 시작한다", () => {
    for (const detail of PRODUCT_FIXTURES)
      expect(detail.name).toMatch(/^(SAMPLE|DEMO)/);
  });
});

describe("계약 위반을 잡는다", () => {
  function pathOf(mutate: (r: Record<string, unknown>) => void): string {
    const broken = clone(answered) as unknown as Record<string, unknown>;
    mutate(broken);
    try {
      validateSearchResponse(broken);
    } catch (error) {
      if (error instanceof ContractError) return error.path;
      throw error;
    }
    return "통과함";
  }

  test("목록 밖 outcome", () => {
    expect(pathOf((r) => (r.outcome = "maybe"))).toBe("outcome");
  });

  test("라우터 내부 도메인 이름(etf_kr)은 받지 않는다", () => {
    expect(
      pathOf((r) => {
        (
          r.interpretation as { domains: { domain: string }[] }
        ).domains[0].domain = "etf_kr";
      }),
    ).toBe("interpretation.domains[0].domain");
  });

  test("단일 as_of 대신 base_date 형식을 검사한다", () => {
    expect(
      pathOf((r) => {
        (
          r.interpretation as { domains: { base_date: string }[] }
        ).domains[0].base_date = "2026/08/21";
      }),
    ).toBe("interpretation.domains[0].base_date");
  });

  test("열 정의에 없는 값", () => {
    expect(
      pathOf((r) => {
        const rows = (r.results as { rows: { values: object }[] }[])[0].rows;
        rows[0].values = { ...rows[0].values, ghost: rows[0].values };
      }),
    ).toBe("results[0].rows[0].values.ghost");
  });

  test("ambiguous인데 선택지가 없음", () => {
    expect(
      pathOf((r) => {
        r.outcome = "ambiguous";
        r.clarify = null;
      }),
    ).toBe("clarify");
  });

  test("suggestions가 없으면 빈 배열로 채운다(계약 추가 제안 필드)", () => {
    const input = clone(answered) as unknown as Record<string, unknown>;
    delete input.suggestions;
    expect(validateSearchResponse(input).suggestions).toEqual([]);
  });

  test("상세의 출처 값은 정해진 네 가지뿐", () => {
    const detail = clone(PRODUCT_FIXTURES[0]);
    (detail.groups[0].fields[0] as { src: string }).src = "guess";
    expect(() => validateProductDetail(detail)).toThrow(ContractError);
  });
});
