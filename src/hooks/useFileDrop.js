import { useState } from 'react';

const DRAG_STYLE = { outline: '3px dashed #087c66', outlineOffset: -6 };

/**
 * Makes an element a drop target for files (e.g. an attachment dragged from Outlook).
 * Spread `dropProps` on the element and merge `dropStyle` into its style.
 * `onFiles` receives the dropped files as an array; nothing happens while `disabled`.
 */
export default function useFileDrop(onFiles, disabled = false) {
  const [dragging, setDragging] = useState(false);

  const dropProps = {
    onDragOver: (event) => {
      event.preventDefault();
      if (!disabled) setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event) => {
      event.preventDefault();
      setDragging(false);
      const files = [...event.dataTransfer.files];
      if (!disabled && files.length) onFiles(files);
    },
  };

  return { dropProps, dropStyle: dragging ? DRAG_STYLE : undefined };
}
