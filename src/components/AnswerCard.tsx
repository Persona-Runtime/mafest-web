import { rowDomId, useCiteFocus } from "../lib/citeFocus";
import { linkAnswer, type CiteTarget } from "../lib/explain";
import { baseDateSummary, GENERATED_LABEL } from "../lib/format";
import type { SearchResponse } from "../lib/types";
import { Icon } from "./Icon";

/** 기준일 배지. 상품군마다 다르면 나열한다. */
export function BaseDates({ response }: { response: SearchResponse }) {
  const dates = baseDateSummary(response.interpretation.domains);
  if (dates.length === 0) return null;
  return (
    <span className="base-dates">
      {dates.map(({ label, date }) => (
        <span className="badge badge--plain" key={`${label}-${date}`}>
          {label ? `${label} ` : ""}기준일 <time dateTime={date}>{date}</time>
        </span>
      ))}
    </span>
  );
}

/**
 * 답변 문장. 서버 문장은 텍스트 그대로 그린다(Markdown·HTML 해석 안 함).
 * 문장을 누가 만들었는지(LLM/정형/조회만) 배지로 숨기지 않고 보여준다.
 */
export function AnswerCard({ response }: { response: SearchResponse }) {
  const { answer, outcome } = response;
  return (
    <section className="answer card" aria-labelledby="answer-heading">
      <header className="answer__head">
        <h2 id="answer-heading">답변</h2>
        <span className="answer__badges">
          {outcome === "caveat" && (
            <span className="badge badge--warn">
              <Icon name="alert" size={14} />
              주의
            </span>
          )}
          <span
            className={`badge ${answer.generated_by === "fallback" ? "badge--warn" : "badge--plain"}`}
          >
            {GENERATED_LABEL[answer.generated_by]}
          </span>
          <BaseDates response={response} />
        </span>
      </header>
      <AnswerText response={response} />
      {answer.notices.length > 0 && (
        <ul
          className={`notices ${outcome === "caveat" ? "notices--warn" : ""}`}
          aria-label={outcome === "caveat" ? "주의 사유" : "안내"}
        >
          {answer.notices.map((notice) => (
            <li key={notice.code + notice.text}>
              <Icon name={outcome === "caveat" ? "alert" : "info"} size={15} />
              <span>{notice.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 답변 문장. 인용 상품의 이름과 숫자가 표의 값과 정확히 같으면 밑줄로 잇는다.
 * 마우스·키보드 초점을 주면 표의 그 칸이 강조되고, 누르면 그 행으로 스크롤한다.
 */
function AnswerText({ response }: { response: SearchResponse }) {
  const { focus, setFocus } = useCiteFocus();
  const segments = linkAnswer(response.answer.text, response.results);
  const linked = segments.some((s) => s.cite);
  const same = (a: CiteTarget | null, b: CiteTarget) =>
    a !== null &&
    a.domain === b.domain &&
    a.productId === b.productId &&
    a.key === b.key;

  return (
    <>
      <p className="answer__text">
        {segments.map((segment, index) =>
          segment.cite ? (
            <button
              key={index}
              type="button"
              className="cite-link"
              data-active={same(focus, segment.cite) || undefined}
              aria-describedby="cite-hint"
              onMouseEnter={() => setFocus(segment.cite)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(segment.cite)}
              onBlur={() => setFocus(null)}
              onClick={() => {
                const row = document.getElementById(
                  rowDomId(segment.cite.domain, segment.cite.productId),
                );
                row?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              {segment.text}
            </button>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </p>
      {linked && (
        <p id="cite-hint" className="answer__hint">
          밑줄 친 값은 아래 표에서 그대로 가져온 값입니다. 누르면 그 상품으로
          이동합니다.
        </p>
      )}
    </>
  );
}
