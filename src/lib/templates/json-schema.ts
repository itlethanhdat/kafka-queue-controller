import { generate } from "json-schema-faker";
import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true });

/**
 * Generate a random object that conforms to the given JSON Schema string.
 * Returns a Promise (json-schema-faker v1 is async).
 */
export async function generateFromSchema(schemaJson: string): Promise<unknown> {
  const schema = JSON.parse(schemaJson);
  return generate(schema);
}

/**
 * Validate a JSON value (as string) against the given JSON Schema string.
 * Returns { valid: true } or { valid: false, errors: string[] }
 */
export function validateAgainstSchema(
  schemaJson: string,
  valueJson: string
): { valid: boolean; errors?: string[] } {
  const schema = JSON.parse(schemaJson);
  const value = JSON.parse(valueJson);
  const validate = ajv.compile(schema);
  const valid = validate(value) as boolean;
  if (valid) return { valid: true };
  return {
    valid: false,
    errors: validate.errors?.map((e) => `${e.instancePath} ${e.message}`) ?? [],
  };
}
