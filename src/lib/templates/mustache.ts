import Mustache from "mustache";
import { faker } from "@faker-js/faker";

/** Variable mapping: varName → faker path like "person.fullName" */
export type VariableMap = Record<string, string>;

/**
 * Build a view object by resolving each variable mapping to a faker call.
 * e.g. { name: "person.fullName" } → { name: "John Doe" }
 */
function buildView(variables: VariableMap): Record<string, unknown> {
  const view: Record<string, unknown> = {};
  for (const [key, fakerPath] of Object.entries(variables)) {
    try {
      // Navigate faker object by dot-path
      const parts = fakerPath.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fn: any = faker;
      for (const part of parts) {
        fn = fn?.[part];
      }
      view[key] = typeof fn === "function" ? fn() : fakerPath;
    } catch {
      view[key] = fakerPath;
    }
  }
  return view;
}

/**
 * Render a Mustache template with auto-generated faker values.
 */
export function generateFromMustache(template: string, variables: VariableMap): string {
  const view = buildView(variables);
  return Mustache.render(template, view);
}

/**
 * Verify a message value against a Mustache template by checking that all
 * literal (non-variable) segments appear in the rendered string.
 * Returns { valid: boolean, message: string }
 */
export function validateAgainstMustache(
  template: string,
  value: string
): { valid: boolean; message: string } {
  // Extract literal segments between {{ }} tags
  const literals = template.split(/\{\{[^}]+\}\}/).map((s) => s.trim()).filter(Boolean);

  for (const literal of literals) {
    if (!value.includes(literal)) {
      return {
        valid: false,
        message: `Value is missing expected literal: "${literal}"`,
      };
    }
  }
  return { valid: true, message: "Message matches template structure" };
}
