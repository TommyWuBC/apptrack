/**
 * Field-level corrections overlay. AGENTS.md §18.2 / INV-7
 * M9 ships a stub: machine projection in, corrections list in, overlay out.
 * Full lock/precedence UX lands in M11.
 */
export type UserCorrection = {
  field: string;
  userValue: unknown;
  locked: boolean;
  revertedAt?: Date | null;
};

export type ProjectionFields = {
  currentState: string;
  actionRequired: boolean;
  [key: string]: unknown;
};

/**
 * Overlay active (non-reverted) user corrections onto machine projection.
 * Locked/corrected fields win over automation (INV-7).
 * // AGENTS.md §18.2
 */
export function applyCorrections(
  machine: ProjectionFields,
  corrections: UserCorrection[],
): ProjectionFields {
  const out: ProjectionFields = { ...machine };
  for (const c of corrections) {
    if (c.revertedAt) continue;
    if (c.field in out || c.locked) {
      out[c.field] = c.userValue;
    }
  }
  return out;
}
