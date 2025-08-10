import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RefObject, ReactNode } from "react";
import { createPortal } from "react-dom";

export type PopupPlacement = "top" | "right" | "bottom" | "left";

interface AnchoredPopupProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  placement?: PopupPlacement;
  offset?: number;
  className?: string;
  children: ReactNode;
}

/**
 * AnchoredPopup renders a floating panel positioned near a given anchor element.
 * - placement: top | right | bottom | left
 * - offset: distance (px) between the anchor and the popup
 */
export default function AnchoredPopup({
  open,
  onClose,
  anchorRef,
  placement = "bottom",
  offset = 8,
  className = "",
  children,
}: AnchoredPopupProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  const updatePosition = useCallback(() => {
    const anchorEl = anchorRef.current;
    const popupEl = popupRef.current;
    if (!anchorEl || !popupEl) return;

    const rect = anchorEl.getBoundingClientRect();
    const popupRect = popupEl.getBoundingClientRect();

    let top = 0;
    let left = 0;

    switch (placement) {
      case "top":
        top = rect.top - popupRect.height - offset;
        left = rect.left + rect.width / 2 - popupRect.width / 2;
        break;
      case "right":
        top = rect.top + rect.height / 2 - popupRect.height / 2;
        left = rect.right + offset;
        break;
      case "left":
        top = rect.top + rect.height / 2 - popupRect.height / 2;
        left = rect.left - popupRect.width - offset;
        break;
      case "bottom":
      default:
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2 - popupRect.width / 2;
        break;
    }

    // Constrain within viewport margins (optional small padding)
    const padding = 8;
    const maxLeft = window.innerWidth - popupRect.width - padding;
    const maxTop = window.innerHeight - popupRect.height - padding;
    left = Math.max(padding, Math.min(left, Math.max(padding, maxLeft)));
    top = Math.max(padding, Math.min(top, Math.max(padding, maxTop)));

    setCoords({ top, left });
  }, [anchorRef, offset, placement]);

  useLayoutEffect(() => {
    if (!open) return;
    // Position after first open render
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const anchorEl = anchorRef.current;
      const popupEl = popupRef.current;
      if (!anchorEl || !popupEl) return;
      if (popupEl.contains(target)) return;
      if (anchorEl.contains(target as Node)) return;
      onClose();
    };

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onDocumentClick);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onDocumentClick);
    };
  }, [open, onClose, anchorRef, updatePosition]);

  // Reposition when popup or anchor resizes (content or layout changes)
  useEffect(() => {
    if (!open) return;
    const popupEl = popupRef.current;
    const anchorEl = anchorRef.current;
    if (!popupEl) return;

    const ro = new ResizeObserver(() => updatePosition());
    ro.observe(popupEl);
    if (anchorEl) ro.observe(anchorEl);

    return () => ro.disconnect();
  }, [open, updatePosition, anchorRef]);

  const container = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.body;
  }, []);

  if (!open || !container) return null;

  return createPortal(
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        zIndex: 60,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "calc(100vh - 16px)",
        overflow: "auto",
      }}
      className={
        "card bg-base-100 shadow-xl border border-base-300 p-0 " + className
      }
      role="dialog"
      aria-modal="false"
    >
      {children}
    </div>,
    container,
  );
}
