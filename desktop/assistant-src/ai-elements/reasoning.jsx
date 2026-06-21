import * as Collapsible from '@radix-ui/react-collapsible';
import { Brain, ChevronDown } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { cjk } from '@streamdown/cjk';

const plugins = { cjk };

export function Reasoning({ isStreaming, children }) {
  return <Collapsible.Root className="ai-reasoning" defaultOpen={Boolean(isStreaming)}>{children}</Collapsible.Root>;
}

export function ReasoningTrigger({ isStreaming }) {
  return <Collapsible.Trigger className="ai-reasoning-trigger"><Brain size={15} /><span>{isStreaming ? 'Thinking…' : 'Reasoning'}</span><ChevronDown size={14} /></Collapsible.Trigger>;
}

export function ReasoningContent({ children }) {
  return <Collapsible.Content className="ai-reasoning-content"><Streamdown plugins={plugins}>{children}</Streamdown></Collapsible.Content>;
}
