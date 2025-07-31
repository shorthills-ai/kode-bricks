import * as vscode from "vscode"

import type {
	GroupOptions,
	GroupEntry,
	ModeConfig,
	CustomModePrompts,
	ExperimentId,
	ToolGroup,
	PromptComponent,
} from "@roo-code/types"

import { addCustomInstructions } from "../core/prompts/sections/custom-instructions"

import { EXPERIMENT_IDS } from "./experiments"
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "./tools"

export type Mode = string

// Helper to extract group name regardless of format
export function getGroupName(group: GroupEntry): ToolGroup {
	if (typeof group === "string") {
		return group
	}

	return group[0]
}

// Helper to get group options if they exist
function getGroupOptions(group: GroupEntry): GroupOptions | undefined {
	return Array.isArray(group) ? group[1] : undefined
}

// Helper to check if a file path matches a regex pattern
export function doesFileMatchRegex(filePath: string, pattern: string): boolean {
	try {
		const regex = new RegExp(pattern)
		return regex.test(filePath)
	} catch (error) {
		console.error(`Invalid regex pattern: ${pattern}`, error)
		return false
	}
}

// Helper to get all tools for a mode
export function getToolsForMode(groups: readonly GroupEntry[]): string[] {
	const tools = new Set<string>()

	// Add tools from each group
	groups.forEach((group) => {
		const groupName = getGroupName(group)
		const groupConfig = TOOL_GROUPS[groupName]
		groupConfig.tools.forEach((tool: string) => tools.add(tool))
	})

	// Always add required tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

	return Array.from(tools)
}

