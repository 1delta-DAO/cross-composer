import type { ActionDefinition } from "./actionDefinitions"

const registeredActions: ActionDefinition[] = []

export function registerAction(action: ActionDefinition) {
  if (registeredActions.find((a) => a.id === action.id)) {
    console.warn(`Action ${action.id} is already registered`)
    return
  }
  registeredActions.push(action)
}

export function getRegisteredActions(): ActionDefinition[] {
  return [...registeredActions]
}

export function clearRegisteredActions() {
  registeredActions.length = 0
}
