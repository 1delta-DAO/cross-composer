import type { DestinationActionConfig } from "../types/destinationAction"

type ModuleType = { default?: DestinationActionConfig | DestinationActionConfig[]; actions?: DestinationActionConfig[] }

/**
 * Loads all action configs from src/lib/actions/.../config.ts and merges with static actions.
 * Each module can export:
 * - default: DestinationActionConfig | DestinationActionConfig[]
 * - actions: DestinationActionConfig[]
 */
export function getAllActions(): DestinationActionConfig[] {
    const modules = import.meta.glob<ModuleType>("./**/config.ts", { eager: true })
    const dynamic: DestinationActionConfig[] = []
    for (const key in modules) {
        const mod = modules[key]
        if (!mod) continue
        if (Array.isArray(mod.default)) {
            dynamic.push(...mod.default)
        } else if (mod.default) {
            dynamic.push(mod.default)
        }
        if (Array.isArray(mod.actions)) {
            dynamic.push(...mod.actions)
        }
    }
    return [...dynamic]
}

export function getActionsByGroup(group?: string): DestinationActionConfig[] {
    const all = getAllActions()
    if (!group) return all
    return all.filter((a) => (a as any).group === group || a.actionType === (group as any))
}
