import type { ReactNode } from "react";
import type { ResultRow, SearchResponse } from "../lib/types";
import { AnswerCard, BaseDates } from "./AnswerCard";
import { Icon } from "./Icon";
import { InterpretationChips } from "./Interpretation";
import { QuestionChips } from "./QuestionChips";
import { ResultGroupView } from "./ResultGroup";
import { TracePanel } from "./TracePanel";

type Tone = "info" | "warn" | "danger";

function StateBox({
  tone,
  title,
  response,
  children,
}: {
  tone: Tone;
  title: string;
  response: SearchResponse;
  children?: ReactNode;
}) {
  const notices = response.answer.notices;
  return (
    <section
      className={`state card state--${tone}`}
      role={tone === "danger" ? "alert" : undefined}
      aria-labelledby="state-heading"
    >
      <Icon name={tone === "info" ? "info" : "alert"} size={20} />
      <div className="state__body">
        <h2 id="state-heading">{title}</h2>
        <p>{response.answer.text}</p>
        {notices.length > 0 && (
          <ul className="notices">
            {notices.map((notice) => (
              <li key={notice.code + notice.text}>
                <span>{notice.text}</span>
              </li>
            ))}
          </ul>
        )}
        {children}
        <BaseDates response={response} />
      </div>
    </section>
  );
}

/**
 * outcome별 화면(37 4-3). 상태마다 무엇을 보여주고 무엇을 숨기는지가 여기 한곳에 있다.
 * 생성 모델이 꺼진 경우(generated_by=fallback)는 outcome과 별개로 맨 위 배너를 띄운다.
 */
export function OutcomeView({
  response,
  selectedId,
  onOpen,
  onRetry,
}: {
  response: SearchResponse;
  selectedId: string | null;
  onOpen?: (domain: string, row: ResultRow) => void;
  onRetry: () => void;
}) {
  const { outcome, interpretation, results, trace } = response;

  const banner = response.answer.generated_by === "fallback" && (
    <div className="banner banner--warn" role="status">
      <Icon name="alert" size={16} />
      답변 생성 모델이 꺼져 있어 조회 결과만 보여줍니다.
    </div>
  );

  const traceView = trace && (
    <TracePanel trace={trace} requestId={response.request_id} />
  );

  const groups = results.map((group) => (
    <ResultGroupView
      key={group.domain}
      group={group}
      domain={interpretation.domains.find((d) => d.domain === group.domain)}
      sort={interpretation.sort}
      selectedId={selectedId}
      onOpen={onOpen ? (row) => onOpen(group.domain, row) : undefined}
    />
  ));

  switch (outcome) {
    case "answered":
    case "caveat":
      return (
        <>
          {banner}
          <AnswerCard response={response} />
          <InterpretationChips interpretation={interpretation} />
          {groups}
          {traceView}
        </>
      );
    case "no_result":
      return (
        <>
          {banner}
          <StateBox
            tone="info"
            title="조건에 맞는 상품이 없습니다"
            response={response}
          />
          <InterpretationChips interpretation={interpretation} />
          <QuestionChips
            title="조건을 바꿔 보세요"
            options={response.suggestions}
          />
          {traceView}
        </>
      );
    case "not_collected":
      return (
        <>
          <StateBox
            tone="info"
            title="수집하지 않은 데이터입니다"
            response={response}
          />
          <QuestionChips
            title="대신 물어볼 수 있는 질문"
            options={response.suggestions}
          />
          {traceView}
        </>
      );
    case "unavailable":
      return (
        <>
          <StateBox tone="warn" title="일시적인 연결 문제" response={response}>
            <button type="button" className="secondary" onClick={onRetry}>
              <Icon name="refresh" size={16} />
              다시 시도
            </button>
          </StateBox>
          {traceView}
        </>
      );
    case "ambiguous":
      return (
        <>
          <StateBox tone="info" title="조건을 골라 주세요" response={response}>
            {response.clarify && (
              <p className="state__reason">{response.clarify.reason}</p>
            )}
          </StateBox>
          <QuestionChips
            title="구체화한 질문으로 다시 검색"
            options={response.clarify?.options ?? []}
          />
          {traceView}
        </>
      );
    case "refused":
      return (
        <>
          <StateBox
            tone="info"
            title="답하지 않는 질문입니다"
            response={response}
          />
          <QuestionChips
            title="대신 할 수 있는 질문"
            options={response.suggestions}
          />
          {traceView}
        </>
      );
    case "error":
      return (
        <>
          <StateBox
            tone="danger"
            title="답변을 만들지 못했습니다"
            response={response}
          >
            <p className="muted small">
              요청 ID <span className="code">{response.request_id}</span>
            </p>
            <button type="button" className="secondary" onClick={onRetry}>
              <Icon name="refresh" size={16} />
              다시 시도
            </button>
          </StateBox>
          {traceView}
        </>
      );
  }
}
