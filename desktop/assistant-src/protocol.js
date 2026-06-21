const text = (value) => typeof value === 'string' ? value : '';
const id = (event, index) => String(event.id || event.uuid || event.sourceUuid || `${event.eventType || 'event'}-${event.createdAt || index}`);

export function eventToUIMessage(event, index = 0) {
  const payload = event.payload || {};
  const eventId = id(event, index);
  if (Array.isArray(payload.parts)) {
    return { id: eventId, role: payload.role || 'assistant', parts: payload.parts, metadata: payload.metadata };
  }
  switch (event.eventType) {
    case 'assistant_message':
      return { id: eventId, role: 'assistant', parts: [{ type: 'text', text: text(payload.text) }], metadata: { createdAt: event.createdAt, sourceUuid: payload.sourceUuid } };
    case 'assistant_pending':
      return { id: eventId, role: 'assistant', parts: [{ type: 'data-status', data: { tone: 'working', title: 'Agent is working', detail: text(payload.note) } }] };
    case 'session_started':
      return { id: eventId, role: 'system', parts: [{ type: 'data-status', data: { tone: 'success', title: 'Session started', detail: payload.provider ? `${payload.provider} runtime is ready` : '' } }] };
    case 'session_resumed':
      return { id: eventId, role: 'system', parts: [{ type: 'data-status', data: { tone: 'success', title: 'Session resumed', detail: text(payload.note) } }] };
    case 'session_orphaned':
      return { id: eventId, role: 'system', parts: [{ type: 'data-status', data: { tone: 'warning', title: 'Session disconnected', detail: text(payload.reason || payload.note) } }] };
    case 'usage_snapshot':
      return { id: eventId, role: 'system', parts: [{ type: 'data-usage', data: payload }] };
    default:
      return { id: eventId, role: 'system', parts: [{ type: 'data-event', data: { eventType: event.eventType || 'event', payload } }] };
  }
}

export function eventsToUIMessages(events = []) {
  return events.map(eventToUIMessage).filter((message) => message.parts.some((part) => part.type !== 'text' || part.text));
}

export function userUIMessage(id, value) {
  return { id, role: 'user', parts: [{ type: 'text', text: value }] };
}

export function streamingUIMessage(id, value, preview = false) {
  return { id: `stream-${id}`, role: 'assistant', parts: [{ type: 'text', text: value, state: 'streaming' }], metadata: { streaming: true, preview } };
}

export function agentEventUIMessage(event) {
  const eventId = String(event.id || `${event.type}-${Date.now()}`);
  if (event.type === 'reasoning') {
    return { id: `agent-${eventId}`, role: 'assistant', parts: [{ type: 'reasoning', text: text(event.text), state: event.state === 'streaming' ? 'streaming' : 'done' }] };
  }
  if (event.type === 'tool') {
    return {
      id: `agent-${eventId}`,
      role: 'assistant',
      parts: [{
        type: 'dynamic-tool',
        toolCallId: event.toolCallId,
        toolName: text(event.name) || 'Tool',
        state: event.state || 'input-available',
        input: event.input,
        output: event.output,
        errorText: event.errorText,
      }],
    };
  }
  if (event.type === 'usage') {
    return { id: `agent-${eventId}`, role: 'system', parts: [{ type: 'data-usage', data: event.usage || {} }] };
  }
  return { id: `agent-${eventId}`, role: 'system', parts: [{ type: 'data-event', data: { eventType: event.type || 'agent_event', payload: event } }] };
}
