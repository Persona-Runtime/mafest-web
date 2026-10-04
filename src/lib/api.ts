import { ApiError, type ErrorBody, type SearchApi } from "./types";
import {
  ContractError,
  validateErrorBody,
  validateMeta,
  validateProductDetail,
  validateSearchResponse,
} from "./validate";

/**
 * 실제 API 클라이언트. 같은 origin의 `/v1`을 부른다(Traefik이 mafest-api로 보낸다).
 * 로그인이 없으므로 인증 헤더를 보내지 않는다.
 *
 * 실패 처리 원칙:
 * - 429는 Traefik IP 요청 제한이다. Retry-After(초)를 읽어 ApiError에 담고
 *   화면이 카운트다운한다. 본문 형식이나 request_id는 기대하지 않는다.
 * - 그 밖 4xx·5xx는 본문이 ErrorBody면 그 code와 request_id를 쓴다. ErrorBody가 아니면
 *   본문의 다른 키(FastAPI `detail` 등)를 code로 믿지 않고 `http_<status>`로 둔다.
 * - 5xx라도 본문이 계약을 지키는 `outcome: "error"` 응답이면 그대로 돌려준다.
 *   서버가 error를 200으로 줄지 500으로 줄지(37 두 문서의 차이) 웹은 상관하지 않는다.
 * - 본문이 계약과 다르면 성공처럼 그리지 않고 invalid_response로 실패시킨다.
 */

function parseRetryAfter(value: string | null): number | null {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** 본문이 계약을 지킨 앱 오류 본문이면 돌려주고, 아니면(Traefik 본문 등) null. */
function appErrorBody(body: unknown): ErrorBody | null {
  try {
    return validateErrorBody(body);
  } catch (error) {
    if (error instanceof ContractError) return null;
    throw error;
  }
}

async function request(
  path: string,
  init: RequestInit,
): Promise<{ response: Response; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { Accept: "application/json", ...init.headers },
    });
  } catch (error) {
    // 사용자가 새 검색으로 이전 요청을 끊은 경우는 오류 화면을 그리지 않는다.
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(0, "network");
  }
  return { response, body: await readJson(response) };
}

function fail(response: Response, body: unknown): never {
  const appError = appErrorBody(body);
  // Traefik 응답에는 X-Request-Id가 없을 수 있다. 본문 request_id를 먼저 쓴다.
  const requestId =
    appError?.request_id ?? response.headers.get("X-Request-Id");
  if (response.status === 429) {
    throw new ApiError(
      429,
      "rate_limited",
      parseRetryAfter(response.headers.get("Retry-After")),
      requestId,
    );
  }
  // Traefik이 직접 낸 504는 ErrorBody가 아닐 수 있지만 화면 의미는 같다.
  if (response.status === 504)
    throw new ApiError(504, "timeout", null, requestId);
  throw new ApiError(
    response.status,
    appError?.code ?? `http_${response.status}`,
    null,
    requestId,
  );
}

function checked<T>(validate: (input: unknown) => T, body: unknown): T {
  try {
    return validate(body);
  } catch (error) {
    if (error instanceof ContractError) {
      // 어느 필드가 어긋났는지는 개발자 도구에서 볼 수 있게 남긴다(값은 남기지 않는다).
      console.error(error.message);
      throw new ApiError(200, "invalid_response");
    }
    throw error;
  }
}

export const httpApi: SearchApi = {
  async search(question, signal) {
    const { response, body } = await request("/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal,
    });
    if (!response.ok) {
      if (response.status >= 500 && response.status !== 504) {
        // 계약을 지킨 error 응답이면 request_id와 trace를 살려 그대로 보여준다.
        try {
          const parsed = validateSearchResponse(body);
          if (parsed.outcome === "error") return parsed;
        } catch {
          // 계약 밖 본문이면 아래의 일반 HTTP 오류로 처리한다.
        }
      }
      fail(response, body);
    }
    return checked(validateSearchResponse, body);
  },

  async getProduct(domain, productId, signal) {
    const path = `/v1/products/${encodeURIComponent(domain)}/${encodeURIComponent(productId)}`;
    const { response, body } = await request(path, { signal });
    if (!response.ok) fail(response, body);
    return checked(validateProductDetail, body);
  },

  async getMeta(signal) {
    const { response, body } = await request("/v1/meta", { signal });
    if (!response.ok) fail(response, body);
    return checked(validateMeta, body);
  },
};
