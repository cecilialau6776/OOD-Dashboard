
export function cssBadgeForState(state){
  switch (state) {
    case 'completed':
      return 'text-bg-success';
    case 'running':
      return 'text-bg-primary'
    case 'queued':
      return 'text-bg-info';
    case 'queued_held':
      return 'text-bg-warning';
    case 'suspended':
      return 'text-bg-warning';
    default:
      return 'text-bg-warning';
  }
}

export function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
