import { makeLineId, useEditableLines } from './useEditableLines';
import { parseIngredientLine, formatIngredientLine } from '../utils/parseIngredientLine';
import type { CustomRecipeIngredient, IngredientSectionMarker } from '../types/recipe';

export interface IngredientLine {
  id: string;
  text: string;
  isHeader?: boolean;
}

// Builds the interleaved editor line list from a saved recipe's flat ingredients array
// plus its section markers — the inverse of validateAndParse below.
export function hydrateIngredientLines(
  ingredients: CustomRecipeIngredient[],
  sections: IngredientSectionMarker[] | undefined
): IngredientLine[] {
  const markers = [...(sections || [])].sort((a, b) => a.startIndex - b.startIndex);
  const lines: IngredientLine[] = [];

  ingredients.forEach((ingredient, index) => {
    const marker = markers.find((section) => section.startIndex === index);
    if (marker) {
      lines.push({ id: makeLineId('ingredient'), text: marker.title, isHeader: true });
    }
    lines.push({ id: makeLineId('ingredient'), text: formatIngredientLine(ingredient) });
  });

  return lines;
}

export function useIngredientLinesEditor() {
  const editable = useEditableLines<IngredientLine>([{ id: makeLineId('ingredient'), text: '' }], {
    mergeStrategy: 'deleteOutright',
    idPrefix: 'ingredient',
  });

  const updateLine = (index: number, text: string) => editable.updateLine(index, { text });

  // Only called at save time. Blank ingredient lines are silently dropped; a blank
  // header is a validation error, since an unnamed section doesn't mean anything.
  const validateAndParse = ():
    | { ingredients: CustomRecipeIngredient[]; sections: IngredientSectionMarker[] }
    | { errors: Record<number, string> } => {
    const nextErrors: Record<number, string> = {};
    const ingredients: CustomRecipeIngredient[] = [];
    const sections: IngredientSectionMarker[] = [];

    editable.lines.forEach((line, index) => {
      if (line.isHeader) {
        if (!line.text.trim()) {
          nextErrors[index] = 'Enter a section title';
        } else {
          sections.push({ title: line.text.trim(), startIndex: ingredients.length });
        }
        return;
      }

      if (!line.text.trim()) return;

      const result = parseIngredientLine(line.text);
      if ('error' in result) {
        nextErrors[index] = result.error.message;
      } else {
        ingredients.push(result.data);
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      editable.setErrors(nextErrors);
      return { errors: nextErrors };
    }

    editable.setErrors({});
    return { ingredients, sections };
  };

  return { ...editable, updateLine, validateAndParse };
}

export type IngredientLinesEditorState = ReturnType<typeof useIngredientLinesEditor>;
