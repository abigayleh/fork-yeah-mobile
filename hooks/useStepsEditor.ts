import { makeLineId, useEditableLines } from './useEditableLines';
import { normalizeSteps, type RecipeStep } from '../types/recipe';

// id only exists for editor bookkeeping (React/drag-list identity) — it's stripped
// before steps get persisted, since RecipeStep itself has no id.
export interface EditableStep {
  id: string;
  text: string;
  isHeader?: boolean;
  imageUrl?: string;
}

export function useStepsEditor() {
  const editable = useEditableLines<EditableStep>([{ id: makeLineId('step'), text: '' }], {
    mergeStrategy: 'concatText',
    mergeExtra: (previous, current) => ({ imageUrl: previous.imageUrl || current.imageUrl }),
    idPrefix: 'step',
  });

  const resetSteps = (initial: Array<string | RecipeStep>) => {
    const normalized = normalizeSteps(initial).map((step) => ({ ...step, id: makeLineId('step') }));
    editable.resetLines(normalized);
  };

  const updateStepText = (index: number, text: string) => editable.updateLine(index, { text });
  const updateStepImage = (index: number, imageUrl: string | undefined) => editable.updateLine(index, { imageUrl });

  // Only called at save time. Blank normal steps are silently dropped; a blank header
  // is a validation error, since an unnamed section doesn't mean anything.
  const validateSteps = (): { steps: RecipeStep[] } | { errors: Record<number, string> } => {
    const nextErrors: Record<number, string> = {};

    editable.lines.forEach((step, index) => {
      if (step.isHeader && !step.text.trim()) {
        nextErrors[index] = 'Enter a section title';
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      editable.setErrors(nextErrors);
      return { errors: nextErrors };
    }

    editable.setErrors({});
    return {
      steps: editable.lines
        .filter((step) => step.isHeader || step.text.trim())
        .map(({ id, ...step }) => step),
    };
  };

  return { ...editable, steps: editable.lines, resetSteps, updateStepText, updateStepImage, validateSteps };
}

export type StepsEditorState = ReturnType<typeof useStepsEditor>;
