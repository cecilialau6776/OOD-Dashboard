export const NODE_STATE_NAME_MAP = {
  "online": "Online (In Use)",
  "idle": "Online (Idle)",
  "drained": "Drained",
  "maintenance": "Maintenance",
  "down": "Down",
}

export function getNodeState(node) {
  if (node.State.includes('DOWN')) return 'down';
  if (node.State.includes('DRAIN')) return 'drained';
  if (node.State.includes('MAINT')) return 'maintenance';

  //   (parseInt(node.GPULoad) || 0) :
  //   (parseInt(node.CPUAlloc) || 0);
  const usage = parseInt(node.CPUAlloc) || 0;

  return usage === 0 ? 'idle' : 'online';
}

export function getNodeStateName(node) {
  return NODE_STATE_NAME_MAP[getNodeState(node)];
}
