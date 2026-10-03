import { formatCount, formatMs } from "../lib/format";
import type { Trace, TraceStage } from "../lib/types";

const STAGE_LABEL: Record<TraceStage, string> = {
  route: "라우팅",
  query: "조회",
  compute: "연산",
  gate: "게이트",
  verify: "검증",
  generate: "생성",
  render: "렌더",
};

/**
 * "어떻게 답했나". 기본은 접어 둔다. 조회 SQL·Cypher를 그대로 보여준다 —
 * 실행 계정이 읽기 전용이라 노출해도 쓰기는 불가능하다(37 §3-5).
 */
export function TracePanel({
  trace,
  requestId,
}: {
  trace: Trace;
  requestId: string;
}) {
  const summary = [
    `${trace.steps.length}단계`,
    formatMs(trace.elapsed_ms),
    trace.model,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <details className="trace card">
      <summary>
        <span className="trace__title">어떻게 답했나</span>
        <span className="trace__summary">{summary}</span>
      </summary>
      <ol className="trace__steps">
        {trace.steps.map((step, index) => (
          <li key={`${step.stage}-${index}`} className="trace__step">
            <span className="trace__index" aria-hidden="true">
              {index + 1}
            </span>
            <div className="trace__body">
              <div className="trace__line">
                <strong>{step.label || STAGE_LABEL[step.stage]}</strong>
                <span className="trace__ms num">{formatMs(step.ms)}</span>
              </div>
              {step.detail && <p className="trace__detail">{step.detail}</p>}
              {step.query && (
                <pre className="trace__query">
                  <code>{step.query}</code>
                </pre>
              )}
            </div>
          </li>
        ))}
      </ol>
      <dl className="trace__meta">
        {trace.tokens && (
          <div>
            <dt>토큰</dt>
            <dd className="num">
              입력 {formatCount(trace.tokens.prompt)} · 출력{" "}
              {formatCount(trace.tokens.completion)}
            </dd>
          </div>
        )}
        <div>
          <dt>요청 ID</dt>
          <dd className="code">{requestId}</dd>
        </div>
      </dl>
      <p className="trace__note">
        조회는 읽기 전용 계정으로 실행됩니다. 쿼리의 매개변수 값은 질문에서 온
        값입니다.
      </p>
    </details>
  );
}
