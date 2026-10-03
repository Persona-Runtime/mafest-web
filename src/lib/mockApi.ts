import {
  ambiguous,
  answered,
  bond,
  caveat,
  count,
  errorOutcome,
  fallback,
  meta,
  noResult,
  notCollected,
  PRODUCT_FIXTURES,
  refused,
  unavailable,
} from "./fixtures";
import { ApiError, type SearchApi, type SearchResponse } from "./types";

/**
 * 로컬 개발용 mock API. `VITE_API_MODE=mock`을 명시했을 때만 쓴다(client.ts).
 * 운영 번들에는 들어가지 않는다 — client.ts의 조건이 빌드 때 상수로 접혀 이 모듈이 빠진다.
 *
 * 질문 낱말로 픽스처를 고른다. 화면 상태를 손으로 확인하기 위한 것이라 규칙은 단순하다.
 *   "429" / "504" / "500"     → HTTP 오류
 *   "오류"                    → outcome error
 *   "모델"                    → generated_by fallback
 *   그 밖은 아래 RULES 순서
 */
const RULES: Array<[RegExp, SearchResponse]> = [
  [/추천|오를|전망|사도 돼/, refused],
  [/편입|구성종목/, unavailable],
  [/거래량|호가|시세/, notCollected],
  [/좋은|괜찮은/, ambiguous],
  [/0\.01%|50%/, noResult],
  [/몇 ?개/, count],
  [/퇴직연금|ETN/, caveat],
  [/채권|AA|표면금리/, bond],
];

function pick(question: string): SearchResponse {
  if (/오류/.test(question)) return errorOutcome;
  if (/모델/.test(question)) return fallback;
  for (const [pattern, fixture] of RULES)
    if (pattern.test(question)) return fixture;
  return answered;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}

/** 테스트에서 지연을 0으로 둔다. */
export function createMockApi(delayScale = 1): SearchApi {
  return {
    async search(question, signal) {
      if (/429/.test(question)) {
        await wait(150 * delayScale, signal);
        throw new ApiError(429, "rate_limited", 12);
      }
      if (/504/.test(question)) {
        await wait(600 * delayScale, signal);
        throw new ApiError(504, "timeout");
      }
      if (/500/.test(question)) {
        await wait(150 * delayScale, signal);
        throw new ApiError(500, "http_500");
      }
      const fixture = pick(question);
      // 생성 경로는 수 초, 게이트 경로는 짧다. 실제 체감과 비슷하게 둔다.
      const generated = fixture.answer.generated_by === "llm";
      await wait((generated ? 1600 : 250) * delayScale, signal);
      return structuredClone({ ...fixture, question });
    },

    async getProduct(domain, productId, signal) {
      await wait(200 * delayScale, signal);
      const found = PRODUCT_FIXTURES.find(
        (p) => p.domain === domain && p.product_id === productId,
      );
      if (!found) throw new ApiError(404, "product_not_found");
      return structuredClone(found);
    },

    async getMeta(signal) {
      await wait(100 * delayScale, signal);
      return structuredClone(meta);
    },
  };
}

export const mockApi = createMockApi();
