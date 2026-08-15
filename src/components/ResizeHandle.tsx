import { useState } from "react";

interface ResizeHandleProps {
  /** "vertical" = drag left/right (resizes a horizontal split); "horizontal" = drag up/down. */
  direction: "vertical" | "horizontal";
  /** Called with the incremental pointer delta while dragging. */
  onDelta: (delta: number) => void;
  title?: string;
}

/**
 * A thin strip that sits on the edge between two panels. Hover highlights it;
 * drag adjusts the neighboring panel via `onDelta` (incremental px deltas).
 */
export function ResizeHandle({ direction, onDelta, title }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const vertical = direction === "vertical";

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);

    let lastX = e.clientX;
    let lastY = e.clientY;
    document.body.style.cursor = vertical ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      onDelta(vertical ? dx : dy);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDragging(false);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      className={`resize-handle ${vertical ? "resize-handle-v" : "resize-handle-h"}${dragging ? " dragging" : ""}`}
      onMouseDown={handleMouseDown}
      title={title}
    />
  );
}
