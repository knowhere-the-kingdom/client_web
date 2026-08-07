export const MIN_TOUCH_TARGET_CSS_PX = 44;

export type MobileViewportSnapshot = {
  layoutWidth: number;
  layoutHeight: number;
  visualWidth: number;
  visualHeight: number;
  scale: number;
  orientation: "portrait" | "landscape";
  keyboardVisible: boolean;
};

type ViewportLike = {
  innerWidth: number;
  innerHeight: number;
  visualViewport?: {
    width: number;
    height: number;
    scale: number;
    addEventListener?: (type: "resize" | "scroll", listener: () => void) => void;
    removeEventListener?: (type: "resize" | "scroll", listener: () => void) => void;
  } | null;
  addEventListener: (type: "resize" | "orientationchange", listener: () => void) => void;
  removeEventListener: (type: "resize" | "orientationchange", listener: () => void) => void;
};

export function readMobileViewport(view: ViewportLike): MobileViewportSnapshot {
  const visualWidth = view.visualViewport?.width ?? view.innerWidth;
  const visualHeight = view.visualViewport?.height ?? view.innerHeight;
  const layoutWidth = view.innerWidth;
  const layoutHeight = view.innerHeight;
  return {
    layoutWidth,
    layoutHeight,
    visualWidth,
    visualHeight,
    scale: view.visualViewport?.scale ?? 1,
    orientation: visualWidth >= visualHeight ? "landscape" : "portrait",
    keyboardVisible: layoutHeight - visualHeight > 120,
  };
}

export function observeMobileViewport(
  view: ViewportLike,
  onChange: (snapshot: MobileViewportSnapshot) => void,
): () => void {
  const emit = () => onChange(readMobileViewport(view));
  const visualViewport = view.visualViewport;
  view.addEventListener("resize", emit);
  view.addEventListener("orientationchange", emit);
  visualViewport?.addEventListener?.("resize", emit);
  visualViewport?.addEventListener?.("scroll", emit);
  emit();
  return () => {
    view.removeEventListener("resize", emit);
    view.removeEventListener("orientationchange", emit);
    visualViewport?.removeEventListener?.("resize", emit);
    visualViewport?.removeEventListener?.("scroll", emit);
  };
}