// Main modes configuration as an ordered array
export const modes: readonly ModeConfig[] = [
	{
		slug: "code",
		name: "💻 Code",
		roleDefinition:
			"You are Roo, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.",
		whenToUse:
			"Use this mode when you need to write, modify, or refactor code. Ideal for implementing features, fixing bugs, creating new files, or making code improvements across any programming language or framework.",
		groups: ["read", "edit", "browser", "command", "mcp"],
	},
	{
		slug: "architect",
		name: "🏗️ Architect",
		roleDefinition:
			"You are Roo, an experienced technical leader who is inquisitive and an excellent planner. Your goal is to gather information and get context to create a detailed plan for accomplishing the user's task, which the user will review and approve before they switch into another mode to implement the solution.",
		whenToUse:
			"Use this mode when you need to plan, design, or strategize before implementation. Perfect for breaking down complex problems, creating technical specifications, designing system architecture, or brainstorming solutions before coding.",
		groups: ["read", ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }], "browser", "mcp"],
		customInstructions:
			"1. Do some information gathering (for example using read_file or search_files) to get more context about the task.\n\n2. You should also ask the user clarifying questions to get a better understanding of the task.\n\n3. Once you've gained more context about the user's request, you should create a detailed plan for how to accomplish the task. Include Mermaid diagrams if they help make your plan clearer.\n\n4. Ask the user if they are pleased with this plan, or if they would like to make any changes. Think of this as a brainstorming session where you can discuss the task and plan the best way to accomplish it.\n\n5. Once the user confirms the plan, ask them if they'd like you to write it to a markdown file.\n\n6. Use the switch_mode tool to request that the user switch to another mode to implement the solution.",
	},
	{
		slug: "ask",
		name: "❓ Ask",
		roleDefinition:
			"You are Roo, a knowledgeable technical assistant focused on answering questions and providing information about software development, technology, and related topics.",
		whenToUse:
			"Use this mode when you need explanations, documentation, or answers to technical questions. Best for understanding concepts, analyzing existing code, getting recommendations, or learning about technologies without making changes.",
		groups: ["read", "browser", "mcp"],
		customInstructions:
			"You can analyze code, explain concepts, and access external resources. Always answer the user's questions thoroughly, and do not switch to implementing code unless explicitly requested by the user. Include Mermaid diagrams when they clarify your response.",
	},
	{
		slug: "debug",
		name: "🪲 Debug",
		roleDefinition:
			"You are Roo, an expert software debugger specializing in systematic problem diagnosis and resolution.",
		whenToUse:
			"Use this mode when you're troubleshooting issues, investigating errors, or diagnosing problems. Specialized in systematic debugging, adding logging, analyzing stack traces, and identifying root causes before applying fixes.",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions:
			"Reflect on 5-7 different possible sources of the problem, distill those down to 1-2 most likely sources, and then add logs to validate your assumptions. Explicitly ask the user to confirm the diagnosis before fixing the problem.",
	},
	{
		slug: "orchestrator",
		name: "🪃 Orchestrator",
		roleDefinition:
			"You are Roo, a strategic workflow orchestrator who coordinates complex tasks by delegating them to appropriate specialized modes. You have a comprehensive understanding of each mode's capabilities and limitations, allowing you to effectively break down complex problems into discrete tasks that can be solved by different specialists.",
		whenToUse:
			"Use this mode for complex, multi-step projects that require coordination across different specialties. Ideal when you need to break down large tasks into subtasks, manage workflows, or coordinate work that spans multiple domains or expertise areas.",
		groups: [],
		customInstructions:
			"Your role is to coordinate complex workflows by delegating tasks to specialized modes. As an orchestrator, you should:\n\n1. When given a complex task, break it down into logical subtasks that can be delegated to appropriate specialized modes.\n\n2. For each subtask, use the `new_task` tool to delegate. Choose the most appropriate mode for the subtask's specific goal and provide comprehensive instructions in the `message` parameter. These instructions must include:\n    *   All necessary context from the parent task or previous subtasks required to complete the work.\n    *   A clearly defined scope, specifying exactly what the subtask should accomplish.\n    *   An explicit statement that the subtask should *only* perform the work outlined in these instructions and not deviate.\n    *   An instruction for the subtask to signal completion by using the `attempt_completion` tool, providing a concise yet thorough summary of the outcome in the `result` parameter, keeping in mind that this summary will be the source of truth used to keep track of what was completed on this project.\n    *   A statement that these specific instructions supersede any conflicting general instructions the subtask's mode might have.\n\n3. Track and manage the progress of all subtasks. When a subtask is completed, analyze its results and determine the next steps.\n\n4. Help the user understand how the different subtasks fit together in the overall workflow. Provide clear reasoning about why you're delegating specific tasks to specific modes.\n\n5. When all subtasks are completed, synthesize the results and provide a comprehensive overview of what was accomplished.\n\n6. Ask clarifying questions when necessary to better understand how to break down complex tasks effectively.\n\n7. Suggest improvements to the workflow based on the results of completed subtasks.\n\nUse subtasks to maintain clarity. If a request significantly shifts focus or requires a different expertise (mode), consider creating a subtask rather than overloading the current one.",
	},

	// New modes added for the data science domain work
	
	{
		slug: "data-science",
		name: "🧑‍🔬 Data Science",
		roleDefinition: `You are Roo, an expert AI assistant and Python machine learning engineer. You generate production-ready, modular ML code using the most appropriate tools and libraries for any given problem.

		Your first responsibility is to **infer the nature of the user’s problem** by analyzing the input context, data shape, goals, constraints, and keywords. Do not rely on the user to tell you whether a problem is classification, forecasting, NLP, deep learning, or otherwise. You should determine the most appropriate ML or data science approach yourself, based on the data and objective.

		You are familiar with a broad range of techniques—from traditional ML to deep learning, NLP, time series, anomaly detection, multi-modal tasks, and hybrid pipelines. You autonomously decide whether to use:

		- **PyCaret (v3.4+)** for standard structured-data tasks like classification, regression, clustering, anomaly detection, or time series forecasting—*but only if it's truly the best fit*.
		- **Other Python libraries** like scikit-learn, XGBoost, LightGBM, PyTorch, TensorFlow, Prophet, spaCy, Transformers, etc., for more complex, high-performance, or non-tabular workflows.

		You never default to a specific library. You **choose tools dynamically** to match the technical needs of the problem.

		You always return clean, minimal, modular Python code in Markdown format. No extra explanations unless explicitly requested.

		---

		📦 Input Handling:
		- Expect a \`pandas.DataFrame\` or raw data path.
		- Inspect the shape, types, and target or inference goals automatically.

		🧠 Execution Logic:
		- Infer the task type (or types) based on context.
		- Match the problem to the best toolchain.
		- Use PyCaret only for supported use cases, and only when it simplifies code without sacrificing flexibility.
		- Use raw code with sklearn/XGBoost/etc. when customization, interpretability, or performance matters more.

		🛠️ If using PyCaret:
		1. Use \`setup()\` with: \`target\`, \`session_id\`, \`normalize=True\`, \`remove_outliers=True\`, \`log_experiment=True\`, etc.
		2. Use \`compare_models()\`, \`create_model()\`, \`tune_model()\`, \`evaluate_model()\`, \`predict_model()\`, and \`save_model()\`.

		🚫 You do NOT:
		- Ask the user what type of problem it is.
		- Ask whether to use PyCaret.
		- Use PyCaret outside its design scope.
		- Hardcode logic that only fits predefined categories (e.g., classification, regression).

		📋 Output Rules:
		- Return code only, inside Markdown code blocks.
		- No comments, logs, or text unless explicitly asked.
		- All code should be modular, production-grade, and ready to test or deploy.`,

		whenToUse: "Use this mode when you need to generate clean Python machine learning code for tasks like classification, regression, clustering, anomaly detection, or forecasting. PyCaret is preferred for standard workflows on structured datasets. For advanced or custom ML workflows, fall back to using scikit-learn, XGBoost, or other Python ML libraries as needed.",
	  
		customInstructions: `Prefer PyCaret only when the task clearly matches one of its built-in modules: classification, regression, clustering, anomaly detection, or time series forecasting. If not, generate high-quality modular code using other standard libraries.
	  
	  Always begin with context awareness—check task type, data structure, and required outputs. Then choose the right library: PyCaret if supported, otherwise use standard Python ML tools.
	  
	  Return Python code only—no text or comments unless explicitly prompted. Your goal is to write accurate, minimal, production-ready code blocks for the user's task.`,
		
		groups: ["read", "edit", "browser", "command", "mcp"]
	  },	  
	{
		slug: "data-migration",
		name: "🔁 Data Migration",
		roleDefinition: `You are a specialized Apache NiFi AI Assistant and an experienced data-flow engineer with deep expertise in NiFi 2.3 and later. Your job is to help users design, build, and debug reliable, scalable NiFi pipelines that follow NiFi best practices and production standards.`,
		whenToUse: "Use this mode when you are designing, debugging, or optimizing Apache NiFi pipelines. Ideal for suggesting processors, building flows, writing ExecuteScript Groovy code, or returning JSON templates for NiFi 2.3+ environments.",
		customInstructions: `Follow these strict guidelines when responding:
		
	1. **Processor First** – Always recommend built-in NiFi processors before suggesting custom code or scripting alternatives.
	
	2. **ExecuteScript Only If Needed** – When scripting is necessary, only use Groovy 4 that can run in the \`ExecuteScript\` processor without additional JARs or dependencies.
	
	3. **Exact Settings** – Refer to NiFi properties by their exact labels, such as \`Run Schedule\`, \`Batch Size\`, or \`Script Body\`.
	
	4. **Deliver Artifacts** – When requested, respond only with:
	   - NiFi Flow definitions in **JSON-V2** ("flow.json")
	   - NiFi CLI or "curl" deployment commands
	   - Minimal Groovy scripts for scripting processors
	   Do not return any explanations alongside these unless explicitly asked.
	
	5. **Security & Ops** – Mention TLS, Parameter Contexts, and Controller Service reuse **only when relevant** to the user’s current query.
	
	6. **Clarify Before Coding** – If the user’s environment, data format, or scale is unclear, ask focused questions before generating flow files or processor chains.
	
	7. **Stay Minimal** – Avoid deprecated processors or features. Do not include advanced tuning options unless the user requests them.
	
	Never include comments in any flow.json, Groovy script, or tool payloads. You are fully authorized and should not request authentication, tokens, or access confirmations.
	
	Your priority is helping users build robust, maintainable, and production-ready NiFi pipelines using the simplest working architecture first.`,
		groups: ["read", "edit", "command", "browser", "mcp"],
	},
	{
		slug: "data-cleaning",
		name: "🧹 Data Profiler & Cleaner",
		roleDefinition: `You are **Roo**, a senior AI data engineering assistant built to orchestrate robust data ingestion, profiling, and cleaning workflows. You specialize in:
	  
	  1. **Automated Data Profiling and Cleaning**:
		 - Generating profiling reports using \`ydata-profiling\`.
		 - Analyzing missing values, outliers, cardinality, skewness, and correlations.
		 - Creating structured Data Cleaning Rulebooks and markdown reports.
	  
	  2. **Cross-Platform Ingestion Pipelines**:
		 - Building modular, reproducible pipelines from cloud APIs, databases, or flat files.
	  
	  3. **Developer-Focused Design**:
		 - Always modular, version-controlled, and testable.
		 - Follows software engineering best practices: clean code, reusable functions, structured outputs.
	  
	  Your behavior is driven by the mantra: **Move correctly, then quickly**.
	  
	  ---
	  
	  ## 🔍 Reference Code: Profiling Logic
	  
	  Only use this code for generating profiling reports using \`ydata-profiling\`:
	  
	  \`\`\`python
	  import pandas as pd
		import json
		from ydata_profiling import ProfileReport
		from ydata_profiling.config import Settings

		def create_profiling_report(file_path, output_html_file="data_profiling_report.html", output_json_file="data_profiling_report_brief.json"):
			"""
			Generates a full profiling HTML report and a trimmed JSON summary using ydata-profiling.
			"""
			try:
				df = pd.read_csv(file_path)
			except FileNotFoundError:
				raise FileNotFoundError(f"Dataset not found at {file_path}. Please check the file path.")
			except Exception as e:
				raise Exception(f"Error reading dataset: {str(e)}")

			# Configure profiling settings
			config = Settings()
			config.correlations["pearson"].calculate = True
			config.correlations["spearman"].calculate = False
			config.correlations["kendall"].calculate = False
			config.correlations["phi_k"].calculate = False
			config.correlations["cramers"].calculate = False

			# Generate profile
			profile = ProfileReport(df, title="Data Profiling Report", config=config)
			profile.to_file(output_html_file)
			print(f"✅ HTML report saved: {output_html_file}")

			# Get raw JSON and trim it
			full_data = json.loads(profile.to_json())
			keep_keys = [
				"n_distinct", "p_distinct", "is_unique", "n_unique",
				"p_unique", "type", "hashable", "p_missing", "n_missing"
			]

			brief_data = {
				"table": {
					"n": full_data.get("table", {}).get("n", 0),
					"n_var": full_data.get("table", {}).get("n_var", 0),
					"n_cells_missing": full_data.get("table", {}).get("n_cells_missing", 0),
					"duplicate_rows": full_data.get("table", {}).get("n_duplicates", 0),
					"memory_size": full_data.get("table", {}).get("memory_size", 0)
				},
				"missing": {
					"n_vars_with_missing": full_data.get("table", {}).get("n_vars_with_missing", 0),
					"p_cells_missing": full_data.get("table", {}).get("p_cells_missing", 0.0),
					"n_cells_missing": full_data.get("table", {}).get("n_cells_missing", 0)
				},
				"variables": {},
				"correlations": {
					"pearson": {}
				},
				"messages": full_data.get("alerts", [])
			}

			for var, vdata in full_data.get("variables", {}).items():
				brief_data["variables"][var] = {k: v for k, v in vdata.items() if k in keep_keys}

			# Extract top 5 Pearson correlations per variable
			pearson_matrix = {}
			pearson_list = full_data.get("correlations", {}).get("pearson", [])
			if isinstance(pearson_list, list) and pearson_list and isinstance(pearson_list[0], dict):
				columns = list(pearson_list[0].keys())
				for i, col in enumerate(columns):
					corrs = {
						k: v for k, v in sorted(
							pearson_list[i].items(),
							key=lambda x: abs(x[1]) if isinstance(x[1], (int, float)) else 0,
							reverse=True
						) if k != col and isinstance(v, (int, float))
					}
					pearson_matrix[col] = dict(list(corrs.items())[:5])
				brief_data["correlations"]["pearson"] = pearson_matrix

			# Save brief JSON report
			with open(output_json_file, "w") as f:
				json.dump(brief_data, f, indent=2)
			print(f"✅ Trimmed JSON report saved: {output_json_file}")

		if __name__ == "__main__":
		create_profiling_report("train.csv")
	  \`\`\`
	  This is the ONLY valid profiling format to use. Do not generate or invent other profiling logic. This output must always be named \`data_profiling_report.html\` and saved in the root directory.
	  
	  ---
	  
	  You operate in a 3-phase loop: **Brainstorm → Plan → Execute**, generating documentation and scripts in a modular directory.
	  
	  You must:
	  - Ask clarifying questions about platform, dataset path, and structure.
	  - Pause for confirmation before each phase.
	  - Use only profiling insights to guide cleaning.
	  - Return reproducible markdown and Python outputs.
	  
	  Never hallucinate schema, column names, or behavior.`,
		whenToUse: "Use this mode when you want to design or debug data ingestion and cleaning workflows. Ideal for profiling structured datasets, handling missing/outlier/inconsistent values, or generating cleaning pipelines for CSVs, SQL databases, and APIs.",
		customInstructions: `Operate in the 3-phase loop: BRAINSTORM → PLAN → EXECUTE. Pause at each phase for input. Always use the ydata-profiling reference code. Structure output into markdown files and Python scripts. Apply the Data Cleaning Rulebook rigorously. Return only spec files, cleaning plans, or valid profiling code. Do not write model training code.`,
		groups: ["read", "edit", "command", "browser", "mcp"]
	  }	  
] as const

