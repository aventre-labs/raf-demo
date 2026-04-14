// AI AGENTS: DO NOT MODIFY THIS FILE. It was written by hand as a ground truth for the RAF algorithm.

//placeholder types
type MCPTool = any
type JSONSchema = any
type LiteLLMModel = {
 call: (model: LiteLLMModel, tools: MCPTool[], output_format: JSONSchema, context: ModelIO) => Promise<ModelIO>
}
type JSONPrimitive = string | number | boolean | null
type JSONValue = JSONPrimitive | { [key: string]: JSONValue } | JSONValue[]
type cachedInput = { cached: true; value: string | JSONValue } // opaque cached handle for pseudocode purposes
type ModelIO = string | JSONValue | cachedInput // can be cached for cloud models that support input token caching
type ModelInput = ModelIO | Promise<ModelIO> // can also be a promise to wait on

function is_cached_input(value: ModelIO): value is cachedInput {
 return typeof value === 'object' && value !== null && (value as cachedInput).cached === true
}

async function resolve_model_input(input: ModelInput): Promise<ModelIO> {
 return Promise.resolve(input)
}

function model_io_to_string(value: ModelIO): string {
 if (typeof value === 'string') return value
 if (is_cached_input(value)) {
 return typeof value.value === 'string' ? value.value : JSON.stringify(value.value)
 }
 return JSON.stringify(value)
}

type BaseCaseDecision = "Base Case" | "Recursive Case"
type AgentCallResult<T> = { success: boolean, json: T | undefined }

interface AgentDesign {
 tools: MCPTool[]
 output_format: JSONSchema
 model: LiteLLMModel
 context: ModelIO
}

interface AnalysisResult {
 success: boolean
 info: string
}

type AgentConsortiumConfig<T> = { agents: Agent<T>[], format: JSONSchema, context: string, max_temp?: number, min_temp?: number, size?: number }
type AgentJuryConfig<T> = { max_temp: number, min_temp: number, size: number, agents: Agent<T>[], context: string, options: T[], format: JSONSchema }

interface childNodePlan {
 context: ModelInput
 name: string
 dependsOn: string[] // list of names of siblings that this agent will wait for the output of (if the siblings in this list are successful)
}

interface nodeResult {
 name: string
 success?: boolean
 execSummary?: string // context for summarization of running and info to pass to child nodes
 childExecutions: {[key: string]: nodeResult}
}

interface RecoveryStrategy {
 failure_analysis: string
 new_approach: string
 key_differences: string[]
 confidence: string
}

type ErrorFinderDecision = "YES" | "NO"
const ERROR_FINDER_JURY_CONFIG: AgentJuryConfig<ErrorFinderDecision> = { max_temp: 0.2, min_temp: 0.1, size: 5, agents: [], context: "Is THIS NODE the root cause of the failure?", options: ["YES", "NO"], format: {} as JSONSchema }
const RECOVERY_CONSORTIUM_CONFIG: AgentConsortiumConfig<RecoveryStrategy> = { max_temp: 0.6, min_temp: 0.2, size: 5, agents: [], context: "Propose an alternative strategy", format: {} as JSONSchema }
const RECOVERY_JURY_CONFIG: AgentJuryConfig<RecoveryStrategy> = { max_temp: 0.2, min_temp: 0.1, size: 5, agents: [], context: "Select best alternative strategy", options: [], format: {} as JSONSchema }

//Independent variables to test via benchmarks
const BASE_CASE_OPTIONS: BaseCaseDecision[] = ["Base Case", "Recursive Case"]

const BASE_CASE_JURY_CONFIG: AgentJuryConfig<BaseCaseDecision> = { max_temp: 0.5, min_temp: 0.1, size: 10, agents: [], context: "Is this a base case or recursive case?", options: BASE_CASE_OPTIONS, format: {} as JSONSchema } // agents: [] is a placeholder, example of the current set of agents being tested. Can have 1 or more agents. Test impacts of average compute level and compute level diversity. 
const BASE_CASE_CONSORTIUM_CONFIG: AgentConsortiumConfig<AgentDesign> = { max_temp: 0.5, min_temp: 0.1, size: 10, agents: [], context: "Design base case agent", format: {} } // format for this will be agent config ready to be called, including tooling, starting context, success condition, and other custom required JSON output fields. Can even force strings to fit regex.
const BASE_CASE_CONSORTIUM_JURY_CONFIG: AgentJuryConfig<AgentDesign> = { max_temp: 0.5, min_temp: 0.1, size: 10, agents: [], context: "Vote on the best base case agent", options: [], format: {} as JSONSchema }

