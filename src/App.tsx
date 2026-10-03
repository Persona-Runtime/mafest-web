import { Link, NavLink, Route, Routes } from "react-router";
import { useTitle } from "./lib/useTitle";
import { api as defaultApi, IS_MOCK } from "./lib/client";
import { SITE_NAME, UNOFFICIAL_NOTICE } from "./lib/site";
import type { Meta, SearchApi } from "./lib/types";
import { useRequest, type RequestState } from "./lib/useRequest";
import { AboutRoute } from "./routes/AboutRoute";
import { HomeRoute } from "./routes/HomeRoute";
import { ProductRoute } from "./routes/ProductRoute";
import { SearchRoute } from "./routes/SearchRoute";

/**
 * 앱 셸. 로그인·세션이 없다 — 모든 화면이 공개이고 상태는 URL에만 있다.
 * api를 밖에서 받는 이유는 테스트가 합성 API를 넣기 위해서다.
 */
export default function App({ api = defaultApi }: { api?: SearchApi }) {
  const { state: meta } = useRequest("meta", (signal) => api.getMeta(signal));

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <SiteHeader meta={meta} />
      <main id="main" className="shell__main">
        <Routes>
          <Route path="/" element={<HomeRoute meta={meta} />} />
          <Route path="/search" element={<SearchRoute api={api} />} />
          <Route
            path="/products/:domain/:productId"
            element={<ProductRoute api={api} />}
          />
          <Route path="/about" element={<AboutRoute meta={meta} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <p>{UNOFFICIAL_NOTICE}</p>
      </footer>
    </div>
  );
}

function SiteHeader({ meta }: { meta: RequestState<Meta> }) {
  const llmOff = meta.status === "done" && !meta.data.llm_available;
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="brand">
          <span className="brand__mark" aria-hidden="true">
            Q
          </span>
          <span className="brand__name">{SITE_NAME}</span>
        </Link>
        <span className="site-header__badges">
          {IS_MOCK && <span className="badge badge--warn">모의 응답</span>}
          {llmOff && <span className="badge badge--warn">생성 모델 꺼짐</span>}
        </span>
        <nav className="site-nav" aria-label="주 메뉴">
          <NavLink to="/" end>
            검색
          </NavLink>
          <NavLink to="/about">동작 방식</NavLink>
        </nav>
      </div>
    </header>
  );
}

function NotFound() {
  useTitle("찾을 수 없음");
  return (
    <div className="not-found card">
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>
        <Link to="/">검색으로 돌아가기</Link>
      </p>
    </div>
  );
}
