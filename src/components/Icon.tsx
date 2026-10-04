/**
 * 인라인 stroke SVG 아이콘(persona-web W-0에서 가져옴).
 *
 * 이모지·아이콘 폰트를 쓰지 않는다 — 기기마다 모양이 다르고 외부 요청이 생긴다.
 * 아이콘은 늘 옆의 텍스트를 보조하므로 보조기술에서 숨긴다.
 */

const PATHS = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  back: "M15 5l-7 7 7 7",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M6 9l6 6 6-6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01",
  alert: "M12 4l9 16H3zM12 10v4M12 17h.01",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  star: "M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  minus: "M6 12h12",
  stop: "M8 8h8v8H8z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