const EXEC_ANALYSIS_CONSORTIUM_CONFIG: AgentConsortiumConfig<AnalysisResult> = { max_temp: 0.5, min_temp: 0.1, size: 10, agents: [], context: "Analyze on this excecution", format: { "success" : "boolean", "info" : "string" } } // also just a placeholder to conceptually outline whats happening
const EXEC_ANALYSIS_CONSORTIUM_JURY_CONFIG: AgentJuryConfig<AnalysisResult> = { max_temp: 0.5, min_temp: 0.1, size: 10, agents: [], context: "Vote on the best analysis", options: [], format: {} as JSONSchema }

const RECURSIVE_CASE_PLAN_CONSORTIUM_CONFIG: AgentConsortiumConfig<childNodePlan[]> = { max_temp: 0.5, min_temp: 0.1, size: 10, agents: [], context: "Come up with a plan for decomposing this recursive case into next-smallest cases", format: {} } // format will be parentPlan
const RECURSIVE_CASE_PLAN_CONCAT_CONSORTIUM_CONFIG: AgentConsortiumConfig<childNodePlan[][]> = { max_temp: 0.5, min_temp: 0.1, size: 10, agents: [], context: "Perform a union operation on all the proposed plans into a final list of proposed plans. Merge any plans that are identical or nearly identical. If any two parts of a plan conflict/are contradictory, then they are seperate plans and should not be merged", format: {} } // format is list of parentPlan
const RECURSIVE_CASE_PLAN_CONCAT_JURY_CONFIG: AgentJuryConfig<childNodePlan[][]> = { max_temp: 0.5, min_temp: 0.1, size: 10, agents: [], context: "Vote on which concatenated list of plans best represents all the proposed plans", options: [], format: {} as JSONSchema }
const RECURSIVE_CASE_PLAN_JURY_CONFIG: AgentJuryConfig<childNodePlan[]> = { max_temp: 0.5, min_temp: 0.1, size: 10, agents: [], context: "Vote on which concatenated plan for breaking down this recursive case into next-smallest parts is the best", options: [], format: {} as JSONSchema }


//etc.

// The recursive function behind the RAF.
class RafNode {
 // The result of the RAF node execution, and any relevant details about the success or failure for debugging purposes and context any nodes that are waiting for this node to complete.
 result: nodeResult
 state: "initialized" | "running" | "completed"
 children: {[key: string]: RafNode}
 context: ModelIO
 parent: RafNode | undefined // undefined if node is root
 dependencies: Promise<{promise: Promise<nodeResult>, node: RafNode[]}[]>
 resolveDependencies!: (value: {promise: Promise<nodeResult>, node: RafNode[]}[] | PromiseLike<{promise: Promise<nodeResult>, node: RafNode[]}[]>) => void;
 name: string

 constructor(context: ModelIO, parent?: RafNode, name?: string) {
 this.context = context
 this.parent = parent
 this.name = name || "root"
 this.state = "initialized"
 this.result = { name: this.name, childExecutions: {}}
 this.children = {}
 this.dependencies = parent ? new Promise<{promise: Promise<nodeResult>, node: RafNode[]}[]>((resolve) => { // wait for dependencies to be configured by parent
 this.resolveDependencies = resolve;
 }) : Promise.resolve([]) // if root then resolve dependencies to nothing immediately
 }

 async run_error_correction(failure_info: string, failed_output: string): Promise<{ is_origin: boolean, steering_advice?: string }> {
 const ErrorFinderJury = new AgentJury<ErrorFinderDecision>(ERROR_FINDER_JURY_CONFIG)
 await ErrorFinderJury.set_context(`Original task: ${this.context}\n\nFailed output: ${failed_output}\n\nFailure analysis: ${failure_info}`)
 const decision = await ErrorFinderJury.do_voting()

 if (decision === "NO" || !this.parent) {
 return { is_origin: decision === "YES" || !this.parent }
 }

 const RecoveryConsortium = new AgentConsortium<RecoveryStrategy>(RECOVERY_CONSORTIUM_CONFIG)
 await RecoveryConsortium.set_context(`FAILED PROBLEM: ${this.context}\nPREVIOUS APPROACH: ${failed_output}\nFAILURE REASON: ${failure_info}`)
 
 const RecoveryJury = new AgentJury<RecoveryStrategy>(RECOVERY_JURY_CONFIG)
 await RecoveryJury.set_options(await RecoveryConsortium.call())
 const best_recovery = await RecoveryJury.do_voting()

 const steering_advice = `CORRECTION GUIDANCE: Previous attempt failed. Analysis: ${best_recovery.failure_analysis}. New approach: ${best_recovery.new_approach}. Key differences: ${best_recovery.key_differences.join('; ')}`
 
 return { is_origin: true, steering_advice }
 }

