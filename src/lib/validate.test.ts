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

  test("공개 trace 쿼리에 매개변수 값·접속 정보가 없다(39 §2-11)", () => {
    // 자리표시자($1, $name)만 허용한다. 값 주석(-- $1 = 5)이나 DSN·IP가 보이면 실패한다.
    const VALUE_COMMENT = /--\s*\$\w+\s*=/;
    const CONNECTION_INFO =
      /postgres(ql)?:\/\/|\b\d{1,3}(\.\d{1,3}){3}\b|password/i;
    for (const fixture of ALL_SEARCH_FIXTURES)
      for (const step of fixture.trace?.steps ?? []) {
        if (step.query === null) continue;
        expect(step.query, fixture.request_id).not.toMatch(VALUE_COMMENT);
        expect(step.query, fixture.request_id).not.toMatch(CONNECTION_INFO);
      }
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

  test("행에 열 값이 빠짐", () => {
    expect(
      pathOf((r) => {
        const rows = (
          r.results as { rows: { values: Record<string, unknown> }[] }[]
        )[0].rows;
        delete rows[0].values.aum;
      }),
    ).toBe("results[0].rows[0].values.aum");
  });

  test("ambiguous인데 선택지가 없음", () => {
    expect(
      pathOf((r) => {
        r.outcome = "ambiguous";
        r.results = [];
        r.clarify = null;
      }),
    ).toBe("clarify");
  });

  test.each(["suggestions", "clarify", "trace", "results"])(
    "필드 %s가 빠지면 기본값으로 메우지 않고 거절한다",
    (key) => {
      expect(pathOf((r) => delete r[key])).toBe(key);
    },
  );

  test("표를 내지 않는 outcome에 results가 있으면 거절한다", () => {
    expect(pathOf((r) => (r.outcome = "refused"))).toBe("results");
  });

  test("모르는 키는 그 키 경로로 거절한다(입력을 고치지 않는다)", () => {
    expect(pathOf((r) => (r.debug = true))).toBe("debug");
    const broken = clone(answered) as unknown as Record<string, unknown>;
    broken.debug = true;
    const before = structuredClone(broken);
    expect(() => validateSearchResponse(broken)).toThrow(ContractError);
    expect(broken).toEqual(before);
  });

  test("필수 nullable 셀 note가 빠지면 거절한다", () => {
    expect(
      pathOf((r) => {
        const cell = (
          r.results as { rows: { values: Record<string, object> }[] }[]
        )[0].rows[0].values.code as Record<string, unknown>;
        delete cell.note;
      }),
    ).toBe("results[0].rows[0].values.code.note");
  });

  describe("[r8] 탐색 그래프: 명세(yaml)로 못 거는 규칙", () => {
    type G = {
      interpretation: {
        graph: {
          nodes: Array<Record<string, unknown>>;
          edges: Array<Record<string, unknown>>;
        };
      };
    };
    const graphOf = (r: Record<string, unknown>) =>
      (r as unknown as G).interpretation.graph;

    test("간선 끝이 없는 노드를 가리키면 거절", () => {
      expect(pathOf((r) => (graphOf(r).edges[0].to = "nope"))).toBe(
        "interpretation.graph.edges[0].to",
      );
    });

    test("노드 id 중복은 거절", () => {
      expect(
        pathOf((r) => (graphOf(r).nodes[1].id = graphOf(r).nodes[0].id)),
      ).toBe("interpretation.graph.nodes[1].id");
    });

    test("mapping 번호가 해석 과정 범위 밖이면 거절", () => {
      expect(pathOf((r) => (graphOf(r).nodes[0].mapping = 99))).toBe(
        "interpretation.graph.nodes[0].mapping",
      );
    });

    test("노드 40개를 넘으면 거절", () => {
      expect(
        pathOf((r) => {
          const g = graphOf(r);
          for (let i = 0; i < 41; i++)
            g.nodes.push({ ...g.nodes[0], id: `x${i}` });
        }),
      ).toBe("interpretation.graph.nodes");
    });

    test("빈 그래프는 받는다(거절·오류·서버 미구현)", () => {
      expect(
        pathOf((r) => {
          graphOf(r).nodes = [];
          graphOf(r).edges = [];
        }),
      ).toBe("통과함");
    });
  });

  test("상세의 출처 값은 정해진 네 가지뿐", () => {
    const detail = clone(PRODUCT_FIXTURES[0]);
    (detail.groups[0].fields[0] as { src: string }).src = "guess";
    expect(() => validateProductDetail(detail)).toThrow(ContractError);
  });
});
