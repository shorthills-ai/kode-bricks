# Domain Feature Pipeline Documentation

## Overview

The domain feature pipeline enables context-aware, domain-specific behavior throughout the Roo-Code application. Domains represent specialized areas (e.g., healthcare, automobile, manufacturing) and influence how prompts, tools, and context are handled for the user.

This document covers:

- The architecture and flow of the domain pipeline
- Key files and their responsibilities
- How to add a new domain

---

## Pipeline Architecture

### 1. Domain Definition & Configuration

- **File:** `src/shared/domains.ts`
- **Role:**
    - Defines built-in domains as `DomainConfig` objects.
    - Provides helper functions for domain lookup, selection, and merging custom domains.
    - Exports the default domain and utility functions for prompt generation and tool permission checks.

### 2. Domain Selection & UI

- **File:** `webview-ui/src/components/domains/DomainsView.tsx`
- **Role:**
    - Renders the UI for domain selection and creation.
    - Handles user interactions for switching or creating domains.
    - Sends messages to the backend to update the domain state.

### 3. Domain Switching Logic (Backend)

- **File:** `src/core/webview/ClineProvider.ts`
- **Role:**
    - Receives domain switch requests from the UI.
    - Updates the global state and notifies the current task (Cline).
    - Emits events for telemetry and posts updated state to the webview.

### 4. Programmatic Domain Switching

- **File:** `src/core/tools/switchDomainTool.ts`
- **Role:**
    - Implements a tool for programmatic domain switching.
    - Validates the requested domain, checks if a switch is needed, and triggers the switch via the provider.
    - Handles errors and provides user feedback.

### 5. Domain Context Injection (Pipeline Integration)

- **File:** `src/core/task/Task.ts`
- **Role:**
    - Integrates domain context into the task pipeline.
    - Injects relevant context (via vector retriever/embedding model) into the user prompt based on the selected domain.

### 6. Domain-Aware Prompt Generation

- **File:** `src/core/prompts/system.ts`
- **Role:**
    - Fetches domain configuration and includes domain-specific role definitions and instructions in system prompts.

### 7. Type Safety & Schema

- **File:** `packages/types/src/domains.ts`
- **Role:**
    - Defines the `DomainConfig` type and schema for validation.
    - Ensures all domains (built-in or custom) conform to the expected structure.

---

## Pipeline Flow Diagram

1. **User selects/creates a domain** (UI)
2. **UI sends domain change message** to backend
3. **Backend updates global state** and notifies current task
4. **Task pipeline injects domain context** into prompts
5. **System prompt generation** uses domain-specific instructions
6. **Tools and permissions** are filtered by domain

---

## Adding a New Domain

To add a new domain, follow these steps:

### 1. Update Domain Definitions

- **File:** `src/shared/domains.ts`
- **Action:**
    - Add a new entry to the `domains` array with the following fields:
        - `slug`: Unique identifier (e.g., "finance")
        - `name`: Display name (e.g., "💰 Finance")
        - `roleDefinition`: Description of the assistant's expertise in this domain
        - `whenToUse (Optional)`: When this domain should be used
        - `customInstructions (Optional)`: Any special instructions for this domain
        - `groups (Optional)`: List of tool groups enabled for this domain (e.g., ["read", "edit"])

<!-- ## The changes suggested below are the
### 2. (Optional) Update Domain Types
- **File:** `packages/types/src/domains.ts`
- **Action:**
  - Ensure your new domain entry matches the `DomainConfig` schema.

### 3. (Optional) Update UI
- **File:** `webview-ui/src/components/domains/DomainsView.tsx`
- **Action:**
  - The UI automatically lists all domains from the config. If you want to customize the display or add icons, update the relevant UI logic.

### 4. (Optional) Add Domain-Specific Prompts or Tools
- **Files:**
  - `src/core/prompts/system.ts` (for prompt logic)
  - `src/core/tools/` (for domain-specific tools)
- **Action:**
  - Add or update logic to provide custom prompts or enable/disable tools for your new domain.

### 5. (Optional) Add Custom Domain Context Logic
- **File:** `src/core/task/Task.ts`
- **Action:**
  - If your domain requires special context injection, update the context pipeline logic. -->

---

## Example: Adding a "Finance" Domain

1. **Edit `src/shared/domains.ts`:**
    ```ts
    export const domains: readonly DomainConfig[] = [
    	// ...existing domains...
    	{
    		slug: "finance",
    		name: "💰 Finance",
    		roleDefinition: "You are Roo, an expert in financial analysis, accounting, and fintech solutions.",
    		// whenToUse, customInstructions & groups can be kept empty
    		whenToUse: "Use this domain for tasks related to finance, accounting, or financial technology.",
    		customInstructions: "Always ensure compliance with financial regulations and data privacy.",
    		groups: ["read", "edit", "browser", "command", "mcp"],
    	},
    ]
    ```
2. **(Optional) Update types or UI as needed.**

---

## References

- `src/shared/domains.ts` — Domain definitions and helpers
- `webview-ui/src/components/domains/DomainsView.tsx` — Domain selection UI
- `src/core/webview/ClineProvider.ts` — Backend domain state management
- `src/core/tools/switchDomainTool.ts` — Programmatic domain switching
- `src/core/task/Task.ts` — Domain context injection
- `src/core/prompts/system.ts` — Domain-aware prompt generation
- `packages/types/src/domains.ts` — Domain type/schema

---
