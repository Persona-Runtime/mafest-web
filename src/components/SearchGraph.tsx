import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useNavigate } from "react-router";
import { useMappingFocus } from "../lib/citeFocus";
import {
  describeGraph,
  ENTITY_LABEL,
  graphNarrowing,
  SLOT_LABEL,
  setCountText,
} from "../lib/explain";
import { formatCount, productHref } from "../lib/format";
import {
  COMPACT_FONT,
  layoutGraph,
  type PlacedEdge,
  type PlacedNode,
} from "../lib/graphLayout";
import type { ResultRow, SearchResponse } from "../lib/types";
import { TABLE_QUERY, useMediaQuery } from "../lib/useMediaQuery";

/**
 * 탐색 그래프(r8 `interpretation.graph`). 질문이 온톨로지 클래스에 닿고 → 속성 조건을
 * 지나며 상품 집합이 줄고 → 실제 상품(·관계 개체)에 이르는 경로를 노드-간선으로 그린다.
 *
 * - 넓은 화면은 왼쪽→오른쪽, 좁은 화면은 위→아래로 배치한다(graphLayout.ts).
 * - 간선의 번호 배지는 해석 과정 번호와 같다. 어느 쪽이든 올리면 양쪽이 함께 강조된다.
 * - 상품 노드는 링크다. 넓은 화면은 오른쪽 패널, 좁은 화면은 상세 페이지로 간다.
 * - 그림을 못 보는 경우를 위해 같은 내용을 문장 목록으로 둔다(visually-hidden).
 */
