import * as vscode from "vscode"

import type {
	GroupOptions,
	GroupEntry,
	DomainConfig,
	CustomDomainPrompts,
	ExperimentId,
	ToolGroup,
	PromptComponent,
} from "@roo-code/types"

import { addCustomInstructions } from "../core/prompts/sections/custom-instructions"

import { EXPERIMENT_IDS } from "./experiments"
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "./tools"

export type Domain = string

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

// Helper to get all tools for a domain
export function getToolsForDomain(groups: readonly GroupEntry[]): string[] {
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

// Main domains configuration as an ordered array
export const domains: readonly DomainConfig[] = [
	{
		slug: "healthcare",
		name: "🏥 Healthcare",
		roleDefinition:
			"You are Roo, an expert in healthcare technology, medical data analysis, and digital health solutions. You understand healthcare regulations, patient privacy, and can assist with EHR systems, telemedicine, and clinical workflows.",
		whenToUse:
			"Use this domain for tasks related to healthcare, medical data, patient management, or digital health projects.",
		customInstructions:
			"Always prioritize patient privacy and regulatory compliance (e.g., HIPAA). Use clear, non-technical language when communicating with healthcare professionals.",
		groups: ["read", "edit", "browser", "command", "mcp"],
	},
	{
		slug: "automobile",
		name: "🚗 Automobile",
		roleDefinition:
			"You are Roo, an automotive industry specialist with expertise in vehicle systems, diagnostics, manufacturing processes, and automotive software. You can assist with embedded systems, diagnostics, and automotive standards.",
		whenToUse: "Use this domain for tasks related to vehicles, automotive software, diagnostics, or manufacturing.",
		customInstructions:
			"Follow automotive safety standards and best practices. Use industry terminology when appropriate.",
		groups: ["read", "edit", "browser", "command", "mcp"],
	},
	{
		slug: "manufacturing",
		name: "🏭 Manufacturing",
		roleDefinition:
			"You are Roo, a manufacturing domain expert skilled in production processes, automation, supply chain management, and industrial IoT. You can help with process optimization, quality control, and digital transformation in manufacturing.",
		whenToUse:
			"Use this domain for tasks related to manufacturing, industrial automation, or supply chain management.",
		customInstructions:
			"Emphasize efficiency, safety, and quality control. Use clear documentation for process changes.",
		groups: ["read", "edit", "browser", "command", "mcp"],
	},
	{
		slug: "entertainment",
		name: "🏭 Entertainment",
		roleDefinition:
			"You are Roo, a Entertainment domain expert skilled in production processes, automation, supply chain management, and industrial IoT. You can help with process optimization, quality control, and digital transformation in manufacturing.",
		whenToUse:
			"Use this domain for tasks related to manufacturing, industrial automation, or supply chain management.",
		customInstructions:
			"Emphasize efficiency, safety, and quality control. Use clear documentation for process changes.",
		groups: ["read", "edit", "browser", "command", "mcp"],
	},
] as const

// Export the default domain slug
export const defaultDomainSlug = domains[0].slug

// Helper functions
export function getDomainBySlug(slug: string, customDomains?: DomainConfig[]): DomainConfig | undefined {
	// Then check built-in domains
	return domains.find((domain) => domain.slug === slug)
}

export function getDomainConfig(slug: string, customDomains?: DomainConfig[]): DomainConfig {
	const domain = getDomainBySlug(slug, customDomains)
	if (!domain) {
		throw new Error(`No domain found for slug: ${slug}`)
	}
	return domain
}

// Get all available domains, with custom domains overriding built-in domains
export function getAllDomains(customDomains?: DomainConfig[]): DomainConfig[] {
	if (!customDomains?.length) {
		return [...domains]
	}

	// Start with built-in domains
	const allDomains = [...domains]

	// Process custom domains
	customDomains.forEach((customDomain) => {
		const index = allDomains.findIndex((domain) => domain.slug === customDomain.slug)
		if (index !== -1) {
			// Override existing domain
			allDomains[index] = customDomain
		} else {
			// Add new domain
			allDomains.push(customDomain)
		}
	})

	return allDomains
}

// Check if a domain is custom or an override
export function isCustomDomain(slug: string, customDomains?: DomainConfig[]): boolean {
	return !!customDomains?.some((domain) => domain.slug === slug)
}

/**
 * Find a domain by its slug, don't fall back to built-in domains
 */
export function findDomainBySlug(slug: string, domains: readonly DomainConfig[] | undefined): DomainConfig | undefined {
	return domains?.find((domain) => domain.slug === slug)
}

/**
 * Get the domain selection based on the provided domain slug, prompt component, and custom domains.
 * If a custom domain is found, it takes precedence over the built-in domains.
 * If no custom domain is found, the built-in domain is used.
 * If neither is found, the default domain is used.
 */
export function getDomainSelection(domain: string, promptComponent?: PromptComponent, customDomains?: DomainConfig[]) {
	const builtInDomain = findDomainBySlug(domain, domains)

	const domainToUse = promptComponent || builtInDomain

	const roleDefinition = domainToUse?.roleDefinition || ""
	const baseInstructions = domainToUse?.customInstructions || ""

	return {
		roleDefinition,
		baseInstructions,
	}
}

// Custom error class for file restrictions
export class FileRestrictionError extends Error {
	constructor(domain: string, pattern: string, description: string | undefined, filePath: string) {
		super(
			`This domain (${domain}) can only edit files matching pattern: ${pattern}${description ? ` (${description})` : ""}. Got: ${filePath}`,
		)
		this.name = "FileRestrictionError"
	}
}

export function isToolAllowedForDomain(
	tool: string,
	domainSlug: string,
	customDomains: DomainConfig[],
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

	const domain = getDomainBySlug(domainSlug, customDomains)
	if (!domain) {
		return false
	}

	// Check if tool is in any of the domain's groups and respects any group options
	for (const group of domain.groups) {
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
				throw new FileRestrictionError(domain.name, options.fileRegex, options.description, filePath)
			}
		}

		return true
	}

	return false
}

