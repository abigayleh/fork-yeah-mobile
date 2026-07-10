import { makeLineId, useEditableLines } from './useEditableLines';

export interface GroceryItemLine {
  id: string;
  text: string;
  checked: boolean;
}

export type GroceryItem = { name: string; checked: boolean };

export function hydrateGroceryItems(items: GroceryItem[]): GroceryItemLine[] {
  return items.map((item) => ({ id: makeLineId('grocery'), text: item.name, checked: Boolean(item.checked) }));
}

// Grocery items are a flat list with no section headers, so backspace-at-start always
// merges text into the previous item (the header-related branches in useEditableLines
// simply never trigger, since isHeader is never set here).
export function useGroceryItemsEditor(initialItems: GroceryItem[]) {
  const editable = useEditableLines<GroceryItemLine>(hydrateGroceryItems(initialItems), {
    mergeStrategy: 'concatText',
    idPrefix: 'grocery',
  });

  const updateItemText = (index: number, text: string) => editable.updateLine(index, { text });
  const toggleItemChecked = (index: number) => {
    const current = editable.lines[index];
    if (!current) return;
    editable.updateLine(index, { checked: !current.checked } as Partial<GroceryItemLine>);
  };

  // Blank lines are dropped whenever the list is persisted (not just at an explicit
  // "save" step, since grocery lists autosave on every change).
  const toGroceryItems = (): GroceryItem[] =>
    editable.lines
      .filter((line) => line.text.trim())
      .map((line) => ({ name: line.text.trim(), checked: line.checked }));

  return { ...editable, items: editable.lines, updateItemText, toggleItemChecked, toGroceryItems };
}

export type GroceryItemsEditorState = ReturnType<typeof useGroceryItemsEditor>;
