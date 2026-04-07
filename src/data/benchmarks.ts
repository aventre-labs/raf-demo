export interface Problem { id: string; category: string; q: string; expected: string }

export const PROBLEMS: Problem[] = [
  { id: 'gsm1', category: 'GSM8K', q: "Janet's ducks lay 16 eggs/day. She eats 3, bakes muffins with 4, sells the rest at $2 each. Daily earnings?", expected: '$18' },
  { id: 'gsm2', category: 'GSM8K', q: "A robe takes 2 bolts of blue fiber and half as much white fiber. How many bolts total?", expected: '3' },
  { id: 'gsm3', category: 'GSM8K', q: "Josh buys a house for $80,000, spends $50,000 on repairs, value increases 150%. What is his profit?", expected: '$70,000' },
  { id: 'gsm4', category: 'GSM8K', q: "James writes a 3-page letter to 2 friends twice a week. Pages per year?", expected: '624' },
  { id: 'gsm5', category: 'GSM8K', q: "Eliza earns $10/hr for first 40hrs, 1.2× overtime. She worked 45 hours. Total earnings?", expected: '$460' },
  { id: 'logic1', category: 'Logic', q: "Bat + ball = $1.10. Bat costs $1.00 more than ball. Ball costs?", expected: '$0.05' },
  { id: 'logic2', category: 'Logic', q: "5 machines make 5 widgets in 5 minutes. 100 machines to make 100 widgets?", expected: '5 min' },
  { id: 'logic3', category: 'Logic', q: "Lily pads double daily. 48 days = full lake. Half-lake day?", expected: '47' },
  { id: 'comp1', category: 'Math', q: "Sum of integers < 100 divisible by 3 or 5?", expected: '2318' },
  { id: 'comp2', category: 'Math', q: "Remainder when 2^100 is divided by 7?", expected: '2' },
  { id: 'comp3', category: 'Math', q: "Perfect squares between 1 and 1000?", expected: '31' },
  { id: 'hanoi3', category: 'Hanoi', q: "Minimum moves to solve Tower of Hanoi with 3 disks?", expected: '7' },
  { id: 'hanoi4', category: 'Hanoi', q: "Minimum moves to solve Tower of Hanoi with 4 disks?", expected: '15' },
  { id: 'mul1', category: 'Arithmetic', q: "What is 123 × 456?", expected: '56088' },
  { id: 'mul2', category: 'Arithmetic', q: "What is 789 × 234?", expected: '184626' },
  { id: 'mul3', category: 'Arithmetic', q: "What is 1234 × 5678?", expected: '7006652' },
];

export const CATEGORIES = [...new Set(PROBLEMS.map(p => p.category))];
