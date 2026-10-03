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
      <p className="answer__text">{answer.text}</p>
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