// Create the domain-specific default prompts
export const defaultPrompts: Readonly<CustomDomainPrompts> = Object.freeze(
	Object.fromEntries(
		domains.map((domain) => [
			domain.slug,
			{
				roleDefinition: domain.roleDefinition,
				whenToUse: domain.whenToUse,
				customInstructions: domain.customInstructions,
			},
		]),
	),
)

// Helper function to get all domains with their prompt overrides from extension state
export async function getAllDomainsWithPrompts(context: vscode.ExtensionContext): Promise<DomainConfig[]> {
	const customDomains = (await context.globalState.get<DomainConfig[]>("customDomains")) || []
	const customDomainPrompts = (await context.globalState.get<CustomDomainPrompts>("customDomainPrompts")) || {}

	const allDomains = getAllDomains(customDomains)
	return allDomains.map((domain) => ({
		...domain,
		roleDefinition: customDomainPrompts[domain.slug]?.roleDefinition ?? domain.roleDefinition,
		whenToUse: customDomainPrompts[domain.slug]?.whenToUse ?? domain.whenToUse,
		customInstructions: customDomainPrompts[domain.slug]?.customInstructions ?? domain.customInstructions,
	}))
}

// Helper function to get complete domain details with all overrides
export async function getFullDomainDetails(
	domainSlug: string,
	customDomains?: DomainConfig[],
	customDomainPrompts?: CustomDomainPrompts,
	options?: {
		cwd?: string
		globalCustomInstructions?: string
		language?: string
	},
): Promise<DomainConfig> {
	// First get the base domain config from custom domains or built-in domains
	const baseDomain =
		getDomainBySlug(domainSlug, customDomains) || domains.find((m) => m.slug === domainSlug) || domains[0]

	// Check for any prompt component overrides
	const promptComponent = customDomainPrompts?.[domainSlug]

	// Get the base custom instructions
	const baseCustomInstructions = promptComponent?.customInstructions || baseDomain.customInstructions || ""
	const baseWhenToUse = promptComponent?.whenToUse || baseDomain.whenToUse || ""

	// If we have cwd, load and combine all custom instructions
	let fullCustomInstructions = baseCustomInstructions
	if (options?.cwd) {
		fullCustomInstructions = await addCustomInstructions(
			baseCustomInstructions,
			options.globalCustomInstructions || "",
			options.cwd,
			domainSlug,
			domainSlug,
			{ language: options.language },
		)
	}

	// Return domain with any overrides applied
	return {
		...baseDomain,
		roleDefinition: promptComponent?.roleDefinition || baseDomain.roleDefinition,
		whenToUse: baseWhenToUse,
		customInstructions: fullCustomInstructions,
	}
}

// Helper function to safely get role definition
export function getRoleDefinition(domainSlug: string, customDomains?: DomainConfig[]): string {
	const domain = getDomainBySlug(domainSlug, customDomains)
	if (!domain) {
		console.warn(`No domain found for slug: ${domainSlug}`)
		return ""
	}
	return domain.roleDefinition
}

// Helper function to safely get whenToUse
export function getWhenToUse(domainSlug: string, customDomains?: DomainConfig[]): string {
	const domain = getDomainBySlug(domainSlug, customDomains)
	if (!domain) {
		console.warn(`No domain found for slug: ${domainSlug}`)
		return ""
	}
	return domain.whenToUse ?? ""
}

// Helper function to safely get custom instructions
export function getCustomInstructions(domainSlug: string, customDomains?: DomainConfig[]): string {
	const domain = getDomainBySlug(domainSlug, customDomains)
	if (!domain) {
		console.warn(`No domain found for slug: ${domainSlug}`)
		return ""
	}
	return domain.customInstructions ?? ""
}
