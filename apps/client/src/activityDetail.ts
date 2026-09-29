interface ActivityDetailInput {
  type: string;
  status: string;
  detail: string;
}

export function visibleActivityDetail(event: ActivityDetailInput) {
  if (event.type === 'inbound' || (event.type === 'ai' && event.status === 'sent')) return null;
  return event.detail.trim() || null;
}

export function visibleActivityEvents<T extends ActivityDetailInput>(events: T[]) {
  return events.filter((event) => event.type !== 'inbound');
}
