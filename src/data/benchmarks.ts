export interface Problem {
  id: string;
  category: string;
  benchmark: string;  // e.g. "SWE-bench Verified", "GSM8K", etc.
  q: string;
  expected: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

// ─────────────────────────────────────────────────────────────────────────────
// SWE-bench Verified (software engineering — bug fixing in real GitHub repos)
// Problems are framed as: understand the bug, identify the fix, write the patch.
// ─────────────────────────────────────────────────────────────────────────────
const SWEBENCH: Problem[] = [
  {
    id: 'swe-1', category: 'SWE-bench', benchmark: 'SWE-bench Verified',
    difficulty: 'medium',
    q: `Django ORM bug: The following query incorrectly excludes results when using Q objects with OR conditions across related models.

\`\`\`python
# models.py
class Article(models.Model):
    title = models.CharField(max_length=200)
    author = models.ForeignKey(User, on_delete=models.CASCADE)

# Bug: this should return articles where title contains 'test' OR author username is 'admin'
# but it returns an empty queryset
articles = Article.objects.filter(
    Q(title__icontains='test') | Q(author__username='admin')
).distinct()
\`\`\`

The issue is that when the queryset is further annotated and filtered, the OR condition collapses. Identify the bug and provide the corrected query.`,
    expected: 'Use .filter() with Q objects correctly; ensure distinct() is applied after annotation, not before; the fix involves reordering filter/annotate operations',
  },
  {
    id: 'swe-2', category: 'SWE-bench', benchmark: 'SWE-bench Verified',
    difficulty: 'hard',
    q: `Flask routing bug: The following code raises a BuildError when url_for() is called inside a Blueprint, even though the endpoint exists.

\`\`\`python
# blueprint.py
bp = Blueprint('api', __name__, url_prefix='/api')

@bp.route('/users/<int:user_id>')
def get_user(user_id):
    return jsonify({'id': user_id})

# In a template or another view:
url = url_for('get_user', user_id=1)  # Raises: werkzeug.routing.BuildError
\`\`\`

Explain the bug and provide the exact fix needed.`,
    expected: "url_for must use blueprint name prefix: url_for('api.get_user', user_id=1) — the endpoint name in a blueprint is 'blueprint_name.function_name'",
  },
  {
    id: 'swe-3', category: 'SWE-bench', benchmark: 'SWE-bench Verified',
    difficulty: 'medium',
    q: `Python requests library bug: The following code causes a RecursionError when following redirects to HTTPS URLs.

\`\`\`python
import requests

session = requests.Session()
session.max_redirects = 30

# This triggers RecursionError after a few redirects
response = session.get('http://example.com/redirect-chain', allow_redirects=True)
\`\`\`

The bug is in how the session handles redirect resolution when the scheme changes from HTTP to HTTPS. Identify the root cause and write the fix.`,
    expected: "The bug is that redirect handling doesn't properly reset the connection pool when scheme changes; fix by checking if scheme changed in resolve_redirects() and creating a new connection",
  },
  {
    id: 'swe-4', category: 'SWE-bench', benchmark: 'SWE-bench Verified',
    difficulty: 'hard',
    q: `NumPy indexing bug: The following code produces incorrect results when using advanced integer indexing with negative indices alongside boolean masks.

\`\`\`python
import numpy as np

arr = np.array([10, 20, 30, 40, 50])
indices = np.array([-1, -2, 0])  # should select [50, 40, 10]
mask = np.array([True, False, True])

# Expected: arr[indices[mask]] = [50, 10]
# Got: IndexError or wrong values
result = arr[indices[mask]]
\`\`\`

Identify the issue with negative index handling in boolean-masked integer arrays and write the correct implementation.`,
    expected: "Negative indices in integer arrays are valid in NumPy; the fix is to normalize negative indices before masking: indices = indices % len(arr), then apply mask. Result should be arr[np.array([4, 0])] = [50, 10]",
  },
  {
    id: 'swe-5', category: 'SWE-bench', benchmark: 'SWE-bench Verified',
    difficulty: 'medium',
    q: `SQLAlchemy ORM bug: The following relationship definition causes a circular import error and incorrect backref behavior.

\`\`\`python
# user.py
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    posts = relationship('Post', backref='author', lazy='dynamic')

# post.py  
class Post(Base):
    __tablename__ = 'posts'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    # Also trying to define the reverse:
    author = relationship('User', backref='posts')  # ERROR: backref 'posts' conflicts
\`\`\`

Fix the relationship definitions to avoid the conflict.`,
    expected: "Remove the duplicate backref — only define relationship in one place. Either remove 'author = relationship' from Post, or remove backref='author' from User.posts. Use back_populates instead of backref for explicit two-way: posts=relationship('Post', back_populates='author')",
  },
  {
    id: 'swe-6', category: 'SWE-bench', benchmark: 'SWE-bench Verified',
    difficulty: 'hard',
    q: `Pandas bug: The following code produces a SettingWithCopyWarning and fails to actually modify the DataFrame.

\`\`\`python
import pandas as pd

df = pd.DataFrame({'A': [1, 2, 3, 4, 5], 'B': ['x', 'y', 'x', 'y', 'x']})

# Attempting to double values in column A where B == 'x'
filtered = df[df['B'] == 'x']
filtered['A'] = filtered['A'] * 2  # SettingWithCopyWarning — doesn't work

print(df)  # df is unchanged!
\`\`\`

Explain why this fails and provide three different correct approaches.`,
    expected: "filtered is a view/copy; fixes: (1) df.loc[df['B']=='x','A'] *= 2, (2) use .copy() then merge back, (3) df['A'] = df.apply(lambda r: r['A']*2 if r['B']=='x' else r['A'], axis=1). Method 1 is canonical.",
  },
  {
    id: 'swe-7', category: 'SWE-bench', benchmark: 'SWE-bench Verified',
    difficulty: 'medium',
    q: `FastAPI dependency injection bug: The following code causes a 422 Unprocessable Entity error even with valid input.

\`\`\`python
from fastapi import FastAPI, Depends
from pydantic import BaseModel

app = FastAPI()

class UserCreate(BaseModel):
    username: str
    email: str

def get_current_user(token: str):
    return {"user": token}

@app.post("/users/")
async def create_user(
    user: UserCreate,
    current_user: dict = Depends(get_current_user)
):
    return {"user": user, "by": current_user}
\`\`\`

The dependency get_current_user expects a token but FastAPI doesn't know where to get it from. Fix the dependency to properly extract from the Authorization header.`,
    expected: "Import Header from fastapi; change get_current_user signature to: def get_current_user(authorization: str = Header(None)): — or use OAuth2PasswordBearer for proper JWT auth",
  },
  {
    id: 'swe-8', category: 'SWE-bench', benchmark: 'SWE-bench Verified',
    difficulty: 'hard',
    q: `Python asyncio bug: The following code randomly hangs and never completes, but only when run under high load.

\`\`\`python
import asyncio

async def fetch_data(session, url):
    async with session.get(url) as response:
        return await response.json()

async def process_all(urls):
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_data(session, url) for url in urls]
        results = await asyncio.gather(*tasks)
    return results

# Called with 1000 URLs — hangs randomly
asyncio.run(process_all(large_url_list))
\`\`\`

Identify the race condition or resource exhaustion cause and fix it.`,
    expected: "The issue is too many simultaneous connections exhausting the connection pool or hitting OS file descriptor limits. Fix with a semaphore: sem = asyncio.Semaphore(50); async with sem: before each request. Also add connector=aiohttp.TCPConnector(limit=100) to ClientSession.",
  },
  {
    id: 'swe-9', category: 'SWE-bench', benchmark: 'SWE-bench Verified',
    difficulty: 'medium',
    q: `Pytest fixture bug: The following test unexpectedly passes when it should fail due to a scoping issue.

\`\`\`python
# conftest.py
@pytest.fixture(scope='module')
def database():
    db = create_test_db()
    yield db
    db.cleanup()

# test_users.py
def test_create_user(database):
    user = database.create_user('alice')
    assert user.id is not None

def test_user_count(database):
    # This should fail because alice was already created, but passes
    assert database.count_users() == 0
\`\`\`

Explain the scope bug and fix it.`,
    expected: "module scope means the DB is shared across all tests in the module, so alice persists. Fix: change scope to 'function' so DB resets per test, OR use database.rollback() in a function-scoped autouse fixture",
  },
  {
    id: 'swe-10', category: 'SWE-bench', benchmark: 'SWE-bench Verified',
    difficulty: 'hard',
    q: `TypeScript/Node.js memory leak: The following Express server slowly runs out of memory under load.

\`\`\`typescript
const cache = new Map<string, any>();

app.get('/data/:key', async (req, res) => {
    const { key } = req.params;
    
    if (!cache.has(key)) {
        const data = await fetchFromDatabase(key);
        cache.set(key, {
            data,
            timestamp: Date.now(),
            listeners: new Set()
        });
    }
    
    const entry = cache.get(key)!;
    entry.listeners.add(res);  // Never cleaned up!
    res.json(entry.data);
});
\`\`\`

Identify all memory leak sources and provide the complete fix.`,
    expected: "Two leaks: (1) cache grows unboundedly — fix with LRU cache or TTL eviction; (2) response objects added to listeners Set are never removed — fix by deleting after use or using WeakRef. Also add res.on('close', () => entry.listeners.delete(res))",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GSM8K — Grade School Math (8.5K problems, tests multi-step arithmetic reasoning)
// ─────────────────────────────────────────────────────────────────────────────
const GSM8K: Problem[] = [
  { id: 'gsm-1', category: 'GSM8K', benchmark: 'GSM8K', difficulty: 'easy',
    q: "Janet's ducks lay 16 eggs per day. She eats 3 for breakfast every morning and bakes muffins for her friends every day with 4. She sells the remainder at the farmers market daily for $2 per duck egg. How much in dollars does she make every day at the farmers market?",
    expected: '18' },
  { id: 'gsm-2', category: 'GSM8K', benchmark: 'GSM8K', difficulty: 'easy',
    q: 'A robe takes 2 bolts of blue fiber and half that much white fiber. How many bolts in total does it take?',
    expected: '3' },
  { id: 'gsm-3', category: 'GSM8K', benchmark: 'GSM8K', difficulty: 'medium',
    q: 'Josh decides to try flipping a house. He buys a house for $80,000 and then puts in $50,000 in repairs. This increased the value of the house by 150%. How much profit did he make?',
    expected: '70000' },
  { id: 'gsm-4', category: 'GSM8K', benchmark: 'GSM8K', difficulty: 'easy',
    q: 'James writes a 3-page letter to 2 different friends twice a week. How many pages does he write a year?',
    expected: '624' },
  { id: 'gsm-5', category: 'GSM8K', benchmark: 'GSM8K', difficulty: 'medium',
    q: "Eliza's rate per hour for the first 40 hours she works each week is $10. She also receives an overtime pay of 1.2 times her regular hourly rate. If Eliza worked for 45 hours this week, what are her total earnings for the week?",
    expected: '460' },
  { id: 'gsm-6', category: 'GSM8K', benchmark: 'GSM8K', difficulty: 'medium',
    q: 'Toulouse has twice as many sheep as Charleston. Charleston has 4 times as many sheep as Seattle. How many sheep do Toulouse, Charleston, and Seattle have together if Seattle has 20 sheep?',
    expected: '260' },
  { id: 'gsm-7', category: 'GSM8K', benchmark: 'GSM8K', difficulty: 'hard',
    q: 'Carla is downloading a 200 GB file. She can normally download at 2 GB/minute, but halfway through the download, Windows forces a restart that takes 20 minutes. After restarting she can only download at half her normal speed. How many minutes does it take to download the file?',
    expected: '160' },
  { id: 'gsm-8', category: 'GSM8K', benchmark: 'GSM8K', difficulty: 'hard',
    q: "Betty is saving money for a new wallet which costs $100. Betty has only half of the money she needs. Her parents decided to give her $15 for that purpose, and her grandparents twice as much as her parents. How much more money does Betty need to buy the wallet?",
    expected: '5' },
  { id: 'gsm-9', category: 'GSM8K', benchmark: 'GSM8K', difficulty: 'medium',
    q: "Julie is reading a 120-page book. Yesterday, she was able to read 12 pages and today, she read twice as many pages as yesterday. If she wants to read half of the remaining pages tomorrow, how many pages should she read tomorrow?",
    expected: '42' },
  { id: 'gsm-10', category: 'GSM8K', benchmark: 'GSM8K', difficulty: 'hard',
    q: "A store sells pencils at 25 cents each, erasers at 15 cents each, and rulers at 30 cents each. A class of 30 students each needs 2 pencils, 1 eraser, and 1 ruler. If the teacher has $30 to spend, how much money will be left over after buying all the supplies?",
    expected: '1.50' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MATH (Hendrycks et al.) — competition math, 12K problems across 7 subjects
// ─────────────────────────────────────────────────────────────────────────────
const MATH: Problem[] = [
  { id: 'math-1', category: 'MATH', benchmark: 'MATH Dataset', difficulty: 'medium',
    q: 'What is the sum of all positive integers less than 100 that are divisible by 3 or 5?',
    expected: '2318' },
  { id: 'math-2', category: 'MATH', benchmark: 'MATH Dataset', difficulty: 'medium',
    q: 'What is the remainder when 2^100 is divided by 7?',
    expected: '2' },
  { id: 'math-3', category: 'MATH', benchmark: 'MATH Dataset', difficulty: 'easy',
    q: 'How many perfect squares are there between 1 and 1000 (inclusive)?',
    expected: '31' },
  { id: 'math-4', category: 'MATH', benchmark: 'MATH Dataset', difficulty: 'hard',
    q: 'Find the number of positive integer solutions to x + y + z = 10.',
    expected: '36' },
  { id: 'math-5', category: 'MATH', benchmark: 'MATH Dataset', difficulty: 'hard',
    q: 'A bag contains 4 red balls and 6 blue balls. If 3 balls are drawn without replacement, what is the probability that exactly 2 are red?',
    expected: '3/10' },
  { id: 'math-6', category: 'MATH', benchmark: 'MATH Dataset', difficulty: 'hard',
    q: 'If the sum of the first n positive integers equals 210, find n.',
    expected: '20' },
  { id: 'math-7', category: 'MATH', benchmark: 'MATH Dataset', difficulty: 'hard',
    q: 'Find all integer solutions to: x² - 5x + 6 = 0.',
    expected: 'x = 2 or x = 3' },
  { id: 'math-8', category: 'MATH', benchmark: 'MATH Dataset', difficulty: 'hard',
    q: 'A geometric sequence has first term 3 and common ratio 2. What is the sum of the first 8 terms?',
    expected: '765' },
  { id: 'math-9', category: 'MATH', benchmark: 'MATH Dataset', difficulty: 'hard',
    q: 'If log₂(x) + log₂(x - 2) = 3, find x.',
    expected: '4' },
  { id: 'math-10', category: 'MATH', benchmark: 'MATH Dataset', difficulty: 'hard',
    q: 'How many ways can 6 people be arranged in a circle? (Rotations are considered the same.)',
    expected: '120' },
];

// ─────────────────────────────────────────────────────────────────────────────
// HumanEval — code generation from docstring (164 problems, Python)
// ─────────────────────────────────────────────────────────────────────────────
const HUMANEVAL: Problem[] = [
  { id: 'he-1', category: 'HumanEval', benchmark: 'HumanEval', difficulty: 'easy',
    q: `Write a Python function \`has_close_elements(numbers: List[float], threshold: float) -> bool\` that checks if any two numbers in the input list are closer to each other than the given threshold.

Example: has_close_elements([1.0, 2.0, 3.0], 0.5) → False
         has_close_elements([1.0, 2.8, 3.0, 4.0, 5.0, 2.0], 0.3) → True`,
    expected: 'Check all pairs with nested loops or itertools.combinations; return True if abs(a-b) < threshold for any pair' },
  { id: 'he-2', category: 'HumanEval', benchmark: 'HumanEval', difficulty: 'easy',
    q: `Write a Python function \`separate_paren_groups(paren_string: str) -> List[str]\` that takes a string of multiple groups of nested parentheses and separates them into a list. Each group is a balanced set at the top level. Ignore spaces.

Example: separate_paren_groups('( ) (( )) (( )( ))') → ['()', '(())', '(()())']`,
    expected: 'Track depth counter; when depth returns to 0 after increment, end a group. Build current group string character by character.' },
  { id: 'he-3', category: 'HumanEval', benchmark: 'HumanEval', difficulty: 'easy',
    q: `Write a Python function \`truncate_number(number: float) -> float\` that given a positive float, decomposes it into integer and decimal parts and returns the decimal part.

Example: truncate_number(3.5) → 0.5`,
    expected: 'return number % 1.0  (or number - int(number))' },
  { id: 'he-4', category: 'HumanEval', benchmark: 'HumanEval', difficulty: 'medium',
    q: `Write a Python function \`below_zero(operations: List[int]) -> bool\` that given a list of deposit and withdrawal operations on a bank account starting with zero balance, return True if at any point the balance falls below zero.

Example: below_zero([1, 2, 3]) → False
         below_zero([1, 2, -4, 5]) → True`,
    expected: 'Maintain running balance; return True as soon as it goes negative. Use any() with cumulative sum or explicit loop.' },
  { id: 'he-5', category: 'HumanEval', benchmark: 'HumanEval', difficulty: 'medium',
    q: `Write a Python function \`mean_absolute_deviation(numbers: List[float]) -> float\` that calculates the Mean Absolute Deviation around the mean of a dataset.

MAD = mean(|x - mean(x)|) for all x in the dataset.

Example: mean_absolute_deviation([1.0, 2.0, 3.0, 4.0]) → 1.0`,
    expected: 'mean = sum(numbers)/len(numbers); return sum(abs(x - mean) for x in numbers) / len(numbers)' },
  { id: 'he-6', category: 'HumanEval', benchmark: 'HumanEval', difficulty: 'medium',
    q: `Write a Python function \`intersperse(numbers: List[int], delimeter: int) -> List[int]\` that inserts a delimeter between every two consecutive elements of the input list.

Example: intersperse([], 4) → []
         intersperse([1, 2, 3], 4) → [1, 4, 2, 4, 3]`,
    expected: "result = []; for i, n in enumerate(numbers): result.append(n); if i < len(numbers)-1: result.append(delimeter); return result" },
  { id: 'he-7', category: 'HumanEval', benchmark: 'HumanEval', difficulty: 'medium',
    q: `Write a Python function \`parse_nested_parens(paren_string: str) -> List[int]\` that returns the maximum depth of nesting for each top-level paren group in the string.

Example: parse_nested_parens('(()()) ((())) () ((())()())') → [2, 3, 1, 3]`,
    expected: 'For each top-level group, track max depth with a counter that increments on ( and decrements on ). Record max per group.' },
  { id: 'he-8', category: 'HumanEval', benchmark: 'HumanEval', difficulty: 'hard',
    q: `Write a Python function \`filter_by_substring(strings: List[str], substring: str) -> List[str]\` that filters an input list of strings to only include those containing a given substring.

Example: filter_by_substring([], 'a') → []
         filter_by_substring(['abc', 'bacd', 'cde', 'array'], 'a') → ['abc', 'bacd', 'array']`,
    expected: "return [s for s in strings if substring in s]" },
  { id: 'he-9', category: 'HumanEval', benchmark: 'HumanEval', difficulty: 'hard',
    q: `Write a Python function \`sum_product(numbers: List[int]) -> Tuple[int, int]\` that returns a tuple of the sum and product of all integers in a list. Empty list returns (0, 1).

Example: sum_product([]) → (0, 1)
         sum_product([1, 2, 3, 4]) → (10, 24)`,
    expected: "sum_val = sum(numbers); prod = 1; for n in numbers: prod *= n; return (sum_val, prod)" },
  { id: 'he-10', category: 'HumanEval', benchmark: 'HumanEval', difficulty: 'hard',
    q: `Write a Python function \`rolling_max(numbers: List[int]) -> List[int]\` that given a list of integers, generate a list of rolling maximum element found until the current index.

Example: rolling_max([1, 2, 3, 2, 3, 4, 2]) → [1, 2, 3, 3, 3, 4, 4]`,
    expected: "result = []; cur_max = float('-inf'); for n in numbers: cur_max = max(cur_max, n); result.append(cur_max); return result" },
];

// ─────────────────────────────────────────────────────────────────────────────
// MMLU — Massive Multitask Language Understanding (57 subjects, 14K questions)
// ─────────────────────────────────────────────────────────────────────────────
const MMLU: Problem[] = [
  { id: 'mmlu-1', category: 'MMLU', benchmark: 'MMLU', difficulty: 'medium',
    q: "In computer science, what is the time complexity of QuickSort in the average case?\nA) O(n) B) O(n log n) C) O(n²) D) O(log n)",
    expected: 'B) O(n log n)' },
  { id: 'mmlu-2', category: 'MMLU', benchmark: 'MMLU', difficulty: 'medium',
    q: "Which of the following is NOT a property of a relational database's ACID transactions?\nA) Atomicity B) Consistency C) Isolation D) Durability E) Availability",
    expected: 'E) Availability — ACID is Atomicity, Consistency, Isolation, Durability' },
  { id: 'mmlu-3', category: 'MMLU', benchmark: 'MMLU', difficulty: 'hard',
    q: "In machine learning, what problem does dropout regularization primarily address?\nA) Vanishing gradients B) Overfitting C) Underfitting D) Class imbalance",
    expected: 'B) Overfitting — dropout randomly deactivates neurons during training to prevent co-adaptation' },
  { id: 'mmlu-4', category: 'MMLU', benchmark: 'MMLU', difficulty: 'hard',
    q: "Which sorting algorithm has the best worst-case time complexity?\nA) QuickSort O(n²) B) MergeSort O(n log n) C) BubbleSort O(n²) D) InsertionSort O(n²)",
    expected: 'B) MergeSort — guaranteed O(n log n) in all cases' },
  { id: 'mmlu-5', category: 'MMLU', benchmark: 'MMLU', difficulty: 'medium',
    q: "In networking, what does TCP provide that UDP does not?\nA) Faster transmission B) Lower overhead C) Reliable ordered delivery D) Multicast support",
    expected: 'C) Reliable ordered delivery — TCP has acknowledgments, retransmission, and sequence numbers' },
  { id: 'mmlu-6', category: 'MMLU', benchmark: 'MMLU', difficulty: 'hard',
    q: "What is the primary advantage of a B-tree over a binary search tree for database indexing?\nA) Simpler implementation B) Lower memory usage C) Fewer disk reads due to high branching factor D) Faster sequential scans",
    expected: 'C) Fewer disk reads — B-trees have high branching factor minimizing tree height and disk I/O' },
  { id: 'mmlu-7', category: 'MMLU', benchmark: 'MMLU', difficulty: 'medium',
    q: "In cryptography, what is the main difference between symmetric and asymmetric encryption?\nA) Speed only B) Symmetric uses one key; asymmetric uses a public-private key pair C) Asymmetric is always more secure D) Symmetric requires certificates",
    expected: 'B) Symmetric uses one shared key; asymmetric uses mathematically linked key pair' },
  { id: 'mmlu-8', category: 'MMLU', benchmark: 'MMLU', difficulty: 'hard',
    q: "In operating systems, what is the difference between a process and a thread?\nA) No difference B) Processes share memory; threads have separate memory C) Threads share memory within a process; processes have isolated memory spaces D) Threads are slower than processes",
    expected: 'C) Threads within a process share memory space; separate processes have isolated virtual memory' },
  { id: 'mmlu-9', category: 'MMLU', benchmark: 'MMLU', difficulty: 'hard',
    q: "Which statement best describes the CAP theorem in distributed systems?\nA) A system can have all three: Consistency, Availability, Partition tolerance B) During a network partition, a system must choose between Consistency and Availability C) Availability always trumps Consistency D) Consistency is not achievable in distributed systems",
    expected: 'B) CAP theorem: during a network partition, must choose between Consistency and Availability' },
  { id: 'mmlu-10', category: 'MMLU', benchmark: 'MMLU', difficulty: 'hard',
    q: "In transformer neural network architectures (like GPT), what is the purpose of the attention mechanism?\nA) Reduce parameter count B) Allow the model to weigh the importance of different parts of the input when producing each output C) Speed up training D) Handle variable-length inputs by padding",
    expected: 'B) Attention allows each position to attend to all positions, learning contextual relationships across the full sequence' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ARC-Challenge — AI2 Reasoning Challenge (hard science questions, 4-choice)
// ─────────────────────────────────────────────────────────────────────────────
const ARC: Problem[] = [
  { id: 'arc-1', category: 'ARC-Challenge', benchmark: 'ARC-Challenge', difficulty: 'medium',
    q: "Which of the following best explains why the ocean appears blue?\nA) The ocean reflects the blue sky B) Water absorbs red wavelengths and scatters blue light C) Algae produce blue pigment D) Blue minerals dissolve in seawater",
    expected: 'B) Water molecules absorb longer red wavelengths and scatter shorter blue wavelengths' },
  { id: 'arc-2', category: 'ARC-Challenge', benchmark: 'ARC-Challenge', difficulty: 'hard',
    q: "A student drops a feather and a steel ball from the same height in a vacuum. Which hits the ground first?\nA) Steel ball B) Feather C) They hit at the same time D) Depends on the height",
    expected: 'C) They hit simultaneously — in a vacuum there is no air resistance, so gravity accelerates both equally' },
  { id: 'arc-3', category: 'ARC-Challenge', benchmark: 'ARC-Challenge', difficulty: 'hard',
    q: "Which process explains how plants convert light energy into chemical energy stored in glucose?\nA) Cellular respiration B) Fermentation C) Photosynthesis D) Transpiration",
    expected: 'C) Photosynthesis — 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂' },
  { id: 'arc-4', category: 'ARC-Challenge', benchmark: 'ARC-Challenge', difficulty: 'hard',
    q: "A car traveling at 60 mph applies brakes and stops in 4 seconds. What is the approximate deceleration?\nA) 6.7 m/s² B) 15 m/s² C) 60 m/s² D) 240 m/s²",
    expected: 'A) ~6.7 m/s² — 60 mph = 26.8 m/s; deceleration = 26.8/4 = 6.7 m/s²' },
  { id: 'arc-5', category: 'ARC-Challenge', benchmark: 'ARC-Challenge', difficulty: 'medium',
    q: "Which statement about DNA replication is correct?\nA) Only one strand of DNA serves as a template B) Both strands serve as templates, producing two double helices C) RNA replaces DNA during replication D) Replication occurs in the cytoplasm",
    expected: 'B) Semi-conservative replication — both strands serve as templates, each new helix contains one old and one new strand' },
  { id: 'arc-6', category: 'ARC-Challenge', benchmark: 'ARC-Challenge', difficulty: 'hard',
    q: "Why do we always see the same side of the Moon from Earth?\nA) The Moon does not rotate B) The Moon's rotation period equals its orbital period C) Earth's gravity has locked the Moon's rotation D) Both B and C are correct",
    expected: 'D) Both B and C — tidal locking causes the Moon to rotate once per orbit, so the same face always points toward Earth' },
  { id: 'arc-7', category: 'ARC-Challenge', benchmark: 'ARC-Challenge', difficulty: 'hard',
    q: "A solution has a pH of 3. How many times more acidic is it than a solution with pH 6?\nA) 3 times B) 10 times C) 100 times D) 1000 times",
    expected: 'D) 1000 times — pH is logarithmic base 10; difference of 3 = 10³ = 1000x more acidic' },
  { id: 'arc-8', category: 'ARC-Challenge', benchmark: 'ARC-Challenge', difficulty: 'medium',
    q: "What causes the seasons on Earth?\nA) Earth's varying distance from the Sun B) Earth's axial tilt as it orbits the Sun C) Solar flare activity D) The Moon's gravitational effects",
    expected: "B) Earth's 23.5° axial tilt — when the Northern Hemisphere tilts toward the Sun it's summer; away is winter" },
  { id: 'arc-9', category: 'ARC-Challenge', benchmark: 'ARC-Challenge', difficulty: 'hard',
    q: "In an electric circuit, if you double the voltage while keeping resistance constant, what happens to the current?\nA) Halves B) Stays the same C) Doubles D) Quadruples",
    expected: "C) Doubles — Ohm's law: I = V/R; double V with same R means double I" },
  { id: 'arc-10', category: 'ARC-Challenge', benchmark: 'ARC-Challenge', difficulty: 'hard',
    q: "Which type of wave requires a physical medium to travel through?\nA) Radio waves B) Gamma rays C) Sound waves D) Light waves",
    expected: 'C) Sound waves — mechanical waves require a medium (air, water, solid); electromagnetic waves (radio, gamma, light) do not' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Logic / Cognitive (classic reasoning problems)
// ─────────────────────────────────────────────────────────────────────────────
const LOGIC: Problem[] = [
  { id: 'logic-1', category: 'Logic', benchmark: 'CRT / Reasoning', difficulty: 'easy',
    q: 'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?',
    expected: '$0.05' },
  { id: 'logic-2', category: 'Logic', benchmark: 'CRT / Reasoning', difficulty: 'easy',
    q: 'If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?',
    expected: '5 minutes' },
  { id: 'logic-3', category: 'Logic', benchmark: 'CRT / Reasoning', difficulty: 'medium',
    q: 'In a lake, there is a patch of lily pads. Every day, the patch doubles in size. If it takes 48 days for the patch to cover the entire lake, how long would it take for the patch to cover half of the lake?',
    expected: '47 days' },
  { id: 'logic-4', category: 'Logic', benchmark: 'CRT / Reasoning', difficulty: 'easy',
    q: 'A farmer has 17 sheep. All but 9 die. How many sheep does the farmer have left?',
    expected: '9' },
  { id: 'logic-5', category: 'Logic', benchmark: 'CRT / Reasoning', difficulty: 'medium',
    q: 'If you overtake the person in second place in a race, what position are you in?',
    expected: 'Second place' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tower of Hanoi (algorithmic reasoning)
// ─────────────────────────────────────────────────────────────────────────────
const HANOI: Problem[] = [
  { id: 'hanoi-3', category: 'Hanoi', benchmark: 'Algorithmic Reasoning', difficulty: 'easy',
    q: 'Solve Tower of Hanoi with 3 disks. List all moves in order (e.g. "Move disk 1 from A to C"). What is the minimum number of moves?',
    expected: '7 moves' },
  { id: 'hanoi-4', category: 'Hanoi', benchmark: 'Algorithmic Reasoning', difficulty: 'medium',
    q: 'What is the minimum number of moves to solve Tower of Hanoi with 4 disks? Show the formula and calculate.',
    expected: '15 moves (2^4 - 1)' },
  { id: 'hanoi-5', category: 'Hanoi', benchmark: 'Algorithmic Reasoning', difficulty: 'hard',
    q: 'Tower of Hanoi with 5 disks: minimum moves? If each move takes 1 second, how long would 64 disks take in years?',
    expected: '31 moves; 64 disks = 2^64-1 ≈ 585 billion years' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Multi-digit arithmetic (tests precise multi-step computation)
// ─────────────────────────────────────────────────────────────────────────────
const ARITHMETIC: Problem[] = [
  { id: 'arith-1', category: 'Arithmetic', benchmark: 'Multi-digit Computation', difficulty: 'easy',
    q: 'What is 123 × 456? Show your work.', expected: '56,088' },
  { id: 'arith-2', category: 'Arithmetic', benchmark: 'Multi-digit Computation', difficulty: 'medium',
    q: 'What is 789 × 234? Show your work.', expected: '184,626' },
  { id: 'arith-3', category: 'Arithmetic', benchmark: 'Multi-digit Computation', difficulty: 'medium',
    q: 'What is 1,234 × 5,678? Show your work.', expected: '7,006,652' },
  { id: 'arith-4', category: 'Arithmetic', benchmark: 'Multi-digit Computation', difficulty: 'hard',
    q: 'What is 12,345 × 67,890? Show your work.', expected: '838,102,050' },
  { id: 'arith-5', category: 'Arithmetic', benchmark: 'Multi-digit Computation', difficulty: 'hard',
    q: 'What is 999 × 999? Do not use any shortcuts — long multiply only.', expected: '998,001' },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const PROBLEMS: Problem[] = [
  ...SWEBENCH,
  ...GSM8K,
  ...MATH,
  ...HUMANEVAL,
  ...MMLU,
  ...ARC,
  ...LOGIC,
  ...HANOI,
  ...ARITHMETIC,
];

export const CATEGORIES = [...new Set(PROBLEMS.map(p => p.category))];
export const BENCHMARKS_META: Record<string, { name: string; description: string; problems: number }> = {
  'SWE-bench': { name: 'SWE-bench Verified', description: 'Real GitHub bug fixes — read code, identify the bug, write the patch', problems: SWEBENCH.length },
  'GSM8K': { name: 'GSM8K', description: 'Grade school multi-step math word problems', problems: GSM8K.length },
  'MATH': { name: 'MATH Dataset', description: 'Competition math — algebra, geometry, number theory', problems: MATH.length },
  'HumanEval': { name: 'HumanEval', description: 'Python function synthesis from docstrings', problems: HUMANEVAL.length },
  'MMLU': { name: 'MMLU', description: 'Academic subject knowledge across 57 domains', problems: MMLU.length },
  'ARC-Challenge': { name: 'ARC-Challenge', description: 'Science reasoning requiring world knowledge', problems: ARC.length },
  'Logic': { name: 'CRT / Reasoning', description: 'Cognitive Reflection Test and classic puzzles', problems: LOGIC.length },
  'Hanoi': { name: 'Tower of Hanoi', description: 'Recursive algorithmic reasoning', problems: HANOI.length },
  'Arithmetic': { name: 'Multi-digit Computation', description: 'Precise long-form arithmetic', problems: ARITHMETIC.length },
};
