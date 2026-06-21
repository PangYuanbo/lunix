import { memo } from 'react';
import { Streamdown } from 'streamdown';
import { cjk } from '@streamdown/cjk';

const plugins = { cjk };

export function Message({ from, className = '', ...props }) {
  return <div className={`ai-message is-${from} ${className}`} {...props} />;
}

export function MessageContent({ className = '', ...props }) {
  return <div className={`ai-message-content ${className}`} {...props} />;
}

export const MessageResponse = memo(function MessageResponse({ className = '', ...props }) {
  return <Streamdown className={`ai-message-response ${className}`} plugins={plugins} {...props} />;
}, (previous, next) => previous.children === next.children && previous.isAnimating === next.isAnimating);
