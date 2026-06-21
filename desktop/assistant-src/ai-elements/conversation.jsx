import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import { ArrowDown } from 'lucide-react';

export function Conversation({ className = '', ...props }) {
  return <StickToBottom className={`ai-conversation ${className}`} resize="smooth" role="log" {...props} />;
}

export function ConversationContent({ className = '', ...props }) {
  return <StickToBottom.Content className={`ai-conversation-content ${className}`} {...props} />;
}

export function ConversationScrollButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return <button className="ai-scroll-button" onClick={() => scrollToBottom()} aria-label="Scroll to latest"><ArrowDown size={15} /></button>;
}
