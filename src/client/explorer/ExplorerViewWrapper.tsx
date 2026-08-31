/**
 * ExplorerViewWrapper — the main split-pane view with a resizable
 * file tree on the left and the editor on the right.
 */

import React, { useEffect, useRef, useState } from "react";
import { FileManagerPanel } from "./FileManagerPanel";
import type { FileManagerRemote } from "./remote";

const TREE_WIDTH_KEY = "dsh.explorer.treeWidth";
const TREE_WIDTH_DEFAULT = 300;
const TREE_WIDTH_MIN = 160;
const TREE_CONTENT_MIN = 240;

function clampTreeWidth(value: unknown, containerWidth?: number): number {
  const n = Math.round(Number(value));
  const finite = Number.isFinite(n) ? n : TREE_WIDTH_DEFAULT;
  const upper =
    containerWidth !== undefined && containerWidth > 0
      ? Math.max(TREE_WIDTH_MIN, containerWidth - TREE_CONTENT_MIN)
      : 1200;
  return Math.min(upper, Math.max(TREE_WIDTH_MIN, finite));
}

function readTreeWidth(): number {
  try {
    return clampTreeWidth(localStorage.getItem(TREE_WIDTH_KEY) ?? TREE_WIDTH_DEFAULT);
  } catch {
    return TREE_WIDTH_DEFAULT;
  }
}

interface ExplorerViewWrapperProps {
  remote: FileManagerRemote;
  t: (key: string) => string;
  useSessions?: (selector: (s: any) => any) => any;
}

// FileEditorView is imported from the editor module
// We use a lazy reference to avoid circular deps
let FileEditorViewComponent: React.ComponentType<{ remote: FileManagerRemote; t: (key: string) => string }> | null = null;

export function setFileEditorViewComponent(
  component: React.ComponentType<{ remote: FileManagerRemote; t: (key: string) => string }>,
) {
  FileEditorViewComponent = component;
}

export function ExplorerViewWrapper(props: ExplorerViewWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number; containerWidth?: number } | null>(null);
  const widthRef = useRef(readTreeWidth());
  const [treeWidth, setTreeWidth] = useState(widthRef.current);
  const [viewHeight, setViewHeight] = useState(0);
  const [bottomClearance, setBottomClearance] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const scroller = el.closest("[data-conversation-scroll]");
    if (!scroller) return;
    const prevGutter = (scroller as HTMLElement).style.scrollbarGutter;
    (scroller as HTMLElement).style.scrollbarGutter = "auto";
    const sync = () => {
      const clientHeight = (scroller as HTMLElement).clientHeight;
      if (clientHeight <= 0) return;
      const composer = scroller.querySelector("[data-composer-seat]");
      const composerHeight = composer ? (composer as HTMLElement).offsetHeight : 0;
      const overlay = scroller.querySelector("[data-conversation-composer-overlay]") !== null;
      const available = overlay ? clientHeight : Math.max(160, clientHeight - composerHeight);
      setViewHeight(available);
      setBottomClearance(overlay ? composerHeight + 16 : 0);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(scroller as Element);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      (scroller as HTMLElement).style.scrollbarGutter = prevGutter;
    };
  }, []);

  const onResizeStart = (event: React.PointerEvent) => {
    event.preventDefault();
    const rect = containerRef.current ? containerRef.current.getBoundingClientRect() : null;
    dragRef.current = {
      startX: event.clientX,
      startWidth: widthRef.current,
      containerWidth: rect ? rect.width : undefined,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.setAttribute("data-dragging", "true");
  };

  const onResizeMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = clampTreeWidth(drag.startWidth + (event.clientX - drag.startX), drag.containerWidth);
    widthRef.current = next;
    setTreeWidth(next);
  };

  const onResizeEnd = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    event.currentTarget.removeAttribute("data-dragging");
    try {
      localStorage.setItem(TREE_WIDTH_KEY, String(widthRef.current));
    } catch {
      /* storage unavailable — the session width still applies */
    }
  };

  const EditorComponent = FileEditorViewComponent;

  return (
    <div
      className="dshfx-split"
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "row",
        height: viewHeight > 0 ? viewHeight + "px" : "100%",
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        className="dshfx-tree-pane"
        style={{
          width: treeWidth + "px",
          flex: "0 0 auto",
          minWidth: 0,
          overflow: "hidden",
          borderRight: "1px solid var(--dsw-alias-border-l2)",
          boxSizing: "border-box",
          paddingBottom: bottomClearance,
        } as React.CSSProperties}
      >
        <FileManagerPanel
          remote={props.remote}
          t={props.t}
          useSessions={props.useSessions}
          onFileOpened={() => {}}
        />
      </div>
      <div
        className="dshfx-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整文件树宽度"
        style={{
          flex: "0 0 auto",
          width: 6,
          cursor: "col-resize",
          touchAction: "none",
          position: "relative",
          zIndex: 1,
        }}
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
      />
      <div
        className="dshfx-editor-pane"
        style={{
          flex: "1 1 0%",
          minWidth: 0,
          overflow: "hidden",
          paddingBottom: bottomClearance,
        } as React.CSSProperties}
      >
        {EditorComponent && <EditorComponent remote={props.remote} t={props.t} />}
      </div>
    </div>
  );
}
