import { useCallback, useEffect, useRef, useState } from "react";
import { emptyView, runSearchStream, type StreamView } from "./searchStream";
import { ApiError, type SearchApi, type SearchResponse } from "./types";

export type RunState =
  | { status: "idle" }
  | { status: "streaming"; runId: number; startedAt: number; view: StreamView }
  | { status: "done"; runId: number; data: SearchResponse }
  | { status: "failed"; error: ApiError };

/**
 * 검색 한 번을 스트림으로 돌리고 진행 상태를 알려 준다. key(질문)가 바뀌면 이전 검색을 취소하고 새로 시작한다.
 * 페이지를 떠나도 취소한다(재시도하지 않는다). key 가 null 이면 아무것도 하지 않는다.
 *
 * runId 는 검색을 시작할 때마다 새로 붙는다. 화면이 이것을 key 로 쓰면 스트리밍 중에서 완성 응답으로
 * 바뀔 때 다시 마운트되지 않아, 탭·포커스·그래프 등장 애니메이션이 그대로 이어진다.
 */
export function useSearchRun(
  key: string | null,
  api: SearchApi,
): { state: RunState; retry: () => void } {
  const [state, setState] = useState<RunState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const apiRef = useRef(api);
  apiRef.current = api;
  const runCounter = useRef(0);

  useEffect(() => {
    if (key === null) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    runCounter.current += 1;
    const runId = runCounter.current;
    const startedAt = Date.now();
    setState({ status: "streaming", runId, startedAt, view: emptyView() });
    runSearchStream(apiRef.current, key, controller.signal, (view) => {
      if (!controller.signal.aborted)
        setState({ status: "streaming", runId, startedAt, view });
    })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ status: "done", runId, data });
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
