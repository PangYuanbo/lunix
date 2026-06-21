import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle, BarChart3, CheckCircle2, Info, LoaderCircle, RotateCcw, Square } from 'lucide-react';
import { Conversation, ConversationContent, ConversationScrollButton } from './ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from './ai-elements/message';
import { Reasoning, ReasoningContent, ReasoningTrigger } from './ai-elements/reasoning';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from './ai-elements/tool';
import { eventsToUIMessages, streamingUIMessage, userUIMessage } from './protocol';
import './styles.css';

function DataCard({ part }) {
  const data = part.data || {};
  if (part.type === 'data-usage') return <div className="ai-data-card"><BarChart3 size={15} /><div><b>Usage</b><pre>{JSON.stringify(data, null, 2)}</pre></div></div>;
  if (part.type === 'data-event') return <details className="ai-data-card"><summary><Info size={15} />{data.eventType}</summary><pre>{JSON.stringify(data.payload, null, 2)}</pre></details>;
  const Icon = data.tone === 'success' ? CheckCircle2 : data.tone === 'warning' ? AlertCircle : data.tone === 'working' ? LoaderCircle : Info;
  return <div className={`ai-status-card tone-${data.tone || 'info'}`}><Icon size={15} className={data.tone === 'working' ? 'spin' : ''} /><div><b>{data.title}</b>{data.detail && <span>{data.detail}</span>}</div></div>;
}

function Part({ part, streaming }) {
  if (part.type === 'text') return <MessageResponse isAnimating={streaming}>{part.text}</MessageResponse>;
  if (part.type === 'reasoning') return <Reasoning isStreaming={part.state === 'streaming'}><ReasoningTrigger isStreaming={part.state === 'streaming'} /><ReasoningContent>{part.text || ''}</ReasoningContent></Reasoning>;
  if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
    const name = part.type === 'dynamic-tool' ? part.toolName : part.type.slice(5);
    return <Tool><ToolHeader name={name} state={part.state} /><ToolContent><ToolInput input={part.input} /><ToolOutput output={part.output} errorText={part.errorText} /></ToolContent></Tool>;
  }
  if (part.type === 'source-url') return <a className="ai-source" href={part.url} target="_blank" rel="noreferrer">{part.title || part.url}</a>;
  if (part.type === 'source-document') return <div className="ai-source">{part.title || part.filename || 'Source document'}</div>;
  if (part.type === 'file') return <a className="ai-file" href={part.url} target="_blank" rel="noreferrer">{part.filename || part.mediaType || 'Attachment'}</a>;
  if (part.type === 'step-start') return <div className="ai-step-divider" />;
  if (part.type.startsWith('data-')) return <DataCard part={part} />;
  return <DataCard part={{ type: 'data-event', data: { eventType: part.type, payload: part } }} />;
}

function App({ store }) {
  const [snapshot, setSnapshot] = useState(store.snapshot);
  useEffect(() => store.subscribe(setSnapshot), [store]);
  const messages = useMemo(() => snapshot.messages, [snapshot.messages]);
  return <Conversation><ConversationContent className={snapshot.loading ? 'is-loading' : ''}>
    {!messages.length && !snapshot.busy && <div className="ai-empty"><span>✦</span><b>What can I help you build?</b><p>Describe a task and the agent works in your workspace.</p></div>}
    {messages.map((message) => <Message from={message.role} key={message.id}>
      <MessageContent>{message.parts.map((part, index) => <Part key={`${part.type}-${index}`} part={part} streaming={Boolean(message.metadata?.streaming)} />)}</MessageContent>
    </Message>)}
    {snapshot.task && <div className={`ai-task-state is-${snapshot.task.tone || 'working'}`} role="status" aria-live="polite">
      <div className="ai-task-state-copy">{snapshot.task.tone === 'warning' ? <AlertCircle size={16} /> : <LoaderCircle className="spin" size={16} />}<div><b>{snapshot.task.title}</b><span>{snapshot.task.detail}</span></div><time>{snapshot.task.elapsed}</time></div>
      {snapshot.task.actions && <div className="ai-task-actions"><button onClick={snapshot.task.onReconnect}><RotateCcw size={13} />Reconnect</button><button onClick={snapshot.task.onStop}><Square size={12} />Stop</button></div>}
    </div>}
  </ConversationContent>{snapshot.loading && <div className="ai-loading" role="status" aria-live="polite">
    <div className="ai-loading-card"><LoaderCircle className="spin" size={18} /><div><b>{snapshot.loading.title}</b><span>{snapshot.loading.detail}</span></div></div>
    <div className="ai-skeleton"><i /><i /><i /><i /></div>
  </div>}<ConversationScrollButton /></Conversation>;
}

function createStore() {
  let snapshot = { messages: [], busy: false, loading: null, task: null };
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener(snapshot));
  return {
    get snapshot() { return snapshot; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setMessages(messages) { snapshot = { ...snapshot, messages }; emit(); },
    append(message) { snapshot = { ...snapshot, messages: [...snapshot.messages, message] }; emit(); },
    upsert(message) { const messages = snapshot.messages.filter((item) => item.id !== message.id); snapshot = { ...snapshot, messages: [...messages, message] }; emit(); },
    remove(id) { snapshot = { ...snapshot, messages: snapshot.messages.filter((item) => item.id !== id) }; emit(); },
    setBusy(busy) { snapshot = { ...snapshot, busy }; emit(); },
    setLoading(loading) { snapshot = { ...snapshot, loading }; emit(); },
    setTask(task) { snapshot = { ...snapshot, task }; emit(); },
  };
}

window.LunixAssistant = {
  mount(element) {
    const store = createStore();
    const root = createRoot(element);
    root.render(<App store={store} />);
    return {
      setEvents: (events) => store.setMessages(eventsToUIMessages(events)),
      setMessages: store.setMessages,
      addUser: (id, value) => store.append(userUIMessage(id, value)),
      stream: (id, value, preview) => store.upsert(streamingUIMessage(id, value, preview)),
      finish: (id, value) => { store.remove(`stream-${id}`); store.upsert({ id, role: 'assistant', parts: [{ type: 'text', text: value }] }); },
      add: store.upsert,
      setBusy: store.setBusy,
      setLoading: store.setLoading,
      setTask: store.setTask,
      destroy: () => root.unmount(),
    };
  },
  eventsToUIMessages,
};