 async base_case_vote(): Promise<boolean> {
 const BaseCaseJury = new AgentJury<BaseCaseDecision>(BASE_CASE_JURY_CONFIG)
 await BaseCaseJury.set_context(this.context)
 const decision = await BaseCaseJury.do_voting()
 return decision === "Base Case"
 }

 async base_case(): Promise<nodeResult> {
 const AgentDesignConsortium = new AgentConsortium<AgentDesign>(BASE_CASE_CONSORTIUM_CONFIG) // A group of agents that, given a task, context, list of tools, and output format, generate a list of potential base case executor agent designs. A base case excecutor agent design is a full agent starting context window, including system prompt with task spec context, tooling, success condition, and output format, which includes all context nescessary to start excecution immediately. It should have a very focused context window, with very clear instructions, only the tools it will use, and should excecute only one step. Multiple steps should be split between sequential sibling recursive nodes.
 const AgentDesignJury = new AgentJury<AgentDesign>(BASE_CASE_CONSORTIUM_JURY_CONFIG)
 const AnalysisConsortium = new AgentConsortium<AnalysisResult>(EXEC_ANALYSIS_CONSORTIUM_CONFIG)
 const AnalysisJury = new AgentJury<AnalysisResult>(EXEC_ANALYSIS_CONSORTIUM_JURY_CONFIG)

 await AgentDesignJury.set_options(await AgentDesignConsortium.call())

 const BaseCaseAgentDesign = await AgentDesignJury.do_voting()

 const out = await new Agent(BaseCaseAgentDesign.tools, BaseCaseAgentDesign.output_format, BaseCaseAgentDesign.model, BaseCaseAgentDesign.context).call()

 if (!out.success || !out.json) throw new Error("Base case agent failed to produce valid output")
 await AnalysisConsortium.set_context(out.json)

 await AnalysisJury.set_options(await AnalysisConsortium.call())

 const analysis = await AnalysisJury.do_voting()

 if (!analysis.success) {
 const correction = await this.run_error_correction(analysis.info, JSON.stringify(out.json))
 if (correction.is_origin && correction.steering_advice) {
 this.context = `${correction.steering_advice}\n\n---\n\nPROBLEM TO SOLVE:\n${this.context}`
 return this.base_case() // Retry
 }
 }

 return { name: this.name, success: analysis.success, execSummary: analysis.info, childExecutions: {} }
 }

