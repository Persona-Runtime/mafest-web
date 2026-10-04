// @vitest-environment node
//
// 이 파일만 node에서 돈다. 여기서 보려는 것은 DOM이 아니라 HTTP다.
import { beforeAll, describe, expect, test } from "vitest";
import { httpApi } from "./api";
import { ApiError } from "./types";

/*
 * 실제 mafest-api를 상대로 도는 유일한 테스트(테스트 3층 중 세 번째).
 *   - 화면 테스트(App.test.tsx) : 합성 mock API. 화면 로직만 본다.
 *   - api.test.ts               : 실제 api.ts + 가짜 fetch. 요청 형태와 실패 처리를 본다.
 *   - 이 파일                   : 실제 서버. 계약이 실제로 지켜지는지 본다.
 *
 * 실행(P7 이후, 로컬 또는 port-forward한 mafest-api):
 *   MAFEST_LIVE_API=http://127.0.0.1:18080 npx vitest run src/lib/api.live.test.ts
 *
 * 읽기만 한다. 검색 6회 + 상세 1회라 요청 제한(분당 6)에 걸릴 수 있다 — 공개 URL이 아니라
 * 내부 주소(port-forward)로 돌린다.
 */

const baseUrl = process.env.MAFEST_LIVE_API;
const live = Boolean(baseUrl);

if (!live) {
  process.stderr.write(
    "\n[미실행] 실제 mafest-api 연동 검사를 건너뜁니다. 실연동은 검증되지 않았습니다.\n" +
      "         MAFEST_LIVE_API=<주소>를 주고 다시 실행하세요.\n\n",
  );
}

describe.skipIf(!live)("실제 mafest-api 계약", () => {
  beforeAll(() => {
    // api.ts는 상대 경로로 요청한다. 실제 서버 주소를 붙이려고 fetch를 한 겹 감싼다.
    const original = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      original(
        typeof input === "string" && input.startsWith("/")
          ? `${baseUrl}${input}`
          : input,
        init,
      )) as typeof fetch;
  });

  test("meta가 계약을 지키고 예시 칩이 6개다", async () => {
    const meta = await httpApi.getMeta();
    expect(meta.examples).toHaveLength(6);
    expect(meta.domains.length).toBeGreaterThan(0);
  });

  test("예시 칩 질문이 모두 기대 outcome을 낸다(37 W6)", async () => {
    const meta = await httpApi.getMeta();
    for (const example of meta.examples) {
      const result = await httpApi.search(example.question);
      expect
        .soft(result.outcome, `${example.id} ${example.question}`)
        .toBe(example.expected_outcome);
    }
  }, 120_000);

  test("검색 결과의 첫 상품 상세를 열 수 있다", async () => {
    // 조건이 안 맞는다고 return으로 빠지면 상세 API를 한 번도 안 불러도 통과한다.
    // 전제가 깨지면 그 자체를 실패로 본다.
    const meta = await httpApi.getMeta();
    const first = meta.examples.find((e) => e.expected_outcome === "answered");
    expect(first, "meta.examples에 answered 예시가 없다").toBeDefined();
    const result = await httpApi.search(first!.question);
    expect(result.outcome).toBe("answered");
    const group = result.results.find((g) => g.rows.length > 0);
    expect(group, `${first!.id} 결과에 행이 없다`).toBeDefined();
    const row = group!.rows[0];
    const detail = await httpApi.getProduct(group!.domain, row.product_id);
    expect(detail.product_id).toBe(row.product_id);
    expect(detail.domain).toBe(group!.domain);
    expect(detail.groups.length).toBeGreaterThan(0);
  }, 60_000);

  test("없는 상품은 404", async () => {
    await expect(
      httpApi.getProduct("kr_etf", "__no_such_product__"),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<ApiError>);
  });
});
