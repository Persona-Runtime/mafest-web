import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { parse } from "yaml";
import { describe, expect, test } from "vitest";
import {
  ALL_SEARCH_FIXTURES,
  ambiguous,
  answered,
  meta,
  PRODUCT_FIXTURES,
} from "./lib/fixtures";
import type { SearchResponse } from "./lib/types";
import { validateSearchResponse } from "./lib/validate";

/**
 * 명세(contract/public-api-v1.openapi.yaml) ↔ 웹 픽스처 대조.
 *
 * validate.test.ts는 웹의 손 검사기(validate.ts)로, 이 파일은 명세의 JSON Schema로 같은
 * 픽스처를 검사한다. 둘 다 통과해야 "웹이 기대하는 것 = 서버에 요구한 것"이 성립한다.
 * 서버(P7)는 같은 yaml로 실제 응답을 검사한다(39 §8).
 */
// vitest는 저장소 루트에서 실행한다(package.json의 test 스크립트).
const root = process.cwd();
const spec = parse(
  readFileSync(resolve(root, "contract/public-api-v1.openapi.yaml"), "utf8"),
);

const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addSchema({ ...spec, $id: "spec" });
const schema = (name: string) => {
  const validate = ajv.getSchema(`spec#/components/schemas/${name}`);
  if (!validate) throw new Error(`스키마 없음: ${name}`);
  return validate;
};

function check(name: string, value: unknown): string[] {
  const validate = schema(name);
  return validate(value)
    ? []
    : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
}

describe("명세 스키마", () => {
  test.each(ALL_SEARCH_FIXTURES.map((f) => [f.request_id, f] as const))(
    "검색 응답 %s",
    (_, fixture) => {
      expect(check("SearchResponse", fixture)).toEqual([]);
    },
  );

  test("상품 상세 전부", () => {
    for (const detail of PRODUCT_FIXTURES)
      expect(check("ProductDetail", detail)).toEqual([]);
  });

  test("메타", () => {
    expect(check("Meta", meta)).toEqual([]);
  });

  test("ambiguous가 아닌데 clarify를 주면 거절한다", () => {
    const broken = {
      ...answered,
      clarify: {
        kind: "missing_condition",
        reason: "x",
        options: [
          { label: "a", question: "a" },
          { label: "b", question: "b" },
        ],
      },
    };
    expect(check("SearchResponse", broken)).not.toEqual([]);
  });

  test("표를 내지 않는 outcome에 results가 있으면 거절한다", () => {
    expect(
      check("SearchResponse", { ...answered, outcome: "refused" }),
    ).not.toEqual([]);
  });

  test("결과는 묶음당 20행을 넘지 않는다", () => {
    const row = answered.results[0].rows[0];
    const group = {
      ...answered.results[0],
      rows: Array.from({ length: 21 }, (_, i) => ({
        ...row,
        product_id: `X${i}`,
      })),
    };
    expect(
      check("SearchResponse", { ...answered, results: [group] }),
    ).not.toEqual([]);
  });

  test("요청: 200자 초과 거절", () => {
    expect(check("SearchRequest", { question: "가".repeat(201) })).not.toEqual(
      [],
    );
    expect(check("SearchRequest", { question: "국내 ETF" })).toEqual([]);
  });
});

/**
 * 같은 깨진 응답을 명세 스키마와 웹 검사기(validate.ts)가 **둘 다** 거절하는지 본다.
 * 한쪽만 거절하면 "명세는 금지하는데 웹은 받아 준다"(또는 반대)가 되어 계약이 둘로 갈린다.
 *
 * 의도한 비대칭 하나: 모르는 키가 **추가**된 응답은 스키마(서버 출력 검사)는 거절하고
 * 웹(읽는 쪽)은 무시한다. 필드 **누락**은 둘 다 거절한다.
 */
type Mutation = [string, SearchResponse, (r: Record<string, unknown>) => void];

const MUTATIONS: Mutation[] = [
  ["suggestions 누락", answered, (r) => delete r.suggestions],
  ["trace 누락", answered, (r) => delete r.trace],
  ["clarify 누락", answered, (r) => delete r.clarify],
  ["answered에 clarify", answered, (r) => (r.clarify = ambiguous.clarify)],
  ["refused에 results", answered, (r) => (r.outcome = "refused")],
  ["ambiguous에 clarify null", ambiguous, (r) => (r.clarify = null)],
  [
    "clarify 선택지 1개",
    ambiguous,
    (r) => {
      const c = r.clarify as { options: unknown[] };
      c.options = c.options.slice(0, 1);
    },
  ],
  [
    "suggestions 4개",
    answered,
    (r) =>
      (r.suggestions = Array.from({ length: 4 }, (_, i) => ({
        label: `l${i}`,
        question: `q${i}`,
      }))),
  ],
  [
    "label 21자",
    answered,
    (r) => (r.suggestions = [{ label: "가".repeat(21), question: "q" }]),
  ],
  [
    "limit 21",
    answered,
    (r) => ((r.interpretation as { limit: number }).limit = 21),
  ],
  [
    "행 21개",
    answered,
    (r) => {
      const g = (r.results as { rows: { product_id: string }[] }[])[0];
      g.rows = Array.from({ length: 21 }, (_, i) => ({
        ...g.rows[0],
        product_id: `X${i}`,
      }));
    },
  ],
  [
    "라우터 내부 도메인 이름",
    answered,
    (r) => {
      (
        r.interpretation as { domains: { domain: string }[] }
      ).domains[0].domain = "etf_kr";
    },
  ],
  [
    "셀 note 누락",
    answered,
    (r) => {
      const g = (
        r.results as { rows: { values: Record<string, object> }[] }[]
      )[0];
      const { note: _note, ...rest } = g.rows[0].values.code as {
        note: unknown;
      };
      void _note;
      g.rows[0].values.code = rest;
    },
  ],
];

describe("명세 ↔ 웹 검사기 일치", () => {
  test.each(MUTATIONS)("%s: 둘 다 거절", (_, base, mutate) => {
    const broken = structuredClone(base) as unknown as Record<string, unknown>;
    mutate(broken);
    expect(check("SearchResponse", broken), "명세가 받아 줌").not.toEqual([]);
    expect(
      () => validateSearchResponse(structuredClone(broken)),
      "웹이 받아 줌",
    ).toThrow();
  });

  test("추가 키: 명세는 거절, 웹은 무시(의도한 비대칭)", () => {
    const extra = { ...structuredClone(answered), debug: true };
    expect(check("SearchResponse", extra)).not.toEqual([]);
    expect(() => validateSearchResponse(structuredClone(extra))).not.toThrow();
  });

  test("ErrorBody: code·message·request_id 필수, code는 목록 안", () => {
    const ok = { code: "busy", message: "m", request_id: "r" };
    expect(check("ErrorBody", ok)).toEqual([]);
    expect(check("ErrorBody", { code: "busy" })).not.toEqual([]);
    expect(check("ErrorBody", { ...ok, code: "oops" })).not.toEqual([]);
  });
});