 async recursive_case(): Promise<nodeResult> {
 const RecursiveCasePlanConsortium = new AgentConsortium<childNodePlan[]>(RECURSIVE_CASE_PLAN_CONSORTIUM_CONFIG)
 const RecursiveCasePlanConcatConsortium = new AgentConsortium<childNodePlan[][]>(RECURSIVE_CASE_PLAN_CONCAT_CONSORTIUM_CONFIG)
 const RecursiveCasePlanConcatJury = new AgentJury<childNodePlan[][]>(RECURSIVE_CASE_PLAN_CONCAT_JURY_CONFIG)
 const RecursiveCasePlanJury = new AgentJury<childNodePlan[]>(RECURSIVE_CASE_PLAN_JURY_CONFIG)

 const AnalysisConsortium = new AgentConsortium<AnalysisResult>(EXEC_ANALYSIS_CONSORTIUM_CONFIG)
 const AnalysisJury = new AgentJury<AnalysisResult>(EXEC_ANALYSIS_CONSORTIUM_JURY_CONFIG)

 // check for circular sibling dependencies and throw out plans that have circular dependence
 const plans = await RecursiveCasePlanConsortium.call()
 const filteredPlans = plans.filter(plan => !this.has_circular_dependency(plan))

 await RecursiveCasePlanConcatConsortium.set_context(JSON.stringify(filteredPlans))

 const planConcatenations = await RecursiveCasePlanConcatConsortium.call()

 await RecursiveCasePlanConcatJury.set_options(planConcatenations)
 const bestPlanConcatenation = await RecursiveCasePlanConcatJury.do_voting()

 await RecursiveCasePlanJury.set_options(bestPlanConcatenation)
 const plan: childNodePlan[] = await RecursiveCasePlanJury.do_voting()

 const planDependencies: {[key: string]: string[]} = {}

 for (const childPlan of plan) {
 const resolvedContext = await resolve_model_input(childPlan.context)
 this.children[childPlan.name] = new RafNode(resolvedContext, this, childPlan.name)
 planDependencies[childPlan.name] = childPlan.dependsOn
 }

 const childExecutionPromises: {[key: string]: Promise<nodeResult>} = {}

 for (const childName in this.children) {
 childExecutionPromises[childName] = this.children[childName].call()
 }

 for (const childName in this.children) {
 this.children[childName].set_dependencies(planDependencies[childName].map(depName => ({ promise: childExecutionPromises[depName], node: [this.children[depName]] })))
 }

 const results: {[key: string]: nodeResult} = Object.fromEntries(
 (await Promise.all(Object.values(childExecutionPromises))).map(childResult => [childResult.name, childResult])
 )

 await AnalysisConsortium.set_context(
 Object.entries(results)
 .map(([name, result]) => `${name}: ${result.execSummary}`)
 .join('\n')
 )

 await AnalysisJury.set_options(await AnalysisConsortium.call())
 const analysis = await AnalysisJury.do_voting()

 if (!analysis.success) {
 const child_summaries = Object.entries(results).map(([n, r]) => `${n}: ${r.execSummary}`).join(' | ')
 const correction = await this.run_error_correction(analysis.info, child_summaries)
 if (correction.is_origin && correction.steering_advice) {
 this.context = `${correction.steering_advice}\n\n---\n\nPROBLEM TO SOLVE:\n${this.context}`
 return this.recursive_case() // Retry
 }
 }

 return { name: this.name, success: analysis.success, execSummary: analysis.info, childExecutions: results }
 }

 set_dependencies(dependencies: {promise: Promise<nodeResult>, node: RafNode[]}[]) {
 this.resolveDependencies(dependencies)
 }

 has_circular_dependency(plan: childNodePlan[]): boolean { // detect circular sibling dependencies
 return false // placeholder, implementation unnescessary for pseudocode
 }

 async call(): Promise<nodeResult> {
 const dependencies = await this.dependencies // wait for dependencies to be configured by parent
 const dependentSiblingExecutions = await Promise.all(dependencies.map(dep => dep.promise)) // wait for all sibling nodes that this node depends on to finish excecution
 
 this.context = "Dependency excecutions: " + JSON.stringify(dependentSiblingExecutions) + "\n" + model_io_to_string(this.context) // add context from siblings that this node depends on to this.context

 this.state = "running"

 return await this.base_case_vote() ? this.base_case() : this.recursive_case()
 }
}

// One LLM instance.
class Agent<T = JSONValue> {
 // The starting context that is passed to the LLM that's already cached, if the model is running on a cloud provider that supports input token caching.
 context: ModelIO
 // The list of tools that are available to the LLM.
 tools: MCPTool[]
 //could use pedantic, JSON schema using schema.org, etc. Choose something that even small models could adhere to.
 // A JSON Schema that describes the expected output format of the LLM call.
 output_format: JSONSchema //could have | undefined, but one of the core design dogmas is to always require structured output
 // The model that is being used by the agent. Use LiteLLM for this, and type should be a valid LiteLLM model with config options such as thinking level and verbosity.
 model: LiteLLMModel

 constructor(tools: MCPTool[], output_format: JSONSchema, model: LiteLLMModel, context: ModelIO) {
 this.tools = tools
 this.output_format = output_format
 this.model = model
 this.context = context
 }

 validate_output(output: ModelIO, schema: JSONSchema): AgentCallResult<T> { // code to convert raw model output into a structured response matching this.output_format. not needed for pseudocode.
 if (typeof output === 'string') {
 try {
 return { success: true, json: JSON.parse(output) as T }
 } catch (e) {
 return { success: false, json: undefined }
 }
 }

 if (is_cached_input(output)) {
 if (typeof output.value === 'string') {
 try {
 return { success: true, json: JSON.parse(output.value) as T }
 } catch (e) {
 return { success: false, json: undefined }
 }
 }

 return { success: true, json: output.value as T }
 }

 return { success: true, json: output as T }
 }

