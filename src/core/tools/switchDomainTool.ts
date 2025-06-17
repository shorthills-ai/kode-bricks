import delay from "delay"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { defaultDomainSlug, getDomainBySlug } from "../../shared/domains"

export async function switchDomainTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const domain_slug: string | undefined = block.params.domain_slug
	const reason: string | undefined = block.params.reason

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "switchDomain",
				domain: removeClosingTag("domain_slug", domain_slug),
				reason: removeClosingTag("reason", reason),
			})

			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!domain_slug) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("switch_domain")
				pushToolResult(await cline.sayAndCreateMissingParamError("switch_domain", "domain_slug"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Verify the domain exists
			const targetDomain = getDomainBySlug(domain_slug)

			if (!targetDomain) {
				cline.recordToolError("switch_domain")
				pushToolResult(formatResponse.toolError(`Invalid domain: ${domain_slug}`))
				return
			}

			// Check if already in requested domain
			const currentDomain = (await cline.providerRef.deref()?.getState())?.domain ?? defaultDomainSlug

			if (currentDomain === domain_slug) {
				cline.recordToolError("switch_domain")
				pushToolResult(`Already in ${targetDomain.name} domain.`)
				return
			}

			const completeMessage = JSON.stringify({ tool: "switchDomain", domain: domain_slug, reason })
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			// Switch the domain using shared handler
			await cline.providerRef.deref()?.handleDomainSwitch(domain_slug)

			pushToolResult(
				`Successfully switched from ${getDomainBySlug(currentDomain)?.name ?? currentDomain} domain to ${
					targetDomain.name
				} domain${reason ? ` because: ${reason}` : ""}.`,
			)

			await delay(500) // Delay to allow domain change to take effect before next tool is executed

			return
		}
	} catch (error) {
		await handleError("switching domain", error)
		return
	}
}
