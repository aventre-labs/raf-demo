export interface BenchmarkProblem {
  id: string;
  question: string;
  expectedAnswer: number | string;
  category: string;
}

export interface BenchmarkCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  problems: BenchmarkProblem[];
}

export const benchmarkCategories: BenchmarkCategory[] = [
  {
    id: 'gsm8k',
    name: 'GSM8K',
    description: 'Grade school math word problems requiring multi-step reasoning',
    icon: '🧮',
    color: '#3b82f6',
    problems: [
      { id: 'gsm1', category: 'gsm8k', question: "Janet's ducks lay 16 eggs per day. She eats three for breakfast every morning and bakes muffins for her friends every day with four. She sells every duck egg at the farmers' market daily for $2 each. How much in dollars does she make every day at the farmers' market?", expectedAnswer: 18 },
      { id: 'gsm2', category: 'gsm8k', question: "A robe takes 2 bolts of blue fiber and half that much white fiber. How many bolts in total does it take?", expectedAnswer: 3 },
      { id: 'gsm3', category: 'gsm8k', question: "Josh decides to try flipping a house. He buys a house for $80,000 and then puts in $50,000 in repairs. This increased the value of the house by 150%. How much profit did he make?", expectedAnswer: 70000 },
      { id: 'gsm4', category: 'gsm8k', question: "James writes a 3-page letter to 2 different friends twice a week. How many pages does he write a year?", expectedAnswer: 624 },
      { id: 'gsm5', category: 'gsm8k', question: "Every day, Wendi feeds each of her chickens three cups of mixed chicken feed, containing seeds, mealworms and vegetables to help keep them healthy. She gives the chickens their feed in three separate meals. In the morning, she gives her flock of chickens 15 cups of feed. In the afternoon, she gives her chickens another 25 cups of feed. If the final meal of the day uses 2 cups less feed than morning feed, how many chickens does Wendi have?", expectedAnswer: 20 },
      { id: 'gsm6', category: 'gsm8k', question: "Toulouse has twice as many sheep as Charleston. Charleston has 4 times as many sheep as Seattle. How many sheep do Toulouse, Charleston, and Seattle have together if Seattle has 20 sheep?", expectedAnswer: 260 },
      { id: 'gsm7', category: 'gsm8k', question: "Carla is downloading a 200 GB file. She normally downloads 2 GB/minute, but 40% of the way through the download, Windows forces a restart to install updates, which takes 20 minutes. Then she can only download at half her normal speed. How many minutes does it take to download the file?", expectedAnswer: 160 },
      { id: 'gsm8', category: 'gsm8k', question: "John drives for 3 hours at a speed of 60 mph and then turns around because he realizes he forgot something very important at home. He tries to get home in 4 hours but spends the first 2 hours in standstill traffic. He spends the rest of the time going at 30 mph. How far is he from home?", expectedAnswer: 120 },
      { id: 'gsm9', category: 'gsm8k', question: "Eliza's rate per hour for the first 40 hours she works each week is $10. She also receives an overtime pay of 1.2 times her regular hourly rate. If Eliza worked for 45 hours this week, how much are her earnings for this week?", expectedAnswer: 460 },
      { id: 'gsm10', category: 'gsm8k', question: "A merchant wants to make a choice of purchase between 2 purchase plans: jewelry worth $5,000 or electronic gadgets worth $8,000. His financial advisor advises him to invest 5/8 of his savings in jewelry and the rest in gadgets. If the merchant's savings is $16,000, how much will he save if he follows his adviser's recommendations?", expectedAnswer: 3000 },
      { id: 'gsm11', category: 'gsm8k', question: "Betty is saving money for a new wallet which costs $100. Betty has only half of the money she needs. Her parents decided to give her $15 for that purpose, and her grandparents twice as much as her parents. How much more money does Betty need to buy the wallet?", expectedAnswer: 5 },
      { id: 'gsm12', category: 'gsm8k', question: "Julie is reading a 120-page book. Yesterday, she was able to read 12 pages and today, she read twice as many pages as yesterday. If she wants to read half of the remaining pages tomorrow, how many pages should she read?", expectedAnswer: 42 },
      { id: 'gsm13', category: 'gsm8k', question: "Mark has a garden with flowers. He planted plants of three colors in it. Ten of them are yellow, and there are 80% more of those in purple. There are only 25% as many green flowers as there are yellow and purple flowers. How many flowers does Mark have in his garden?", expectedAnswer: 35 },
      { id: 'gsm14', category: 'gsm8k', question: "Albert is wondering how much pizza he can eat in one day. He buys 2 large pizzas and 2 small pizzas. A large pizza has 16 slices and a small pizza has 8 slices. If he eats it all, how many pieces does he eat that day?", expectedAnswer: 48 },
      { id: 'gsm15', category: 'gsm8k', question: "Ken created a care package to send to his brother, who lives 100 miles away. Ken placed a box on a scale, and the box weighed 2 pounds. He packed 8 cans of beans, each weighing 2 ounces, and 3 bottles of water weighing 12 ounces each. Then, he packed 4 bags of chips weighing 3 ounces each. What is the weight of the care package, in ounces?", expectedAnswer: 96 },
    ],
  },
  {
    id: 'logic',
    name: 'Logic Puzzles',
    description: 'Classic cognitive biases and lateral thinking challenges',
    icon: '🧩',
    color: '#8b5cf6',
    problems: [
      { id: 'logic1', category: 'logic', question: "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?", expectedAnswer: "$0.05" },
      { id: 'logic2', category: 'logic', question: "If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?", expectedAnswer: "5 minutes" },
      { id: 'logic3', category: 'logic', question: "In a lake, there is a patch of lily pads. Every day, the patch doubles in size. If it takes 48 days for the patch to cover the entire lake, how long would it take for the patch to cover half of the lake?", expectedAnswer: "47 days" },
      { id: 'logic4', category: 'logic', question: "A farmer has 17 sheep. All but 9 die. How many sheep does the farmer have left?", expectedAnswer: "9" },
      { id: 'logic5', category: 'logic', question: "If you have a bowl with six apples and you take away four, how many do you have?", expectedAnswer: "4" },
      { id: 'logic6', category: 'logic', question: "A doctor gives you 3 pills and tells you to take one every half hour. How many minutes will the pills last?", expectedAnswer: "60 minutes" },
      { id: 'logic7', category: 'logic', question: "How many times can you subtract 5 from 25?", expectedAnswer: "Once (then it's 20, not 25)" },
      { id: 'logic8', category: 'logic', question: "If there are 3 apples and you take away 2, how many apples do you have?", expectedAnswer: "2 (the ones you took)" },
    ],
  },
  {
    id: 'hanoi',
    name: 'Tower of Hanoi',
    description: 'Classic recursive puzzle testing structured planning',
    icon: '🗼',
    color: '#f97316',
    problems: [
      { id: 'hanoi1', category: 'hanoi', question: "Solve Tower of Hanoi with 3 disks. Show each move as 'Move disk X from peg A to peg C'.", expectedAnswer: "7 moves" },
      { id: 'hanoi2', category: 'hanoi', question: "Solve Tower of Hanoi with 4 disks.", expectedAnswer: "15 moves" },
      { id: 'hanoi3', category: 'hanoi', question: "Solve Tower of Hanoi with 5 disks.", expectedAnswer: "31 moves" },
    ],
  },
  {
    id: 'humaneval',
    name: 'HumanEval',
    description: 'Python coding problems from OpenAI HumanEval benchmark',
    icon: '💻',
    color: '#10b981',
    problems: [
      { id: 'he1', category: 'humaneval', question: "Write a Python function has_close_elements(numbers, threshold) that checks if any two numbers in the list are closer than the given threshold.", expectedAnswer: "code" },
      { id: 'he2', category: 'humaneval', question: "Write a Python function separate_paren_groups(paren_string) that separates groups of nested parentheses into separate strings.", expectedAnswer: "code" },
      { id: 'he3', category: 'humaneval', question: "Write a Python function truncate_number(number) that returns the decimal part of a positive floating point number.", expectedAnswer: "code" },
      { id: 'he4', category: 'humaneval', question: "Write a Python function below_zero(operations) that checks if a bank account balance goes below zero given a list of deposit/withdrawal operations.", expectedAnswer: "code" },
      { id: 'he5', category: 'humaneval', question: "Write a Python function mean_absolute_deviation(numbers) that computes the Mean Absolute Deviation around the mean of a list.", expectedAnswer: "code" },
    ],
  },
  {
    id: 'multiplication',
    name: 'Multi-digit Math',
    description: 'Large multiplication problems requiring precise arithmetic',
    icon: '✖️',
    color: '#f59e0b',
    problems: [
      { id: 'mul1', category: 'multiplication', question: "123 × 456", expectedAnswer: 56088 },
      { id: 'mul2', category: 'multiplication', question: "789 × 234", expectedAnswer: 184626 },
      { id: 'mul3', category: 'multiplication', question: "1234 × 5678", expectedAnswer: 7006652 },
      { id: 'mul4', category: 'multiplication', question: "9876 × 5432", expectedAnswer: 53645232 },
      { id: 'mul5', category: 'multiplication', question: "12345 × 67890", expectedAnswer: 838102050 },
      { id: 'mul6', category: 'multiplication', question: "98765 × 43210", expectedAnswer: 4267024650 },
    ],
  },
  {
    id: 'competition',
    name: 'Competition Math',
    description: 'AMC-style problems requiring deeper mathematical insight',
    icon: '🏆',
    color: '#f43f5e',
    problems: [
      { id: 'comp1', category: 'competition', question: "What is the sum of all positive integers less than 100 that are divisible by 3 or 5?", expectedAnswer: 2318 },
      { id: 'comp2', category: 'competition', question: "If the sum of the first n positive integers is 210, what is n?", expectedAnswer: 20 },
      { id: 'comp3', category: 'competition', question: "How many perfect squares are there between 1 and 1000?", expectedAnswer: 31 },
      { id: 'comp4', category: 'competition', question: "What is the remainder when 2^100 is divided by 7?", expectedAnswer: 2 },
      { id: 'comp5', category: 'competition', question: "If log_2(x) + log_2(x-2) = 3, what is x?", expectedAnswer: 4 },
    ],
  },
];
