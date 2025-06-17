import { z } from "zod"

import { toolGroupsSchema } from "./tool.js"

/**
 * GroupOptions
 */

const groupOptionsSchema = z.object({
	fileRegex: z
		.string()
		.optional()
		.refine(
			(pattern) => {
				if (!pattern) {
					return true // Optional, so empty is valid.
				}

				try {
					new RegExp(pattern)
					return true
				} catch {
					return false
				}
			},
			{ message: "Invalid regular expression pattern" },
		),
	description: z.string().optional(),
})

/**
 * GroupEntry
 */

const groupEntrySchema = z.union([toolGroupsSchema, z.tuple([toolGroupsSchema, groupOptionsSchema])])

// type GroupEntry = z.infer<typeof groupEntrySchema>

/**
 * DomainConfig
 */

/**
 * Built-in domain slugs:
 * - code: General software engineering
 * - architect: Technical planning
 * - ask: Q&A
 * - debug: Debugging
 * - orchestrator: Workflow orchestration
 * - healthcare: Healthcare technology and medical data
 * - automobile: Automotive industry and vehicle systems
 * - manufacturing: Manufacturing, automation, and supply chain
 */

const groupEntryArraySchema = z.array(groupEntrySchema).refine(
	(groups) => {
		const seen = new Set()

		return groups.every((group) => {
			const groupName = Array.isArray(group) ? group[0] : group

			if (seen.has(groupName)) {
				return false
			}

			seen.add(groupName)
			return true
		})
	},
	{ message: "Duplicate groups are not allowed" },
)

export const domainConfigSchema = z.object({
	slug: z.string().regex(/^[a-zA-Z0-9-]+$/, "Slug must contain only letters numbers and dashes"),
	name: z.string().min(1, "Name is required"),
	roleDefinition: z.string().min(1, "Role definition is required"),
	whenToUse: z.string().optional(),
	customInstructions: z.string().optional(),
	groups: groupEntryArraySchema,
	source: z.enum(["global", "project"]).optional(),
})

export type DomainConfig = z.infer<typeof domainConfigSchema>

/**
 * CustomDomainsSettings
 */

export const customDomainsSettingsSchema = z.object({
	customDomains: z.array(domainConfigSchema).refine(
		(domains) => {
			const slugs = new Set()

			return domains.every((domain) => {
				if (slugs.has(domain.slug)) {
					return false
				}

				slugs.add(domain.slug)
				return true
			})
		},
		{
			message: "Duplicate domain slugs are not allowed",
		},
	),
})

export type CustomDomainsSettings = z.infer<typeof customDomainsSettingsSchema>

/**
 * PromptComponent
 */

const promptComponentSchema = z.object({
	roleDefinition: z.string().optional(),
	whenToUse: z.string().optional(),
	customInstructions: z.string().optional(),
})

// type PromptComponent = z.infer<typeof promptComponentSchema>

/**
 * CustomDomainPrompts
 */

export const customDomainPromptsSchema = z.record(z.string(), promptComponentSchema.optional())

export type CustomDomainPrompts = z.infer<typeof customDomainPromptsSchema>
