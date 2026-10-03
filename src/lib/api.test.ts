import { afterEach, describe, expect, test, vi } from "vitest";
import { httpApi } from "./api";
import { answered, errorOutcome, meta, PRODUCT_FIXTURES } from "./fixtures";
import { ApiError } from "./types";

/*
 * 실제 api.ts + 가짜 fetch. 요청 형태와 실패 처리를 본다(서버 없음).
 */

function respond(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? "" : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("실패해야 하는데 성공했다");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("search", () => {
  test("같은 origin /v1/search에 질문만 JSON으로 보낸다(인증 헤더 없음)", async () => {
    const fetchMock = respond(200, answered);
    const result = await httpApi.search("순자산 큰 국내 ETF 5개");
    expect(result.outcome).toBe("answered");
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/v1/search");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      question: "순자산 큰 국내 ETF 5개",
    });
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  test("429는 Retry-After 초를 담는다", async () => {
    respond(429, { code: "rate_limited" }, { "Retry-After": "17" });
    const error = await failure(httpApi.search("q"));
    expect(error.status).toBe(429);
    expect(error.retryAfter).toBe(17);
  });

  test("504는 timeout", async () => {
    respond(504, undefined);
    const error = await failure(httpApi.search("q"));
    expect(error.code).toBe("timeout");
  });

  test("500이라도 계약을 지킨 error 응답이면 그대로 돌려준다", async () => {
    respond(500, errorOutcome);
    const result = await httpApi.search("q");
    expect(result.outcome).toBe("error");
    expect(result.request_id).toBe(errorOutcome.request_id);
  });

  test("500 + 계약 밖 본문은 HTTP 오류", async () => {
    respond(
      500,
      { detail: "Internal Server Error" },
      { "X-Request-Id": "req-1" },
    );
    const error = await failure(httpApi.search("q"));
    expect(error.status).toBe(500);
    expect(error.requestId).toBe("req-1");
  });

  test("200이라도 계약을 어기면 성공으로 그리지 않는다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    respond(200, { ...answered, outcome: "fine" });
    const error = await failure(httpApi.search("q"));
    expect(error.code).toBe("invalid_response");
  });

  test("연결 실패는 status 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    const error = await failure(httpApi.search("q"));
    expect(error.status).toBe(0);
    expect(error.code).toBe("network");
  });

  test("사용자가 끊은 요청은 ApiError로 바꾸지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );
    await expect(httpApi.search("q")).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

describe("products · meta", () => {
  test("상품 경로의 도메인·id를 인코딩한다", async () => {
    const fetchMock = respond(200, PRODUCT_FIXTURES[0]);
    await httpApi.getProduct("kr_etf", "A/B");
    expect(fetchMock.mock.calls[0][0]).toBe("/v1/products/kr_etf/A%2FB");
  });

  test("없는 상품은 404", async () => {
    respond(404, { code: "product_not_found" });
    const error = await failure(httpApi.getProduct("kr_etf", "NOPE"));
    expect(error.status).toBe(404);
    expect(error.code).toBe("product_not_found");
  });

  test("meta", async () => {
    respond(200, meta);
    const result = await httpApi.getMeta();
    expect(result.examples.length).toBe(6);
  });
});