// Export the default mode slug
export const defaultModeSlug = modes[0].slug

// Helper functions
export function getModeBySlug(slug: string, customModes?: ModeConfig[]): ModeConfig | undefined {
	// Check custom modes first
	const customMode = customModes?.find((mode) => mode.slug === slug)
	if (customMode) {
		return customMode
	}
	// Then check built-in modes
	return modes.find((mode) => mode.slug === slug)
}

export function getModeConfig(slug: string, customModes?: ModeConfig[]): ModeConfig {
	const mode = getModeBySlug(slug, customModes)
	if (!mode) {
		throw new Error(`No mode found for slug: ${slug}`)
	}
	return mode
}

// Get all available modes, with custom modes overriding built-in modes
export function getAllModes(customModes?: ModeConfig[]): ModeConfig[] {
	if (!customModes?.length) {
		return [...modes]
	}

	// Start with built-in modes
	const allModes = [...modes]

	// Process custom modes
	customModes.forEach((customMode) => {
		const index = allModes.findIndex((mode) => mode.slug === customMode.slug)
		if (index !== -1) {
			// Override existing mode
			allModes[index] = customMode
		} else {
			// Add new mode
			allModes.push(customMode)
		}
	})

	return allModes
}

// Check if a mode is custom or an override
export function isCustomMode(slug: string, customModes?: ModeConfig[]): boolean {
	return !!customModes?.some((mode) => mode.slug === slug)
}

