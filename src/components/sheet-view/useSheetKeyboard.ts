import { useEffect, useCallback, useState } from "react";

interface UseSheetKeyboardOptions {
  rowCount: number;
  colCount: number;
  onEdit: (row: number, col: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onToggleSelect: (row: number) => void;
  isEditing: boolean;
}

export const useSheetKeyboard = ({
  rowCount, colCount, onEdit, onCancelEdit, onSaveEdit, onToggleSelect, isEditing
}: UseSheetKeyboardOptions) => {
  const [focusRow, setFocusRow] = useState(0);
  const [focusCol, setFocusCol] = useState(0);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't capture when typing in inputs/textareas outside sheet
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      if (e.key === 'Escape') {
        onCancelEdit();
        (target as HTMLInputElement).blur();
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSaveEdit();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        onSaveEdit();
        setFocusCol(prev => Math.min(prev + 1, colCount - 1));
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusRow(prev => Math.min(prev + 1, rowCount - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusRow(prev => Math.max(prev - 1, 0));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setFocusCol(prev => Math.min(prev + 1, colCount - 1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setFocusCol(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        onEdit(focusRow, focusCol);
        break;
      case ' ':
        e.preventDefault();
        onToggleSelect(focusRow);
        break;
      case 'Escape':
        onCancelEdit();
        break;
    }
  }, [focusRow, focusCol, rowCount, colCount, onEdit, onCancelEdit, onSaveEdit, onToggleSelect, isEditing]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { focusRow, focusCol, setFocusRow, setFocusCol };
};
