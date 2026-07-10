import { useState } from 'react';

export interface EditableLineBase {
  id: string;
  text: string;
  isHeader?: boolean;
}

export interface PendingFocus {
  index: number;
  caret: number;
}

let idCounter = 0;
export function makeLineId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

interface UseEditableLinesOptions<TLine extends EditableLineBase> {
  // 'deleteOutright': backspace at the start of a line removes it (ingredients).
  // 'concatText': backspace at the start merges its text onto the end of the previous
  // line (steps, grocery items). Either way, a header line is always deleted outright,
  // and backspacing into a header from a normal line below it is a no-op.
  mergeStrategy: 'deleteOutright' | 'concatText';
  mergeExtra?: (previous: TLine, current: TLine) => Partial<TLine>;
  idPrefix: string;
}

export function useEditableLines<TLine extends EditableLineBase>(
  initial: TLine[],
  options: UseEditableLinesOptions<TLine>
) {
  const makeBlank = (): TLine => ({ id: makeLineId(options.idPrefix), text: '' } as TLine);
  const [lines, setLines] = useState<TLine[]>(() => (initial.length > 0 ? initial : [makeBlank()]));
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const resetLines = (next: TLine[]) => {
    setLines(next.length > 0 ? next : [makeBlank()]);
    setPendingFocus(null);
    setErrors({});
  };

  const updateLine = (index: number, patch: Partial<TLine>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    if (patch.text !== undefined) {
      setErrors((prev) => {
        if (!(index in prev)) return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const removeLine = (index: number) => {
    setLines((prev) => {
      const next = prev.filter((_line, i) => i !== index);
      return next.length > 0 ? next : [makeBlank()];
    });
  };

  const addSectionHeader = () => {
    setLines((prev) => {
      const next = [...prev, { ...makeBlank(), isHeader: true } as TLine];
      setPendingFocus({ index: next.length - 1, caret: 0 });
      return next;
    });
  };

  // Enter key: splits the current line's text at the cursor/selection into two lines.
  // The trailing half is always a normal line, even when splitting a header.
  const splitLine = (index: number, selectionStart: number, selectionEnd: number) => {
    setLines((prev) => {
      const current = prev[index];
      const before = current.text.slice(0, selectionStart);
      const after = current.text.slice(selectionEnd);
      const next = [...prev];
      next.splice(index, 1, { ...current, text: before }, { ...makeBlank(), text: after } as TLine);
      return next;
    });
    setPendingFocus({ index: index + 1, caret: 0 });
  };

  // Backspace at the very start of a line.
  const deleteAtStart = (index: number) => {
    if (index <= 0) return;
    const current = lines[index];
    const previous = lines[index - 1];

    if (current.isHeader) {
      setLines((prev) => prev.filter((_line, i) => i !== index));
      setPendingFocus({ index: index - 1, caret: previous?.text.length ?? 0 });
      return;
    }

    if (previous.isHeader) return;

    if (options.mergeStrategy === 'concatText') {
      const mergedText = previous.text + current.text;
      const extra = options.mergeExtra?.(previous, current) ?? {};
      setLines((prev) => {
        const next = prev.filter((_line, i) => i !== index);
        next[index - 1] = { ...previous, text: mergedText, ...extra };
        return next;
      });
    } else {
      setLines((prev) => prev.filter((_line, i) => i !== index));
    }
    setPendingFocus({ index: index - 1, caret: previous.text.length });
  };

  // Section membership is purely positional (a line belongs to whichever header
  // precedes it), so moving a line elsewhere in the list is all reordering needs to do.
  const reorderLines = (fromIndex: number, toIndex: number) => {
    setLines((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const clearPendingFocus = () => setPendingFocus(null);

  return {
    lines,
    resetLines,
    updateLine,
    removeLine,
    addSectionHeader,
    splitLine,
    deleteAtStart,
    reorderLines,
    pendingFocus,
    clearPendingFocus,
    errors,
    setErrors,
    makeBlank,
  };
}