export function SearchGraph({
  response,
  onOpen,
}: {
  response: SearchResponse;
  onOpen?: (domain: string, row: ResultRow) => void;
}) {
  const it = response.interpretation;
  const graph = it.graph;
  const wide = useMediaQuery(TABLE_QUERY);
  const navigate = useNavigate();
  const { active, setActive } = useMappingFocus();
  const uid = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);

  // 넓은 화면은 가로 배치를 먼저 해 보고, 72%까지 줄여도 칸을 넘으면 세로로 바꾼다.
  // 가로 스크롤 없이 늘 한눈에 보이게 한다.
  const { layout, scale } = useMemo(() => {
    const vertical = () =>
      layoutGraph(graph, "vertical", Math.max(280, width ?? 340));
    if (!wide) return { layout: vertical(), scale: 1 };
    const horizontal = layoutGraph(graph, "horizontal");
    if (width === null || horizontal.width <= width)
      return { layout: horizontal, scale: 1 };
    const fit = width / horizontal.width;
    return fit >= 0.72
      ? { layout: horizontal, scale: fit }
      : { layout: vertical(), scale: 1 };
  }, [graph, wide, width]);
  const vertical = layout.orientation === "vertical";
  const narrowing = useMemo(
    () => graphNarrowing(graph, it.domains),
    [graph, it.domains],
  );
  const description = useMemo(() => describeGraph(graph), [graph]);

  if (graph.nodes.length === 0) return null;

  // 같은 출발점에서 같은 번호가 여러 간선에 붙으면 배지는 하나만 그린다.
  const badged = new Set<string>();
  const labeled = new Set<string>();
  const badgeOf = (e: PlacedEdge): number | null => {
    const m = e.edge.mapping;
    if (m === null || m >= it.mappings.length) return null;
    const key = `${e.edge.from}:${m}`;
    if (badged.has(key)) return null;
    badged.add(key);
    return m;
  };

  const hover = (mapping: number | null) => ({
    onMouseEnter: mapping === null ? undefined : () => setActive(mapping),
    onMouseLeave: mapping === null ? undefined : () => setActive(null),
  });
  const lit = (mapping: number | null) =>
    active !== null && mapping === active ? true : undefined;

  const openProduct = (node: PlacedNode["node"]) => (event: MouseEvent) => {
    if (!node.domain || !node.product_id) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
      return;
    event.preventDefault();
    const row = response.results
      .find((g) => g.domain === node.domain)
      ?.rows.find((r) => r.product_id === node.product_id);
    if (onOpen && row) onOpen(node.domain, row);
    else navigate(productHref(node.domain, node.product_id));
  };

  const marker = (kind: string) => `url(#${uid}-${kind})`;
  const descId = `${uid}-desc`;

  return (
    <section className="graph card" aria-labelledby={`${uid}-title`}>
      <header className="graph__head">
        <h2 id={`${uid}-title`} className="graph__title">
          탐색 그래프
        </h2>
        {narrowing.length > 0 && (
          <ul className="graph__narrow" aria-label="좁혀진 건수">
            {narrowing.map((n) => (
              <li key={n.domain} className={`narrow narrow--${n.tone}`}>
                <span className="narrow__name">{n.label}</span>
                {n.from !== null && (
                  <>
                    <span className="num">{formatCount(n.from)}</span>
                    <span aria-hidden="true">→</span>
                    <span className="visually-hidden">에서</span>
                  </>
                )}
                <strong className="num">{n.to}</strong>
              </li>
            ))}
          </ul>
        )}
      </header>

      <div
        ref={box}
        className={`graph__canvas graph__canvas--${vertical ? "v" : "h"}`}
        data-focusing={active !== null || undefined}
      >
        <svg
          className="graph__svg"
          width={layout.width * scale}
          height={layout.height * scale}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="group"
          aria-label="탐색 그래프 그림"
          aria-describedby={descId}
        >
          <defs>
            <Arrow id={`${uid}-arrow`} className="gm gm--default" />
            <Arrow id={`${uid}-relation`} className="gm gm--relation" />
            <Arrow id={`${uid}-danger`} className="gm gm--danger" />
            <Arrow id={`${uid}-subclass`} className="gm gm--subclass" hollow />
          </defs>

          <g className="gedges">
            {layout.edges.map((e) => {
              const k = e.edge.kind;
              const m =
                k === "subclass"
                  ? marker("subclass")
                  : e.edge.state === "blocked" || e.edge.state === "empty"
                    ? marker("danger")
                    : k === "relation"
                      ? marker("relation")
                      : marker("arrow");
              return (
                <path
                  key={`${e.edge.from}-${e.edge.to}`}
                  d={e.path}
                  className={`gedge gedge--${k} gstate--${e.edge.state ?? "ok"}`}
                  data-active={lit(e.edge.mapping)}
                  markerEnd={m}
                  {...hover(e.edge.mapping)}
                />
              );
            })}
          </g>

          <g className="gnodes">
            {layout.nodes.map((p) => (
              <GraphNodeView
                key={p.node.id}
                placed={p}
                active={lit(p.node.mapping)}
                hover={hover(p.node.mapping)}
                onClick={openProduct(p.node)}
                compact={vertical}
              />
            ))}
          </g>

          <g className="glabels">
            {layout.edges.map((e) => {
              const badge = badgeOf(e);
              // 같은 출발점의 같은 이름 간선(예: creditGrade ×3)은 이름을 한 번만 쓴다.
              const labelKey = `${e.edge.from}:${e.edge.label}`;
              const label =
                e.edge.label && !labeled.has(labelKey) ? e.edge.label : null;
              if (label) labeled.add(labelKey);
              if (badge === null && !label && !e.edge.weight) return null;
              const slot = badge !== null ? it.mappings[badge].slot : null;
              const text = [label, e.edge.weight].filter(Boolean).join(" ");
              return (
                <g
                  key={`l-${e.edge.from}-${e.edge.to}`}
                  className="glabel"
                  data-active={lit(e.edge.mapping)}
                  {...hover(e.edge.mapping)}
                >
                  {text && (
                    <text
                      className={`gedge-label gedge-label--${e.edge.kind}`}
                      x={e.mid.x}
                      y={e.mid.y + (badge !== null ? -14 : -6)}
                      textAnchor="middle"
                    >
                      {text}
                    </text>
                  )}
                  {badge !== null && slot && (
                    <g
                      className={`gbadge slot--${slot}`}
                      transform={`translate(${e.mid.x},${e.mid.y})`}
                    >
                      <title>{`${badge + 1}. ${SLOT_LABEL[slot]} · ${it.mappings[badge].result}`}</title>
                      <circle r={9} />
                      <text y={4} textAnchor="middle">
                        {badge + 1}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <ol id={descId} className="visually-hidden" aria-label="그래프 설명">
        {description.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>

      <ul className="graph__legend" aria-hidden="true">
        <li>
          <span className="lg lg--concept" />
          클래스
        </li>
        <li>
          <span className="lg lg--individual" />
          개체
        </li>
        <li>
          <span className="lg lg--set" />
          상품 집합
        </li>
        <li>
          <span className="lg lg--product" />
          상품 <span className="lg-star">★</span> 답변 인용
        </li>
        {graph.nodes.some((n) => n.kind === "entity") && (
          <li>
            <span className="lg lg--entity" />
            관계 개체
          </li>
        )}
        <li>
          <span className="lg-line lg-line--constraint" />
          조건으로 좁힘
        </li>
        <li>
          <span className="lg-line lg-line--property" />
          속성
        </li>
      </ul>
    </section>
  );
}

function Arrow({
  id,
  className,
  hollow,
}: {
  id: string;
  className: string;
  hollow?: boolean;
}) {
  return (
    <marker
      id={id}
      className={className}
      viewBox="0 0 10 10"
      refX={hollow ? 9 : 8}
      refY={5}
      markerUnits="userSpaceOnUse"
      markerWidth={hollow ? 12 : 9}
      markerHeight={hollow ? 12 : 9}
      orient="auto-start-reverse"
    >
      <path d="M0,0 L10,5 L0,10 z" />
    </marker>
  );
}

function GraphNodeView({
  placed,
  active,
  hover,
  onClick,
  compact,
}: {
  placed: PlacedNode;
  compact: boolean;
  active: true | undefined;
  hover: {
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  };
  onClick: (event: MouseEvent) => void;
}) {
  const { node, x, y, w, h, lines } = placed;
  const cx = x + w / 2;
  const labelSize = compact ? COMPACT_FONT : 12;
  const state = node.state ?? "ok";
  const common = {
    className: `gnode gnode--${node.kind} gstate--${state}${node.cited ? " gnode--cited" : ""}`,
    "data-active": active,
    ...hover,
  };

  switch (node.kind) {
    case "concept":
      return (
        <g {...common}>
          <title>{node.iri ? `${node.label} (${node.iri})` : node.label}</title>
          <rect x={x} y={y} width={w} height={h} rx={10} />
          <text x={cx} y={y + h / 2 + 4} textAnchor="middle">
            {node.label}
          </text>
        </g>
      );
    case "individual":
      return (
        <g {...common}>
          <title>{node.iri ? `${node.label} (${node.iri})` : node.label}</title>
          <rect x={x} y={y} width={w} height={h} rx={h / 2} />
          <text x={cx} y={y + h / 2 + 4} textAnchor="middle">
            {node.label}
          </text>
        </g>
      );
    case "set":
      return (
        <g {...common}>
          <title>{`${node.label} ${setCountText(node)}`}</title>
          <rect x={x} y={y} width={w} height={h} rx={8} />
          {lines.map((line, i) => (
            <text
              key={i}
              className="gnode__label"
              x={cx}
              y={y + 19 + i * (labelSize + 3)}
              textAnchor="middle"
              fontSize={labelSize}
            >
              {line}
            </text>
          ))}
          <text
            className="gnode__count"
            x={cx}
            y={y + h - 11}
            textAnchor="middle"
          >
            {setCountText(node)}
          </text>
        </g>
      );
    case "product": {
      const label = lines[0];
      const href =
        node.domain && node.product_id
          ? productHref(node.domain, node.product_id)
          : undefined;
      return (
        <a
          {...common}
          href={href}
          onClick={onClick}
          aria-label={`${node.label}${node.cited ? " (답변 인용)" : ""} 상세`}
        >
          <title>{node.label}</title>
          <rect x={x} y={y} width={w} height={h} rx={h / 2} />
          <text x={cx} y={y + h / 2 + 4} textAnchor="middle">
            {node.cited && <tspan className="gnode__star">★ </tspan>}
            {label}
          </text>
        </a>
      );
    }
    case "entity":
      return (
        <g {...common}>
          <title>{node.label}</title>
          <rect x={x} y={y} width={w} height={h} rx={6} />
          {node.entity_type && (
            <text className="gnode__type" x={cx} y={y + 16} textAnchor="middle">
              {ENTITY_LABEL[node.entity_type]}
            </text>
          )}
          <text
            x={cx}
            y={y + (node.entity_type ? 34 : h / 2 + 4)}
            textAnchor="middle"
          >
            {node.label}
          </text>
        </g>
      );
  }
}

/** 요소의 안쪽 폭. ResizeObserver가 없는 환경(jsdom)에서는 null. */
function useWidth(ref: React.RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
