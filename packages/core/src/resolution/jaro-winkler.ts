/**
 * Jaro-Winkler similarity in [0, 1]. AGENTS.md §14.4
 * Pure implementation — no external dependency (R-6).
 */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const matchDistance = Math.max(
    0,
    Math.floor(Math.max(s1.length, s2.length) / 2) - 1,
  );

  const s1Matches = new Array<boolean>(s1.length).fill(false);
  const s2Matches = new Array<boolean>(s2.length).fill(false);

  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;

  const s1Matched: string[] = [];
  const s2Matched: string[] = [];
  for (let i = 0; i < s1.length; i++) {
    if (s1Matches[i]) s1Matched.push(s1[i]!);
  }
  for (let j = 0; j < s2.length; j++) {
    if (s2Matches[j]) s2Matched.push(s2[j]!);
  }

  let transpositions = 0;
  for (let i = 0; i < s1Matched.length; i++) {
    if (s1Matched[i] !== s2Matched[i]) transpositions += 1;
  }

  const jaro =
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix += 1;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}