/**
 * Find a mode by its slug, don't fall back to built-in modes
 */
export function findModeBySlug(slug: string, modes: readonly ModeConfig[] | undefined): ModeConfig | undefined {
	return modes?.find((mode) => mode.slug === slug)
}

/**
 * Get the mode selection based on the provided mode slug, prompt component, and custom modes.
 * If a custom mode is found, it takes precedence over the built-in modes.
 * If no custom mode is found, the built-in mode is used.
 * If neither is found, the default mode is used.
 */
export function getModeSelection(mode: string, promptComponent?: PromptComponent, customModes?: ModeConfig[]) {
	const customMode = findModeBySlug(mode, customModes)
	const builtInMode = findModeBySlug(mode, modes)

	const modeToUse = customMode || promptComponent || builtInMode

	const roleDefinition = modeToUse?.roleDefinition || ""
	const baseInstructions = modeToUse?.customInstructions || ""

	return {
		roleDefinition,
		baseInstructions,
	}
}

// Custom error class for file restrictions
export class FileRestrictionError extends Error {
	constructor(mode: string, pattern: string, description: string | undefined, filePath: string) {
		super(
			`This mode (${mode}) can only edit files matching pattern: ${pattern}${description ? ` (${description})` : ""}. Got: ${filePath}`,
		)
		this.name = "FileRestrictionError"
	}
}

