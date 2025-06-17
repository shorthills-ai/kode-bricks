import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { VSCodeTextArea, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Trans } from "react-i18next"
import { ChevronsUpDown, X } from "lucide-react"

import { DomainConfig } from "@roo-code/types"

import { getAllDomains } from "@roo/domains"

import { vscode } from "@src/utils/vscode"
import { buildDocLink } from "@src/utils/docLinks"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { Tab, TabContent, TabHeader } from "@src/components/common/Tab"
import {
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Command,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandItem,
	CommandGroup,
} from "@src/components/ui"

// Get all available groups that should show in prompts view

type DomainsViewProps = {
	onDone: () => void
}

// Helper to get group name regardless of format
// function getGroupName(group: GroupEntry): ToolGroup {
// 	return Array.isArray(group) ? group[0] : group
// }

const DomainsView = ({ onDone }: DomainsViewProps) => {
	const { t } = useAppTranslation()

	const { listApiConfigMeta, currentApiConfigName, domain, customInstructions, setCustomInstructions } =
		useExtensionState()

	// Use a local state to track the visually active domain
	// This prevents flickering when switching domains rapidly by:
	// 1. Updating the UI immediately when a domain is clicked
	// 2. Not syncing with the backend domain state (which would cause flickering)
	// 3. Still sending the domain change to the backend for persistence
	const [visualDomain, setVisualDomain] = useState(domain)

	// Memoize domains to preserve array order
	const domains = useMemo(() => getAllDomains(), [])

	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [selectedPromptContent, setSelectedPromptContent] = useState("")
	const [selectedPromptTitle, setSelectedPromptTitle] = useState("")
	// const [isToolsEditDomain, setIsToolsEditDomain] = useState(false)
	const [showConfigMenu, setShowConfigMenu] = useState(false)
	const [isSystemPromptDisclosureOpen, setIsSystemPromptDisclosureOpen] = useState(false)

	// State for domain selection popover and search
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const searchInputRef = useRef<HTMLInputElement>(null)

	// Direct update functions

	// Helper function to find a domain by slug
	// const findDomainBySlug = useCallback(
	// 	(searchSlug: string, domains: readonly DomainConfig[] | undefined): DomainConfig | undefined => {
	// 		return findCustomDomainBySlug(searchSlug, domains)
	// 	},
	// 	[],
	// )

	const switchDomain = useCallback((slug: string) => {
		vscode.postMessage({
			type: "domain",
			text: slug,
		})
	}, [])

	// Handle domain switching with explicit state initialization
	const handleDomainSwitch = useCallback(
		(domainConfig: DomainConfig) => {
			if (domainConfig.slug === visualDomain) return // Prevent unnecessary updates

			// Immediately update visual state for instant feedback
			setVisualDomain(domainConfig.slug)

			// Then send the domain change message to the backend
			switchDomain(domainConfig.slug)

			// Exit tools edit domain when switching domains
		},
		[visualDomain, switchDomain],
	)

	// Handler for popover open state change
	const onOpenChange = useCallback((open: boolean) => {
		setOpen(open)
		// Reset search when closing the popover
		if (!open) {
			setTimeout(() => setSearchValue(""), 100)
		}
	}, [])

	// Handler for clearing search input
	const onClearSearch = useCallback(() => {
		setSearchValue("")
		searchInputRef.current?.focus()
	}, [])

	// Helper function to get current domain's config
	const getCurrentDomain = useCallback((): DomainConfig | undefined => {
		const findDomain = (m: DomainConfig): boolean => m.slug === visualDomain
		return domains.find(findDomain)
	}, [visualDomain, domains])

	// // Helper function to safely access domain properties
	// const getDomainProperty = <T extends keyof DomainConfig>(
	// 	domain: DomainConfig | undefined,
	// 	property: T,
	// ): DomainConfig[T] | undefined => {
	// 	return domain?.[property]
	// }

	// State for create domain dialog
	// // Field-specific error states
	// const [nameError, setNameError] = useState<string>("")
	// const [slugError, setSlugError] = useState<string>("")
	// const [roleDefinitionError, setRoleDefinitionError] = useState<string>("")
	// const [groupsError, setGroupsError] = useState<string>("")

	// Helper to reset form state

	// Reset form fields when dialog opens

	// Helper function to generate a unique slug from a name
	const generateSlug = useCallback((name: string, attempt = 0): string => {
		const baseSlug = name
			.toLowerCase()
			.replace(/[^a-z0-9-]+/g, "-")
			.replace(/^-+|-+$/g, "")
		return attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`
	}, [])

	// Handler for name changes
	// const handleNameChange = useCallback(
	// 	(name: string) => {
	// 		setNewDomainName(name)
	// 		setNewDomainSlug(generateSlug(name))
	// 	},
	// 	[generateSlug],
	// )

	const isNameOrSlugTaken = useCallback(
		(name: string, slug: string) => {
			return domains.some((m) => m.slug === slug || m.name === name)
		},
		[domains],
	)

	const openCreateDomainDialog = useCallback(() => {
		const baseNamePrefix = "New Custom Domain"
		// Find unique name and slug
		let attempt = 0
		let name = baseNamePrefix
		let slug = generateSlug(name)
		while (isNameOrSlugTaken(name, slug)) {
			attempt++
			name = `${baseNamePrefix} ${attempt + 1}`
			slug = generateSlug(name)
		}
	}, [generateSlug, isNameOrSlugTaken])

	// Handle clicks outside the config menu
	useEffect(() => {
		const handleClickOutside = () => {
			if (showConfigMenu) {
				setShowConfigMenu(false)
			}
		}

		document.addEventListener("click", handleClickOutside)
		return () => document.removeEventListener("click", handleClickOutside)
	}, [showConfigMenu])

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "systemPrompt") {
				if (message.text) {
					setSelectedPromptContent(message.text)
					setSelectedPromptTitle(`System Prompt (${message.domain} domain)`)
					setIsDialogOpen(true)
				}
			}
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	return (
		<Tab>
			<TabHeader className="flex justify-between items-center">
				<h3 className="text-vscode-foreground m-0">{t("prompts:title")}</h3>
				<Button onClick={onDone}>{t("prompts:done")}</Button>
			</TabHeader>

			<TabContent>
				<div>
					<div onClick={(e) => e.stopPropagation()} className="flex justify-between items-center mb-3">
						<h3 className="text-vscode-foreground m-0">{t("prompts:domains.title")}</h3>
						<div className="flex gap-2">
							<Button
								variant="ghost"
								size="icon"
								onClick={openCreateDomainDialog}
								title={t("prompts:domains.createNewDomain")}>
								<span className="codicon codicon-add"></span>
							</Button>
							<div className="relative inline-block">
								<Button
									variant="ghost"
									size="icon"
									title={t("prompts:domains.editDomainsConfig")}
									className="flex"
									onClick={(e: React.MouseEvent) => {
										e.preventDefault()
										e.stopPropagation()
										setShowConfigMenu((prev) => !prev)
									}}
									onBlur={() => {
										// Add slight delay to allow menu item clicks to register
										setTimeout(() => setShowConfigMenu(false), 200)
									}}>
									<span className="codicon codicon-json"></span>
								</Button>
							</div>
						</div>
					</div>

					<div className="text-sm text-vscode-descriptionForeground mb-3">
						<Trans i18nKey="prompts:domains.createDomainHelpText">
							<VSCodeLink
								href={buildDocLink("basic-usage/using-domains", "prompts_view_domains")}
								style={{ display: "inline" }}></VSCodeLink>
							<VSCodeLink
								href={buildDocLink("features/custom-domains", "prompts_view_domains")}
								style={{ display: "inline" }}></VSCodeLink>
						</Trans>
					</div>

					<div className="flex items-center gap-1 mb-3">
						<Popover open={open} onOpenChange={onOpenChange}>
							<PopoverTrigger asChild>
								<Button
									variant="combobox"
									role="combobox"
									aria-expanded={open}
									className="grow justify-between"
									data-testid="domain-select-trigger">
									<div>{getCurrentDomain()?.name || t("prompts:domains.selectDomain")}</div>
									<ChevronsUpDown className="opacity-50" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
								<Command>
									<div className="relative">
										<CommandInput
											ref={searchInputRef}
											value={searchValue}
											onValueChange={setSearchValue}
											placeholder={t("prompts:domains.selectDomain")}
											className="h-9 mr-4"
											data-testid="domain-search-input"
										/>
										{searchValue.length > 0 && (
											<div className="absolute right-2 top-0 bottom-0 flex items-center justify-center">
												<X
													className="text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
													onClick={onClearSearch}
												/>
											</div>
										)}
									</div>
									<CommandList>
										<CommandEmpty>
											{searchValue && (
												<div className="py-2 px-1 text-sm">
													{t("prompts:domains.noMatchFound")}
												</div>
											)}
										</CommandEmpty>
										<CommandGroup>
											{domains
												.filter((domainConfig) =>
													searchValue
														? domainConfig.name
																.toLowerCase()
																.includes(searchValue.toLowerCase())
														: true,
												)
												.map((domainConfig) => (
													<CommandItem
														key={domainConfig.slug}
														value={domainConfig.slug}
														onSelect={() => {
															handleDomainSwitch(domainConfig)
															setOpen(false)
														}}
														data-testid={`domain-option-${domainConfig.slug}`}>
														<div className="flex items-center justify-between w-full">
															<span
																style={{
																	whiteSpace: "nowrap",
																	overflow: "hidden",
																	textOverflow: "ellipsis",
																	flex: 2,
																	minWidth: 0,
																}}>
																{domainConfig.name}
															</span>
															<span
																className="text-foreground"
																style={{
																	whiteSpace: "nowrap",
																	overflow: "hidden",
																	textOverflow: "ellipsis",
																	direction: "rtl",
																	textAlign: "right",
																	flex: 1,
																	minWidth: 0,
																	marginLeft: "0.5em",
																}}>
																{domainConfig.slug}
															</span>
														</div>
													</CommandItem>
												))}
										</CommandGroup>
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>
					</div>

					<div className="mb-3">
						<div className="font-bold mb-1">{t("prompts:apiConfiguration.title")}</div>
						<div className="mb-2">
							<Select
								value={currentApiConfigName}
								onValueChange={(value) => {
									vscode.postMessage({
										type: "loadApiConfiguration",
										text: value,
									})
								}}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={t("settings:common.select")} />
								</SelectTrigger>
								<SelectContent>
									{(listApiConfigMeta || []).map((config) => (
										<SelectItem key={config.id} value={config.name}>
											{config.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<div className="text-xs mt-1.5 text-vscode-descriptionForeground">
								{t("prompts:apiConfiguration.select")}
							</div>
						</div>
					</div>
				</div>

				<div className="pb-4 border-b border-vscode-input-border">
					<div className="flex gap-2">
						<Button
							variant="default"
							onClick={() => {
								const currentDomain = getCurrentDomain()
								if (currentDomain) {
									vscode.postMessage({
										type: "getSystemPrompt",
										domain: currentDomain.slug,
									})
								}
							}}
							data-testid="preview-prompt-button">
							{t("prompts:systemPrompt.preview")}
						</Button>
						<Button
							variant="ghost"
							size="icon"
							title={t("prompts:systemPrompt.copy")}
							onClick={() => {
								const currentDomain = getCurrentDomain()
								if (currentDomain) {
									vscode.postMessage({
										type: "copySystemPrompt",
										domain: currentDomain.slug,
									})
								}
							}}
							data-testid="copy-prompt-button">
							<span className="codicon codicon-copy"></span>
						</Button>
					</div>

					<div className="mt-4">
						<button
							onClick={() => setIsSystemPromptDisclosureOpen(!isSystemPromptDisclosureOpen)}
							className="flex items-center text-xs text-vscode-foreground hover:text-vscode-textLink-foreground focus:outline-none"
							aria-expanded={isSystemPromptDisclosureOpen}>
							<span
								className={`codicon codicon-${isSystemPromptDisclosureOpen ? "chevron-down" : "chevron-right"} mr-1`}></span>
							<span>{t("prompts:advancedSystemPrompt.title")}</span>
						</button>

						{isSystemPromptDisclosureOpen && (
							<div className="text-xs text-vscode-descriptionForeground mt-2 ml-5">
								<Trans
									i18nKey="prompts:advancedSystemPrompt.description"
									values={{
										slug: getCurrentDomain()?.slug || "code",
									}}
									components={{
										span: (
											<span
												className="text-vscode-textLink-foreground cursor-pointer underline"
												onClick={() => {
													const currentDomain = getCurrentDomain()
													if (!currentDomain) return

													vscode.postMessage({
														type: "openFile",
														text: `./.roo/system-prompt-${currentDomain.slug}`,
														values: {
															create: true,
															content: "",
														},
													})
												}}
											/>
										),
										"1": (
											<VSCodeLink
												href={buildDocLink(
													"features/footgun-prompting",
													"prompts_advanced_system_prompt",
												)}
												style={{ display: "inline" }}></VSCodeLink>
										),
										"2": <strong />,
									}}
								/>
							</div>
						)}
					</div>
				</div>

				<div className="pb-5">
					<h3 className="text-vscode-foreground mb-3">{t("prompts:globalCustomInstructions.title")}</h3>

					<div className="text-sm text-vscode-descriptionForeground mb-2">
						<Trans i18nKey="prompts:globalCustomInstructions.description">
							<VSCodeLink
								href={buildDocLink(
									"features/custom-instructions#global-custom-instructions",
									"prompts_global_custom_instructions",
								)}
								style={{ display: "inline" }}></VSCodeLink>
						</Trans>
					</div>
					<VSCodeTextArea
						resize="vertical"
						value={customInstructions || ""}
						onChange={(e) => {
							const value =
								(e as unknown as CustomEvent)?.detail?.target?.value ||
								((e as any).target as HTMLTextAreaElement).value
							setCustomInstructions(value || undefined)
							vscode.postMessage({
								type: "customInstructions",
								text: value.trim() || undefined,
							})
						}}
						rows={4}
						className="w-full"
						data-testid="global-custom-instructions-textarea"
					/>
					<div className="text-xs text-vscode-descriptionForeground mt-1.5">
						<Trans
							i18nKey="prompts:globalCustomInstructions.loadFromFile"
							components={{
								span: (
									<span
										className="text-vscode-textLink-foreground cursor-pointer underline"
										onClick={() =>
											vscode.postMessage({
												type: "openFile",
												text: "./.roo/rules/rules.md",
												values: {
													create: true,
													content: "",
												},
											})
										}
									/>
								),
							}}
						/>
					</div>
				</div>
			</TabContent>

			{isDialogOpen && (
				<div className="fixed inset-0 flex justify-end bg-black/50 z-[1000]">
					<div className="w-[calc(100vw-100px)] h-full bg-vscode-editor-background shadow-md flex flex-col relative">
						<div className="flex-1 p-5 overflow-y-auto min-h-0">
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setIsDialogOpen(false)}
								className="absolute top-5 right-5">
								<span className="codicon codicon-close"></span>
							</Button>
							<h2 className="mb-4">
								{selectedPromptTitle ||
									t("prompts:systemPrompt.title", {
										domainName: getCurrentDomain()?.name || "Code",
									})}
							</h2>
							<pre className="p-2 whitespace-pre-wrap break-words font-mono text-vscode-editor-font-size text-vscode-editor-foreground bg-vscode-editor-background border border-vscode-editor-lineHighlightBorder rounded overflow-y-auto">
								{selectedPromptContent}
							</pre>
						</div>
						<div className="flex justify-end p-3 px-5 border-t border-vscode-editor-lineHighlightBorder bg-vscode-editor-background">
							<Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
								{t("prompts:createDomainDialog.close")}
							</Button>
						</div>
					</div>
				</div>
			)}
		</Tab>
	)
}

export default DomainsView
