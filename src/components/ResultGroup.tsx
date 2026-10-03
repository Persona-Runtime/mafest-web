import type { MouseEvent } from "react";
import { Link } from "react-router";
import { formatCount, isNumeric, productHref } from "../lib/format";
import type {
  Column,
  InterpretedDomain,
  ResultGroup,
  ResultRow,
  Sort,
} from "../lib/types";
import { TABLE_QUERY, useMediaQuery } from "../lib/useMediaQuery";
import { Icon } from "./Icon";

/**
 * 상품군 하나의 결과. 넓은 화면은 표, 좁은 화면은 카드.
 *
 * - 숫자는 오른쪽 정렬·고정폭(tabular-nums).
 * - 수익률은 색을 쓰지 않고 부호로만 보인다(빨강·파랑 관례가 나라마다 반대).
 * - 상품을 누르면 넓은 화면은 오른쪽 패널(onOpen), 그 밖은 상세 페이지로 간다.
 */
export function ResultGroupView({
  group,
  domain,
  sort,
  selectedId,
  onOpen,
}: {
  group: ResultGroup;
  domain: InterpretedDomain | undefined;
  sort: Sort | null;
  selectedId: string | null;
  onOpen?: (row: ResultRow) => void;
}) {
  const asTable = useMediaQuery(TABLE_QUERY);
  const label = domain?.label ?? group.domain;
  const headingId = `results-${group.domain}`;
  const shown = group.rows.length;

  const open = (row: ResultRow) => (event: MouseEvent) => {
    if (!onOpen) return;
    // 새 탭 열기(⌘·Ctrl·가운데 클릭)는 그대로 둔다.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
      return;
    event.preventDefault();
    onOpen(row);
  };

  return (
    <section className="result-group card" aria-labelledby={headingId}>
      <header className="result-group__head">
        <h3 id={headingId}>
          {label}
          {domain?.status === "PARTIAL" && (
            <span className="badge badge--warn">일부만</span>
          )}
        </h3>
        <p className="result-group__count">
          {group.truncated
            ? `총 ${formatCount(group.total_count)}건 중 ${formatCount(shown)}건`
            : `${formatCount(shown)}건`}
          {domain?.base_date && (
            <>
              {" · 기준일 "}
              <time dateTime={domain.base_date}>{domain.base_date}</time>
            </>
          )}
        </p>
      </header>

      {shown === 0 ? (
        <p className="muted">표시할 상품이 없습니다.</p>
      ) : asTable ? (
        <div className="table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col" className="num">
                  #
                </th>
                <th scope="col">상품명</th>
                {group.columns.map((column) => (
                  <th
                    scope="col"
                    key={column.key}
                    className={headerClass(column)}
                    aria-sort={
                      column.key === sort?.axis
                        ? sort.dir === "desc"
                          ? "descending"
                          : "ascending"
                        : undefined
                    }
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row, index) => (
                <tr
                  key={row.product_id}
                  data-selected={row.product_id === selectedId || undefined}
                >
                  <td className="num muted">{index + 1}</td>
                  <th scope="row" className="results-table__name">
                    <Link
                      to={productHref(group.domain, row.product_id)}
                      onClick={open(row)}
                    >
                      <Cited cited={row.cited} />
                      {row.name}
                    </Link>
                  </th>
                  {group.columns.map((column) => (
                    <td key={column.key} className={cellClass(column)}>
                      <CellText row={row} column={column} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="result-cards">
          {group.rows.map((row) => (
            <li key={row.product_id}>
              <Link
                className="result-card"
                to={productHref(group.domain, row.product_id)}
                onClick={open(row)}
                data-selected={row.product_id === selectedId || undefined}
              >
                <span className="result-card__name">
                  <Cited cited={row.cited} />
                  {row.name}
                </span>
                <dl className="result-card__values">
                  {cardColumns(group.columns).map((column) => (
                    <div key={column.key}>
                      <dt>{column.label}</dt>
                      <dd className={isNumeric(column.kind) ? "num" : ""}>
                        <CellText row={row} column={column} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <span className="result-card__go">
                  <Icon name="arrow" size={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {group.rows.some((row) => row.cited) && (
        <p className="legend">
          <Icon name="star" size={13} /> 답변에 인용된 상품
        </p>
      )}
    </section>
  );
}

function Cited({ cited }: { cited: boolean }) {
  if (!cited) return null;
  return (
    <span className="cited" title="답변에 인용">
      <Icon name="star" size={14} />
      <span className="visually-hidden">답변에 인용, </span>
    </span>
  );
}

function CellText({ row, column }: { row: ResultRow; column: Column }) {
  const value = row.values[column.key];
  if (!value) return <span className="muted">—</span>;
  if (value.src === "unavailable")
    return (
      <span className="muted" title={value.note ?? undefined}>
        {value.display || "—"}
      </span>
    );
  return <>{value.display}</>;
}

function headerClass(column: Column): string {
  return [isNumeric(column.kind) ? "num" : "", column.emphasis ? "emph" : ""]
    .filter(Boolean)
    .join(" ");
}

function cellClass(column: Column): string {
  return [
    isNumeric(column.kind) ? "num" : "",
    column.kind === "code" ? "code" : "",
    column.emphasis ? "emph" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** 카드에는 강조 열 2개 + 등급 열만 싣는다. 좁은 화면에서 모든 열을 늘어놓지 않는다. */
function cardColumns(columns: Column[]): Column[] {
  const emphasized = columns.filter((c) => c.emphasis).slice(0, 2);
  const grade = columns.find((c) => c.kind === "grade");
  const picked =
    grade && !emphasized.includes(grade) ? [...emphasized, grade] : emphasized;
  if (picked.length > 0) return picked;
  return columns.filter((c) => c.kind !== "code").slice(0, 2);
}
