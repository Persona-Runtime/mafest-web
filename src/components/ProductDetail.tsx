import { Link } from "react-router";
import { isNumeric, searchHref, SOURCE_LABEL } from "../lib/format";
import type { ProductDetail, ProductField, SearchApi } from "../lib/types";
import { useRequest } from "../lib/useRequest";
import { Icon } from "./Icon";
import { RequestFailed } from "./StatusViews";

/**
 * 상품 상세. 넓은 화면에서는 결과 오른쪽 패널, 좁은 화면에서는 별도 페이지로 그린다.
 *
 * - 값마다 출처(원천값·외부 수집·계산값·미제공)와 기준일을 붙인다.
 * - 관계(구성종목·운용사·기초지수)는 누르면 관련 검색으로 이어진다.
 * - "이전/다음 상품"이나 상품군 전체 목록으로 가는 길은 두지 않는다(대량 수집 억제, 37 §2-4).
 */
export function ProductDetailView({
  api,
  domain,
  productId,
  headingLevel = 1,
  onClose,
}: {
  api: SearchApi;
  domain: string;
  productId: string;
  headingLevel?: 1 | 2;
  onClose?: () => void;
}) {
  const { state, retry } = useRequest(`${domain}/${productId}`, (signal) =>
    api.getProduct(domain, productId, signal),
  );

  return (
    <article className="product" aria-busy={state.status === "loading"}>
      {onClose && (
        <button
          type="button"
          className="secondary button--small product__close"
          onClick={onClose}
        >
          <Icon name="close" size={16} />
          닫기
        </button>
      )}
      {state.status === "loading" && (
        <div className="skeleton skeleton--detail" role="status">
          <span className="visually-hidden">상품 정보를 불러오는 중</span>
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
      {state.status === "failed" && (
        <RequestFailed error={state.error} onRetry={retry} />
      )}
      {state.status === "done" && (
        <ProductBody detail={state.data} headingLevel={headingLevel} />
      )}
    </article>
  );
}

function ProductBody({
  detail,
  headingLevel,
}: {
  detail: ProductDetail;
  headingLevel: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const Sub = headingLevel === 1 ? "h2" : "h3";
  const code = detail.groups
    .flatMap((g) => g.fields)
    .find((f) => f.key === "code")?.display;

  return (
    <>
      <header className="product__head">
        <p className="product__domain">
          <span className="chip chip--domain">{detail.domain_label}</span>
          {code && <span className="code muted">{code}</span>}
        </p>
        <Heading className="product__name">{detail.name}</Heading>
      </header>

      {detail.groups.map((group) => (
        <section
          key={group.key}
          className="field-group"
          aria-labelledby={`fg-${group.key}`}
        >
          <Sub id={`fg-${group.key}`}>{group.label}</Sub>
          <dl className="fields">
            {group.fields.map((field) => (
              <FieldRow key={field.key} field={field} />
            ))}
          </dl>
        </section>
      ))}

      {detail.relations.length > 0 && (
        <section className="field-group" aria-labelledby="fg-relations">
          <Sub id="fg-relations">관계</Sub>
          {detail.relations.map((relation) => (
            <div key={relation.type} className="relation">
              <p className="relation__label">{relation.label}</p>
              <ul className="relation__items">
                {relation.items.map((item) => (
                  <li key={item.id ?? item.name}>
                    <Link
                      className="relation__item"
                      to={searchHref(item.question ?? item.name)}
                    >
                      <span>{item.name}</span>
                      {item.display && (
                        <span className="num muted">{item.display}</span>
                      )}
                      <Icon name="search" size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="muted small">항목을 누르면 관련 검색으로 이어집니다.</p>
        </section>
      )}
    </>
  );
}

function FieldRow({ field }: { field: ProductField }) {
  const missing = field.src === "unavailable";
  return (
    <div className="field">
      <dt>{field.label}</dt>
      <dd>
        <span
          className={[
            "field__value",
            isNumeric(field.kind) ? "num" : "",
            field.kind === "code" ? "code" : "",
            missing ? "muted" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {field.display}
        </span>
        <span className="field__meta">
          <span className={`src src--${field.src}`}>
            {SOURCE_LABEL[field.src]}
          </span>
          {field.as_of && (
            <span>
              기준일 <time dateTime={field.as_of}>{field.as_of}</time>
            </span>
          )}
        </span>
        {field.note && <span className="field__note">{field.note}</span>}
      </dd>
    </div>
  );
}
