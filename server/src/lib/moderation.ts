export async function moderateText(input: string): Promise<{ flagged: boolean; reason?: string }> {
  const text = input.trim().toLowerCase();

  // רשימת מילים חסומות לדוגמה (אפשר להרחיב או לחבר ל-API של AI)
  const blocked = [
    'terror',
    'explosive',
    'child abuse',
    'nazi'
  ];

  for (const term of blocked) {
    if (text.includes(term)) {
      return { flagged: true, reason: `Matched blocked term: ${term}` };
    }
  }

  return { flagged: false };
}
