/**
 * Focused contract tests for `src/components/AuditNoteEditor.types.ts`.
 *
 * The existing `AuditNoteEditor.test.tsx` exercises the templates through the
 * rendered component. These tests pin the module's own contract directly:
 * the shape, uniqueness and key-safety of `DEFAULT_TEMPLATES`, and the
 * optionality boundaries of `AuditNoteEditorProps`.
 */

import { DEFAULT_TEMPLATES } from './AuditNoteEditor.types';
import type { NoteTemplate, AuditNoteEditorProps } from './AuditNoteEditor.types';

const TEMPLATE_KEYS = ['id', 'label', 'content'];

describe('AuditNoteEditor.types', () => {
  describe('DEFAULT_TEMPLATES', () => {
    it('is a non-empty array of well-formed NoteTemplate entries', () => {
      expect(Array.isArray(DEFAULT_TEMPLATES)).toBe(true);
      expect(DEFAULT_TEMPLATES.length).toBeGreaterThan(0);

      for (const template of DEFAULT_TEMPLATES) {
        expect(Object.keys(template).sort()).toEqual([...TEMPLATE_KEYS].sort());
        expect(typeof template.id).toBe('string');
        expect(typeof template.label).toBe('string');
        expect(typeof template.content).toBe('string');
      }
    });

    it('gives every template a non-blank label and content', () => {
      for (const template of DEFAULT_TEMPLATES) {
        expect(template.label.trim().length).toBeGreaterThan(0);
        expect(template.content.trim().length).toBeGreaterThan(0);
      }
    });

    it('uses unique, React-key-safe ids', () => {
      const ids = DEFAULT_TEMPLATES.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);

      for (const id of ids) {
        expect(id).toMatch(/^[a-z][a-z0-9_-]*$/);
      }
    });

    it('every entry structurally satisfies the exported NoteTemplate type', () => {
      const templates: NoteTemplate[] = DEFAULT_TEMPLATES;
      expect(templates).toBe(DEFAULT_TEMPLATES);
    });
  });

  describe('AuditNoteEditorProps', () => {
    it('accepts an empty props object (every field optional)', () => {
      const props: AuditNoteEditorProps = {};
      expect(props).toEqual({});
    });

    it('accepts a controlled value/onChange pair and character limits', () => {
      const props: AuditNoteEditorProps = {
        value: 'note',
        onChange: () => undefined,
        minChars: 0,
        maxChars: 500,
        className: 'custom-class',
      };

      expect(props.minChars).toBe(0);
      expect(props.maxChars).toBe(500);
    });

    it('accepts an explicit empty templates array as a boundary value', () => {
      const props: AuditNoteEditorProps = { templates: [] };
      expect(props.templates).toEqual([]);
    });

    it('accepts a caller-supplied template list', () => {
      const custom: NoteTemplate[] = [
        { id: 'custom', label: 'Custom', content: 'Custom note: ' },
      ];
      const props: AuditNoteEditorProps = { templates: custom };

      expect(props.templates).toBe(custom);
    });
  });
});
