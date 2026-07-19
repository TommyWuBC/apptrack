/**
 * Field-level corrections overlay. AGENTS.md §18.2 / INV-7
 * Precedence: user-locked > user-corrected > machine.
 */
export type UserCorrection = {
  id?: string;
  field: string;
  machineValue?: unknown;
  userValue: unknown;
  locked: boolean;
  revertedAt?: Date | null;
  createdAt?: Date;
};

export type ProjectionFields = {
  currentState: string;
  actionRequired: boolean;
  [key: string]: unknown;
};

/**
 * Active = not reverted. For each field, the latest (by createdAt) wins.
 * Undo sets revertedAt on one row; earlier corrections remain eligible.
 */
export function activeCorrections(corrections: UserCorrection[]): UserCorrection[] {
  const alive = corrections.filter((c) => !c.revertedAt);
  const byField = new Map<string, UserCorrection>();
  const sorted = [...alive].sort((a, b) => {
    const ta = a.createdAt?.getTime?.() ?? 0;
    const tb = b.createdAt?.getTime?.() ?? 0;
    return ta - tb;
  });
  for (const c of sorted) {
    byField.set(c.field, c);
  }
  return [...byField.values()];
}

/**
 * Overlay active user corrections onto machine projection.
 * Locked and corrected fields always win (INV-7).
 * // AGENTS.md §18.2
 */
export function applyCorrections(
  machine: ProjectionFields,
  corrections: UserCorrection[],
): ProjectionFields {
  const out: ProjectionFields = { ...machine };
  for (const c of activeCorrections(corrections)) {
    out[c.field] = c.userValue;
  }
  return out;
}

/**
 * True when a field is locked by an active correction — automation must not
 * write it (INV-7).
 */
export function isFieldLocked(corrections: UserCorrection[], field: string): boolean {
  return activeCorrections(corrections).some((c) => c.field === field && c.locked);
}
