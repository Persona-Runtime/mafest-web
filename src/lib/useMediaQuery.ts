import { useSyncExternalStore } from "react";

/**
 * CSS 미디어 쿼리 일치 여부. 표/카드, 오른쪽 패널/상세 페이지처럼 **다른 요소를 그려야
 * 하는** 분기에만 쓴다(둘 다 그려 놓고 CSS로 숨기면 스크린리더가 같은 표를 두 번 읽는다).
 * matchMedia가 없는 환경(jsdom)에서는 false — 모바일 화면으로 그린다.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(query).matches,
    () => false,
  );
}

/** 표는 이 폭 이상에서, 상세 오른쪽 패널은 WIDE 이상에서. app.css의 값과 맞춘다. */
export const TABLE_QUERY = "(min-width: 720px)";
export const WIDE_QUERY = "(min-width: 1100px)";
