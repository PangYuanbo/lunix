import * as Collapsible from '@radix-ui/react-collapsible';
import { CheckCircle2, ChevronDown, Circle, Clock3, Wrench, XCircle } from 'lucide-react';

const labels = {
  'approval-requested': 'Awaiting approval',
  'approval-responded': 'Approved',
  'input-streaming': 'Preparing',
  'input-available': 'Running',
  'output-available': 'Completed',
  'output-denied': 'Denied',
  'output-error': 'Error',
};

function StatusIcon({ state }) {
  if (state === 'output-available' || state === 'approval-responded') return <CheckCircle2 size={14} />;
  if (state === 'output-error' || state === 'output-denied') return <XCircle size={14} />;
  if (state === 'input-available' || state === 'approval-requested') return <Clock3 size={14} />;
  return <Circle size={14} />;
}

export function Tool({ children }) {
  return <Collapsible.Root className="ai-tool">{children}</Collapsible.Root>;
}

export function ToolHeader({ name, state }) {
  return <Collapsible.Trigger className="ai-tool-header"><span><Wrench size={15} />{name || 'Tool'}</span><span className={`ai-tool-state state-${state}`}><StatusIcon state={state} />{labels[state] || state}</span><ChevronDown size={14} /></Collapsible.Trigger>;
}

export function ToolContent({ children }) {
  return <Collapsible.Content className="ai-tool-content">{children}</Collapsible.Content>;
}

export function ToolInput({ input }) {
  if (input == null) return null;
  return <section><b>Parameters</b><pre>{typeof input === 'string' ? input : JSON.stringify(input, null, 2)}</pre></section>;
}

export function ToolOutput({ output, errorText }) {
  if (output == null && !errorText) return null;
  return <section className={errorText ? 'is-error' : ''}><b>{errorText ? 'Error' : 'Result'}</b><pre>{errorText || (typeof output === 'string' ? output : JSON.stringify(output, null, 2))}</pre></section>;
}
