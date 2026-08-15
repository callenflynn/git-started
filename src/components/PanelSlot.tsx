import type { CSSProperties, ReactNode } from "react";
import { GripVertical, X, ArrowDownToLine } from "lucide-react";
import type { PanelId } from "../stores/layout-store";

interface PanelSlotProps {
  panelId: PanelId | null;
  slotIndex: number;
  label: string;
  editMode: boolean;
  /** True when the user is hovering this slot with a dragged panel. */
  dragOver: boolean;
  /** True when this slot is the source of the active drag. */
  isSource: boolean;
  className?: string;
  style?: CSSProperties;
  onGripMouseDown: (e: React.MouseEvent, id: PanelId) => void;
  onRemovePanel: (id: PanelId) => void;
  children?: ReactNode;
}

/**
 * A single grid cell in the main layout. In edit mode it exposes a drag
 * handle (rearrange), a remove button, and a "drop here" preview while a
 * panel is dragged over it. Dragging is pointer-based (like the resize
 * handles) rather than native HTML5 drag-and-drop, which is unreliable in
 * WebView2.
 */
export function PanelSlot({
  panelId,
  slotIndex,
  label,
  editMode,
  dragOver,
  isSource,
  className,
  style,
  onGripMouseDown,
  onRemovePanel,
  children,
}: PanelSlotProps) {
  // In normal mode an empty slot renders nothing so its sibling takes the row.
  if (!editMode && panelId === null) return null;

  // Only show the drop preview on non-source slots.
  const showDrop = dragOver && !isSource;

  const cls = [
    "relative flex flex-col min-h-0 min-w-0 overflow-hidden",
    editMode ? "layout-slot" : "",
    showDrop ? "layout-slot-drop" : "",
    isSource ? "layout-slot-source" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div data-layout-slot={slotIndex} className={cls} style={style}>
      {editMode && (
        <div className="layout-slot-header">
          {panelId ? (
            <>
              <span
                onMouseDown={(e) => onGripMouseDown(e, panelId)}
                className="layout-slot-drag"
                title="Drag to rearrange"
              >
                <GripVertical size={13} />
              </span>
              <span className="layout-slot-title">{label}</span>
              <button
                className="layout-slot-remove"
                onClick={() => onRemovePanel(panelId)}
                title="Remove panel"
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <span className="layout-slot-empty">Empty — drag a panel here</span>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        {children}
      </div>

      {showDrop && (
        <div className="layout-slot-drop-overlay">
          <span>
            <ArrowDownToLine size={14} />
            Drop here
          </span>
        </div>
      )}
    </div>
  );
}
