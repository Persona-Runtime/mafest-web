import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { parse } from "yaml";
import { describe, expect, test } from "vitest";
import {
  ALL_SEARCH_FIXTURES,
  answered,
  meta,
  PRODUCT_FIXTURES,
} from "./lib/fixtures";

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
