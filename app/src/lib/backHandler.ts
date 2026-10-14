import { closeView, graniteEvent } from "@apps-in-toss/web-framework";
import { useEffect, useRef } from "react";

type Handler = () => void;

// 가장 최근에 열린 시트/단계가 뒤로가기를 먼저 소비하도록 LIFO 스택으로 관리.
const stack: Handler[] = [];
let rootHandler: Handler | null = null;
let installed = false;

function exitApp() {
  void closeView().catch(() => {
    /* 토스 환경이 아니면(브라우저 dev) 무시 */
  });
}

function onBack() {
  const top = stack[stack.length - 1];
  if (top) {
    top();
    return;
  }
  if (rootHandler) {
    rootHandler();
    return;
  }
  exitApp();
}

/**
 * 네이티브 뒤로가기를 앱이 직접 처리하도록 등록.
 * 리스너가 붙으면 토스가 미니앱을 바로 닫지 않으므로, 루트 화면에서는
 * 반드시 `exitApp()`(closeView)으로 직접 종료해야 해요.
 */
export function installBackHandler(root: (exit: () => void) => void): () => void {
  rootHandler = () => root(exitApp);
  if (installed) return () => {};
  installed = true;
  try {
    const remove = graniteEvent.addEventListener("backEvent", {
      onEvent: onBack,
      onError: (err) => console.warn("[back] backEvent error", err),
    });
    return () => {
      installed = false;
      rootHandler = null;
      remove();
    };
  } catch (err) {
    console.debug("[back] backEvent unavailable", err);
    installed = false;
    return () => {};
  }
}

/** `active`인 동안 뒤로가기를 가로채 `handler`를 실행해요. 시트 닫기·이전 단계 이동용. */
export function useBackHandler(active: boolean, handler: Handler) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!active) return;
    const h: Handler = () => ref.current();
    stack.push(h);
    return () => {
      const i = stack.lastIndexOf(h);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}
