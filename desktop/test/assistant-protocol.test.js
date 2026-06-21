const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync(require.resolve('../assistant-src/protocol.js'), 'utf8');

(async () => {
  const protocol = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const known = [
    ['assistant_message', 'assistant', 'text'],
    ['assistant_pending', 'assistant', 'data-status'],
    ['session_started', 'system', 'data-status'],
    ['session_resumed', 'system', 'data-status'],
    ['session_orphaned', 'system', 'data-status'],
    ['usage_snapshot', 'system', 'data-usage'],
  ];
  known.forEach(([eventType, role, partType], index) => {
    const message = protocol.eventToUIMessage({ id: index + 1, eventType, payload: { text: 'hello' } }, index);
    assert.equal(message.role, role);
    assert.equal(message.parts[0].type, partType);
  });
  const unknown = protocol.eventToUIMessage({ eventType: 'future_event', payload: { ok: true } });
  assert.equal(unknown.parts[0].type, 'data-event');
  assert.deepEqual(unknown.parts[0].data.payload, { ok: true });
  const official = protocol.eventToUIMessage({ eventType: 'ui_message', payload: { role: 'assistant', parts: [{ type: 'reasoning', text: 'why' }, { type: 'tool-search', state: 'input-available', input: { q: 'docs' } }] } });
  assert.equal(official.parts[0].type, 'reasoning');
  assert.equal(official.parts[1].type, 'tool-search');
  assert.equal(protocol.userUIMessage('u1', 'hello').parts[0].type, 'text');
  assert.equal(protocol.streamingUIMessage('a1', 'partial').metadata.streaming, true);
  console.log('Assistant UIMessage protocol mapping ok');
})().catch((error) => { console.error(error); process.exitCode = 1; });
