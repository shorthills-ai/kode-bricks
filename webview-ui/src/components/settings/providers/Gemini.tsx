import { useCallback, useState, useEffect } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type GeminiProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Gemini = ({ apiConfiguration, setApiConfigurationField }: GeminiProps) => {
	const { t } = useAppTranslation()

	// Initialize local states from apiConfiguration
	const [googleGeminiBaseUrlSelected, setGoogleGeminiBaseUrlSelected] = useState(
		!!apiConfiguration?.googleGeminiBaseUrl,
	)
	const [enableCaching, setEnableCaching] = useState(!!apiConfiguration?.enableCaching)
	const [cacheKey, setCacheKey] = useState(apiConfiguration?.cacheKey || "")
	const [ttl, setTTL] = useState(apiConfiguration?.cacheTTL || "3600s")

	// Sync local state from apiConfiguration if it changes
	useEffect(() => {
		setGoogleGeminiBaseUrlSelected(!!apiConfiguration?.googleGeminiBaseUrl)
		setEnableCaching(!!apiConfiguration?.enableCaching)
		setCacheKey(apiConfiguration?.cacheKey || "")
		setTTL(apiConfiguration?.cacheTTL || "3600s")
	}, [apiConfiguration])

	// Reusable input change handler for apiConfiguration fields
	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
				// Also update local state for controlled inputs:
				if (field === "cacheKey") setCacheKey(transform(event as E) as string)
				if (field === "cacheTTL") setTTL(transform(event as E) as string)
			},
		[setApiConfigurationField],
	)

	// Handle caching checkbox toggle
	const onEnableCachingChange = useCallback(
		(checked: boolean) => {
			setEnableCaching(checked)
			setApiConfigurationField("enableCaching", checked)
			if (!checked) {
				setApiConfigurationField("cacheKey", "")
				setApiConfigurationField("cacheTTL", "3600s")
			}
		},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.geminiApiKey || ""}
				type="password"
				onInput={handleInputChange("geminiApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.geminiApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.geminiApiKey && (
				<VSCodeButtonLink href="https://ai.google.dev/" appearance="secondary">
					{t("settings:providers.getGeminiApiKey")}
				</VSCodeButtonLink>
			)}
			<div>
				<Checkbox
					checked={googleGeminiBaseUrlSelected}
					onChange={(checked: boolean) => {
						setGoogleGeminiBaseUrlSelected(checked)
						if (!checked) {
							setApiConfigurationField("googleGeminiBaseUrl", "")
						}
					}}>
					{t("settings:providers.useCustomBaseUrl")}
				</Checkbox>
				{googleGeminiBaseUrlSelected && (
					<VSCodeTextField
						value={apiConfiguration?.googleGeminiBaseUrl || ""}
						type="url"
						onInput={handleInputChange("googleGeminiBaseUrl")}
						placeholder={t("settings:defaults.geminiUrl")}
						className="w-full mt-1"
					/>
				)}
			</div>

			{/* Caching Settings */}
			<div className="mt-4">
				<Checkbox checked={enableCaching} onChange={onEnableCachingChange}>
					{t("settings:providers.enableCaching")}
				</Checkbox>
			</div>

			{enableCaching && (
				<>
					<div className="mt-2">
						<label className="text-sm font-medium">{t("settings:providers.cacheKey")}</label>
						<VSCodeTextField
							value={cacheKey}
							onInput={handleInputChange("cacheKey")}
							placeholder={t("settings:providers.cacheKeyPlaceholder")}
							className="w-full"
						/>
					</div>
					<div className="mt-2">
						<label className="text-sm font-medium">{t("settings:providers.ttl")}</label>
						<VSCodeTextField
							value={ttl}
							onInput={handleInputChange("cacheTTL")}
							placeholder={t("settings:providers.ttlPlaceholder")}
							className="w-full"
						/>
					</div>
				</>
			)}
		</>
	)
}
