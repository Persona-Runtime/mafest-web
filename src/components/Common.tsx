import { formatCount } from "../lib/format";
import { INVESTMENT_NOTICE } from "../lib/site";
import type { MetaDomain } from "../lib/types";

/** 고정 투자 고지. 결과·상세 화면 아래에 항상 둔다. */
export function InvestmentNotice() {
  return (
    <aside className="investment-notice" aria-label="투자 고지">
      {INVESTMENT_NOTICE.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </aside>
  );
}

/** 상품군별 건수와 기준일. 기준일은 상품군마다 다르다. */
export function CoverageTable({
  domains,
  caption,
}: {
  domains: MetaDomain[];
  caption: string;
}) {
  return (
    <table className="coverage">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">상품군</th>
          <th scope="col" className="num">
            상품 수
          </th>
          <th scope="col" className="num">
            기준일
          </th>
        </tr>
      </thead>
      <tbody>
        {domains.map((d) => (
          <tr key={d.domain}>
            <th scope="row">{d.label}</th>
            <td className="num">{formatCount(d.count)}</td>
            <td className="num">
              {d.base_date ? (
                <time dateTime={d.base_date}>{d.base_date}</time>
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