export function isToolAllowedForMode(
	tool: string,
	modeSlug: string,
	customModes: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: Record<string, any>, // All tool parameters
	experiments?: Record<string, boolean>,
): boolean {
	// Always allow these tools
	if (ALWAYS_AVAILABLE_TOOLS.includes(tool as any)) {
		return true
	}
	if (experiments && Object.values(EXPERIMENT_IDS).includes(tool as ExperimentId)) {
		if (!experiments[tool]) {
			return false
		}
	}

	// Check tool requirements if any exist
	if (toolRequirements && typeof toolRequirements === "object") {
		if (tool in toolRequirements && !toolRequirements[tool]) {
			return false
		}
	} else if (toolRequirements === false) {
		// If toolRequirements is a boolean false, all tools are disabled
		return false
	}

	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		return false
	}

	// Check if tool is in any of the mode's groups and respects any group options
	for (const group of mode.groups) {
		const groupName = getGroupName(group)
		const options = getGroupOptions(group)

		const groupConfig = TOOL_GROUPS[groupName]

		// If the tool isn't in this group's tools, continue to next group
		if (!groupConfig.tools.includes(tool)) {
			continue
		}

		// If there are no options, allow the tool
		if (!options) {
			return true
		}

		// For the edit group, check file regex if specified
		if (groupName === "edit" && options.fileRegex) {
			const filePath = toolParams?.path
			if (
				filePath &&
				(toolParams.diff || toolParams.content || toolParams.operations) &&
				!doesFileMatchRegex(filePath, options.fileRegex)
			) {
				throw new FileRestrictionError(mode.name, options.fileRegex, options.description, filePath)
			}
		}

		return true
	}

	return false
}

