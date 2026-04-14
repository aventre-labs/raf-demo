# RAF (Recursive Agent Framework) Engine Architecture

This document describes the architectural implementation of the Recursive Agent Framework (RAF) engine as implemented in this repository, and how it aligns with and deviates from the original theoretical pseudocode (found in `handmade_files/pseudocode.ts`).

## Alignment with Theoretical Pseudocode
At its core, the implementation faithfully follows the primary recursive logic defined in the research:
- **Base Case Vote:** Every task is evaluated by a jury to determine if it should be solved directly (Base Case) or broken down (Recursive Case).
- **Consortium & Jury Pattern:** 
  - Instead of relying on a single LLM call, the engine uses a *Consortium* of parallel agents to propose solutions (either execution designs or decomposition plans).
  - A *Jury* then evaluates these proposals and selects the best one, enforcing consensus and reducing hallucination.
- **Analysis:** After execution (base or recursive), an Analysis Consortium/Jury reviews the result against the original prompt to determine success or failure.

## Evolution & Deviations (Error Handling & Practical Improvements)
To make the engine functional in a real-world, error-prone LLM environment (especially with smaller models like Llama 8B), several major features were added:

### 1. Functional Approach vs. Stateful OOP
The theoretical pseudocode uses heavy Object-Oriented patterns (`class RafNode`, `class Agent`, `class AgentConsortium`). The live implementation is purely functional (`execRafNode`, `consortium`, `jury`). This allows for easier async state management, real-time event emitting for the React UI, and eliminates complex class-based dependency promises.

### 2. Error Tracing & The Error Correction Loop
The original pseudocode simply propagated failures or threw errors when a base case failed. The live implementation features a robust, self-healing Error Correction Loop (`runErrorCorrection`):
*   **Error Origin Tracing:** When an analysis step returns `success: false`, an *Error Finder Jury* evaluates the failure. Crucially, it traces the error up the execution tree to determine if the *current node* was the root cause of the failure, or if it was just passing along a failure from a child node.
*   **Recovery Generation:** If the node *is* the origin of the error, a *Recovery Consortium* analyzes why the previous approach failed and proposes alternative strategies.
*   **Steering Advice:** A *Recovery Jury* selects the best alternative strategy, which is converted into "steering advice."
*   **Retries:** The node recursively retries its execution (`retryCount + 1`), feeding the new steering advice into the prompt to correct its past mistake. If it's not the origin, it simply returns the failure upward until it hits the node that caused it.

### 3. Resilient Parsing vs. Strict Typing
The pseudocode assumes that `JSONSchema` is perfectly adhered to, returning structured `T | undefined`. In reality, LLMs (especially smaller ones) inject conversational fluff, markdown formatting, or malformed JSON. The live engine uses regex-based extraction (`tryParseDesign`, `tryParsePlan`) to aggressively pluck the JSON payload out of the response. If parsing entirely fails, it injects safe fallback structures so the pipeline continues rather than crashing.

### 4. Dependency Deadlock Prevention
In the recursive case, LLMs sometimes hallucinate `dependsOn` arrays, inventing tasks that don't exist or creating circular dependencies (Task A waits for B; Task B waits for A). The live implementation filters dependencies against actual generated siblings and implements a timeout breaker to prevent the async `while` loop from deadlocking the entire execution tree.

### 5. Event-Driven Real-Time UI
The theoretical pseudocode is a black box until the final promise resolves. The live engine is instrumented with an `emit()` event bus. Every jury vote, consortium proposal, and agent step fires an event (`node_start`, `raf_node_start`, `node_done`), which drives the live D3.js force graph and stats panel.