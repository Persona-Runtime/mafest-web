import { Link, useNavigate } from "react-router";
import { useTitle } from "../lib/useTitle";
import { SearchBox } from "../components/SearchBox";
import { searchHref } from "../lib/format";
import type { Meta } from "../lib/types";
import type { RequestState } from "../lib/useRequest";

/**
 * 홈. 검색창과 예시 질문 칩만 둔다. 상품군별 건수·기준일, 하지 않는 것은 /about에 있다.
 * 예시 칩은 웹에 하드코딩하지 않고 /v1/meta가 내려준다 — 서버 sweep에서 기대한 결과가
 * 나오는 질문만 칩이 된다(37 §2-2). meta가 실패해도 검색은 된다.
 */
export function HomeRoute({ meta }: { meta: RequestState<Meta> }) {
  const navigate = useNavigate();
  useTitle(null);

  return (
    <div className="home">
      <section className="home__hero">
        <h1>어떤 금융상품을 찾으세요?</h1>
        <p className="home__lead">
          보수·수익률·신용등급 같은 조건을 말로 물어보면 ETF·ETN·채권·펀드에서
          찾아 근거와 함께 보여 드립니다.
        </p>
        <SearchBox
          size="large"
          autoFocus
          onSubmit={(question) => navigate(searchHref(question))}
        />
      </section>

      <section className="home__examples" aria-labelledby="examples-heading">
        <h2 id="examples-heading">이렇게 물어보세요</h2>
        {meta.status === "done" ? (
          <ul className="example-chips">
            {meta.data.examples.map((example) => (
              <li key={example.id}>
                <Link
                  className="example-chip"
                  to={searchHref(example.question)}
                >
                  <span className="example-chip__category">
                    {example.category}
                  </span>
                  <span>{example.question}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : meta.status === "failed" ? (
          <p className="muted">
            예시 질문을 불러오지 못했습니다. 검색은 그대로 쓸 수 있습니다.
          </p>
        ) : (
          <div className="skeleton skeleton--chips" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
      </section>
    </div>
  );
}
