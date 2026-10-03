import { Link } from "react-router";
import { searchHref } from "../lib/format";
import type { QuestionOption } from "../lib/types";
import { Icon } from "./Icon";

/**
 * 누르면 그 질문으로 다시 검색하는 칩. 세션이 없으므로 되묻기도 "구체화한 새 질문"으로
 * 처리한다(37 4-3 ambiguous). 링크라서 새 탭으로 열 수도 있다.
 */
export function QuestionChips({
  title,
  options,
}: {
  title: string;
  options: QuestionOption[];
}) {
  if (options.length === 0) return null;
  return (
    <nav className="question-chips" aria-label={title}>
      <p className="question-chips__title">{title}</p>
      <ul>
        {options.map((option) => (
          <li key={option.question}>
            <Link className="question-chip" to={searchHref(option.question)}>
              <span className="question-chip__label">{option.label}</span>
              <span className="question-chip__question">{option.question}</span>
              <Icon name="arrow" size={15} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
