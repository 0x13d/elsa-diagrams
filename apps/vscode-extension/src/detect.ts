/**
 * Fast structural check: is this JSON text *probably* an Elsa workflow?
 * We parse and look for the same shape signals the Rust detector uses.
 * Returns one of 'v2' | 'v3' | null.
 */
export function detectElsaWorkflow(jsonText: string): 'v2' | 'v3' | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // V3: root is an object with an activities array
  const root = obj.root;
  if (
    typeof root === 'object' &&
    root !== null &&
    Array.isArray((root as Record<string, unknown>).activities)
  ) {
    return 'v3';
  }

  // V2: top-level activities array whose first element has activityId
  if (Array.isArray(obj.activities) && obj.activities.length > 0) {
    const first = obj.activities[0];
    if (typeof first === 'object' && first !== null && 'activityId' in first) {
      return 'v2';
    }
  }
  return null;
}
