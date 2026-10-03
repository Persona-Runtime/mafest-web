import { Link, useLocation, useNavigate, useParams } from "react-router";
import { InvestmentNotice } from "../components/Common";
import { useTitle } from "../lib/useTitle";
import { Icon } from "../components/Icon";
import { ProductDetailView } from "../components/ProductDetail";
import type { SearchApi } from "../lib/types";

/** 상품 상세 페이지(좁은 화면, 또는 링크로 직접 들어온 경우). */
export function ProductRoute({ api }: { api: SearchApi }) {
  const { domain = "", productId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // 앱 안에서 넘어왔으면 뒤로가기로 결과 화면(스크롤 위치 포함)에 돌아간다.
  const cameFromApp = location.key !== "default";
  useTitle("상품 상세");

  return (
    <div className="product-page">
      {cameFromApp ? (
        <button
          type="button"
          className="secondary button--small"
          onClick={() => navigate(-1)}
        >
          <Icon name="back" size={16} />
          검색 결과로
        </button>
      ) : (
        <Link className="button secondary button--small" to="/">
          <Icon name="back" size={16} />
          처음으로
        </Link>
      )}
      <div className="card">
        <ProductDetailView api={api} domain={domain} productId={productId} />
      </div>
      <InvestmentNotice />
    </div>
  );
}