 async call(): Promise<AgentCallResult<T>> {
 return this.validate_output(await this.model.call(this.model, this.tools, this.output_format, this.context), this.output_format)
 }
}

class AgentCluster<T = JSONValue> {
 // A list of agent objects that can be used in the cluster. Multiple could be passed for agent diversity. All must share the same output format. Part of function will be a for each loop over the agents setting agent.output_format to args.unified_output_format.
 agents: Agent<T>[]
 // The unified output format that all agents in the cluster must use.
 unified_output_format: JSONSchema
 //shared context for all cluster members
 context: ModelIO
 //number of members
 size: number

 constructor(agents: Agent<T>[], unified_output_format: JSONSchema, context: ModelIO) {
 this.agents = agents
 this.unified_output_format = unified_output_format
 this.context = context
 this.size = agents.length
 }

 async cache_input_raw(context: string): Promise<ModelIO> { //placeholder for prompt caching on cloud hosted models. In this pseudocode this method returns a pointer to cached tokens or the tokens themselves if caching is unavailable, both of which the agent object accepts.
 return undefined as any as cachedInput
 }

 async cache_input_json(context: JSONValue): Promise<ModelIO> { //placeholder for prompt caching on cloud hosted models. In this pseudocode this method returns a pointer to cached tokens or the tokens themselves if caching is unavailable, both of which the agent object accepts.
 return undefined as any as cachedInput
 }

 async set_context(context: ModelInput) {
 const resolved = await resolve_model_input(context)
 if (is_cached_input(resolved)) {
 this.context = resolved
 return
 }

 if (typeof resolved === 'string') {
 this.context = await this.cache_input_raw(resolved)
 } else {
 this.context = await this.cache_input_json(resolved)
 }
 }

 async call(): Promise<T[]> {
 const results: T[] = []
 for (const agent of this.agents) {
 agent.output_format = this.unified_output_format
 agent.context = this.context
 const res = await agent.call()
 if (res.success && res.json !== undefined) {
 results.push(res.json)
 }
 }

 return results
 }
}

// A group of agents that, given a set of parameters (for example a task spec, list of tools, and output format), return a list of each output that each agent in the consortium produces, excluding the outputs that don't match the expected output format.
class AgentConsortium<T = JSONValue> extends AgentCluster<T> {
 constructor(config: AgentConsortiumConfig<T>) {
 super(config.agents, config.format, config.context)
 }
}

// A consortium of agents that vote on options from a list. Expriment with different voting methods.
class AgentJury<T = JSONValue> extends AgentCluster<T> {
 // A list of options to be voted on by the agents.
 options: T[]
 ballot_format: JSONSchema
 base_context: string

 constructor(config: AgentJuryConfig<T>) {
 super(config.agents, config.format, config.context + config.options.map(o => JSON.stringify(o)).join("\n"))
 this.options = config.options
 this.base_context = config.context
 }

 async set_options(options: T[]) {
 this.options = options
 await this.set_context(this.base_context + this.options.map(o => JSON.stringify(o)).join("\n"))
 }

 async gather_votes(): Promise<Array<AgentCallResult<T>>> {
 if (this.agents.length === 0) {
 throw new Error("No agents available to gather votes")
 }

 const members: Agent<T>[] = Array.from({ length: this.size }, (_, i) => this.agents[i % this.agents.length]);
 const votes: Promise<AgentCallResult<T>>[] = []

 for (const member of members) {
 member.output_format = this.unified_output_format
 member.context = this.context

 votes.push(member.call())
 }

 return Promise.all(votes)
 }

 process_votes(votes: Array<AgentCallResult<T>>): T { // Pseudocode placeholder for vote selection algorithm. MVP can just use winner takes all voting. Down the road, could use advanced voting algorithms and voter self-improvement through tracking failiures and successes.
 const firstValid = votes.find(vote => vote.success && vote.json !== undefined)
 if (firstValid && firstValid.json !== undefined) {
 return firstValid.json
 }

 if (this.options.length > 0) {
 return this.options[0]
 }

 throw new Error("No valid votes to process")
 }

 async do_voting() {
 const votes = await this.gather_votes()
 return this.process_votes(votes)
 }
}