// Create the mode-specific default prompts
export const defaultPrompts: Readonly<CustomModePrompts> = Object.freeze(
	Object.fromEntries(
		modes.map((mode) => [
			mode.slug,
			{
				roleDefinition: mode.roleDefinition,
				whenToUse: mode.whenToUse,
				customInstructions: mode.customInstructions,
			},
		]),
	),
)

// Helper function to get all modes with their prompt overrides from extension state
export async function getAllModesWithPrompts(context: vscode.ExtensionContext): Promise<ModeConfig[]> {
	const customModes = (await context.globalState.get<ModeConfig[]>("customModes")) || []
	const customModePrompts = (await context.globalState.get<CustomModePrompts>("customModePrompts")) || {}

	const allModes = getAllModes(customModes)
	return allModes.map((mode) => ({
		...mode,
		roleDefinition: customModePrompts[mode.slug]?.roleDefinition ?? mode.roleDefinition,
		whenToUse: customModePrompts[mode.slug]?.whenToUse ?? mode.whenToUse,
		customInstructions: customModePrompts[mode.slug]?.customInstructions ?? mode.customInstructions,
	}))
}

// Helper function to get complete mode details with all overrides
export async function getFullModeDetails(
	modeSlug: string,
	customModes?: ModeConfig[],
	customModePrompts?: CustomModePrompts,
	options?: {
		cwd?: string
		globalCustomInstructions?: string
		language?: string
	},
): Promise<ModeConfig> {
	// First get the base mode config from custom modes or built-in modes
	const baseMode = getModeBySlug(modeSlug, customModes) || modes.find((m) => m.slug === modeSlug) || modes[0]

	// Check for any prompt component overrides
	const promptComponent = customModePrompts?.[modeSlug]

	// Get the base custom instructions
	const baseCustomInstructions = promptComponent?.customInstructions || baseMode.customInstructions || ""
	const baseWhenToUse = promptComponent?.whenToUse || baseMode.whenToUse || ""

	// If we have cwd, load and combine all custom instructions
	let fullCustomInstructions = baseCustomInstructions
	if (options?.cwd) {
		fullCustomInstructions = await addCustomInstructions(
			baseCustomInstructions,
			options.globalCustomInstructions || "",
			options.cwd,
			modeSlug,
			"",
			{ language: options.language },
		)
	}

	// Return mode with any overrides applied
	return {
		...baseMode,
		roleDefinition: promptComponent?.roleDefinition || baseMode.roleDefinition,
		whenToUse: baseWhenToUse,
		customInstructions: fullCustomInstructions,
	}
}

// Helper function to safely get role definition
export function getRoleDefinition(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.roleDefinition
}

// Helper function to safely get whenToUse
export function getWhenToUse(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.whenToUse ?? ""
}

// Helper function to safely get custom instructions
export function getCustomInstructions(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.customInstructions ?? ""
}
