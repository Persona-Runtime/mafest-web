import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./types";

export type RequestState<T> =
  | { status: "idle" }
  | { status: "loading"; startedAt: number }
  | { status: "done"; data: T }
  | { status: "failed"; error: ApiError };

/**
 * key가 바뀔 때마다 load를 다시 부르고, 이전 요청은 AbortController로 끊는다.
 * 그래서 빠르게 질문을 바꿔도 늦게 도착한 이전 응답이 화면을 덮지 않는다.
 * key가 null이면 요청하지 않는다(빈 질문).
 *
 * load는 매 렌더 새로 만들어져도 된다 — ref로 최신 것을 읽고, 다시 부를지는 key만 정한다.
 */
export function useRequest<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
): { state: RequestState<T>; retry: () => void } {
  const [state, setState] = useState<RequestState<T>>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (key === null) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading", startedAt: Date.now() });
    loadRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: "done", data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "failed",
          error:
            error instanceof ApiError ? error : new ApiError(0, "unexpected"),
        });
      });
    return () => controller.abort();
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
