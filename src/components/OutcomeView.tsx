import { useState, type ReactNode } from "react";
import { CiteFocusContext, MappingFocusContext } from "../lib/citeFocus";
import type { CiteTarget } from "../lib/explain";
import type { ResultRow, SearchResponse } from "../lib/types";
import { TABLE_QUERY, useMediaQuery } from "../lib/useMediaQuery";
import { AnswerCard, BaseDates } from "./AnswerCard";
import { Icon } from "./Icon";
import { InterpretationCard } from "./InterpretationCard";
import { ProcessView } from "./ProcessView";
import { QuestionChips } from "./QuestionChips";
import { SearchGraph } from "./SearchGraph";
import { ResultGroupView } from "./ResultGroup";

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

type View = "result" | "graph" | "process";

const VIEW_LABEL: Record<View, string> = {
  result: "결과",
  graph: "그래프",
  process: "처리 과정",
};

/**
 * 결과 화면 전체(37 4-3 + W7 + r8). 구성은 위에서부터
 *   ① 질문 해석(대상·조건·정렬) ② 탐색 그래프(온톨로지 → 집합 → 상품)
 *   ③ 어떻게 답했나(처리 단계·판정·시간) ④ outcome별 본문.
 * 좁은 화면(<720px)에서는 ①을 늘 보이고, 나머지를 [결과 | 그래프 | 처리 과정] 전환으로 나눈다.
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
  const wide = useMediaQuery(TABLE_QUERY);
  const [view, setView] = useState<View>("result");
  const [focus, setFocus] = useState<CiteTarget | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const hasProcess = response.trace !== null;
  const hasGraph = response.interpretation.graph.nodes.length > 0;
  const views: View[] = [
    "result",
    ...(hasGraph ? (["graph"] as const) : []),
    ...(hasProcess ? (["process"] as const) : []),
  ];
  const tabs = !wide && views.length > 1;

  const banner = response.answer.generated_by === "fallback" && (
    <div className="banner banner--warn" role="status">
      <Icon name="alert" size={16} />
      답변 생성 모델이 꺼져 있어 조회 결과만 보여줍니다.
    </div>
  );

  const body = (
    <OutcomeBody
      response={response}
      selectedId={selectedId}
      onOpen={onOpen}
      onRetry={onRetry}
    />
  );

  const graph = <SearchGraph response={response} onOpen={onOpen} />;
  const panel: Record<View, ReactNode> = {
    result: body,
    graph,
    process: <ProcessView response={response} />,
  };

  return (
    <CiteFocusContext.Provider value={{ focus, setFocus }}>
      <MappingFocusContext.Provider value={{ active, setActive }}>
        {banner}
        <InterpretationCard response={response} />
        {tabs ? (
          <>
            <div className="seg" role="tablist" aria-label="결과 보기 방식">
              {views.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`tab-${key}`}
                  aria-selected={view === key}
                  aria-controls={`panel-${key}`}
                  className="seg__tab"
                  onClick={() => setView(key)}
                >
                  {VIEW_LABEL[key]}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={`panel-${view}`}
              aria-labelledby={`tab-${view}`}
              className="seg__panel"
            >
              {panel[view]}
            </div>
          </>
        ) : (
          <>
            {graph}
            {panel.process}
            {body}
          </>
        )}
      </MappingFocusContext.Provider>
    </CiteFocusContext.Provider>
  );
}

/** outcome별 본문. 상태마다 무엇을 보여주고 무엇을 숨기는지가 여기 한곳에 있다. */
function OutcomeBody({
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
  const { outcome, interpretation, results } = response;

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
          <AnswerCard response={response} />
          {groups}
        </>
      );
    case "no_result":
      return (
        <>
          <StateBox
            tone="info"
            title="조건에 맞는 상품이 없습니다"
            response={response}
          />
          <QuestionChips
            title="조건을 바꿔 보세요"
            options={response.suggestions}
          />
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
        </>
      );
    case "unread":
      return (
        <>
          <StateBox
            tone="info"
            title="질문 일부를 읽지 못했습니다"
            response={response}
          />
          <QuestionChips
            title="다시 물어볼 질문"
            options={response.suggestions}
          />
        </>
      );
    case "unavailable":
      return (
        <StateBox tone="warn" title="일시적인 연결 문제" response={response}>
          <button type="button" className="secondary" onClick={onRetry}>
            <Icon name="refresh" size={16} />
            다시 시도
          </button>
        </StateBox>
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
        </>
      );
    case "error":
      return (
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
      );
  }
}
