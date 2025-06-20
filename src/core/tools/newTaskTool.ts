import delay from "delay"

import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { Task } from "../task/Task"
import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import { defaultDomainSlug, getDomainBySlug } from "../../shared/domains"
import { formatResponse } from "../prompts/responses"

export async function newTaskTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const mode: string | undefined = block.params.mode
	const domain: string | undefined = block.params.domain
	const message: string | undefined = block.params.message

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "newTask",
				mode: removeClosingTag("mode", mode),
				domain: removeClosingTag("domain", domain),
				message: removeClosingTag("message", message),
			})

			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!mode) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("new_task")
				pushToolResult(await cline.sayAndCreateMissingParamError("new_task", "mode"))
				return
			}

			if (!domain) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("new_task")
				pushToolResult(await cline.sayAndCreateMissingParamError("new_task", "domain"))
				return
			}

			if (!message) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("new_task")
				pushToolResult(await cline.sayAndCreateMissingParamError("new_task", "message"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Verify the mode exists
			const targetMode = getModeBySlug(mode, (await cline.providerRef.deref()?.getState())?.customModes)

			if (!targetMode) {
				pushToolResult(formatResponse.toolError(`Invalid mode: ${mode}`))
				return
			}

			const toolMessage = JSON.stringify({
				tool: "newTask",
				mode: targetMode.name,
				domain: getDomainBySlug(domain)?.name ?? domain,
				content: message,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			const provider = cline.providerRef.deref()

			if (!provider) {
				return
			}

			if (cline.enableCheckpoints) {
				cline.checkpointSave(true)
			}

			// Preserve the current mode so we can resume with it later.
			cline.pausedModeSlug = (await provider.getState()).mode ?? defaultModeSlug
			cline.pausedDomainSlug = (await provider.getState()).domain ?? defaultDomainSlug

			// Switch mode first, then create new task instance.
			await provider.handleModeSwitch(mode)
			await provider.handleDomainSwitch(domain)

			// Delay to allow mode change to take effect before next tool is executed.
			await delay(1000)

			const newCline = await provider.initClineWithTask(message, undefined, cline)
			cline.emit("taskSpawned", newCline.taskId)

			pushToolResult(
				`Successfully created new task in ${targetMode.name} mode with message: ${message} and domain: ${domain}`,
			)

			// Set the isPaused flag to true so the parent
			// task can wait for the sub-task to finish.
			cline.isPaused = true
			cline.emit("taskPaused")

			return
		}
	} catch (error) {
		await handleError("creating new task", error)
		return
	}
}
