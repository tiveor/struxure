// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiSidebar } from '../AiSidebar';
import { useChatStore } from '../../../store/chat-store';
import { useUIStore } from '../../../store/ui-store';

vi.mock('../../../utils/ai-client', () => ({
  pingServer: vi.fn().mockResolvedValue(false),
  testConnection: vi.fn(),
  chatCompletionStream: vi.fn(),
}));

beforeEach(() => {
  // jsdom has no layout, so scrollIntoView is missing.
  Element.prototype.scrollIntoView = vi.fn();
  useUIStore.setState(useUIStore.getInitialState(), true);
  useChatStore.setState({ collapsed: false, activeTab: 'local' });
  useChatStore.getState().clearMessages('local');
});

describe('AiSidebar example prompts', () => {
  it('uses imperial values in imperial mode', () => {
    useUIStore.setState({ unitSystem: 'imperial' });
    render(<AiSidebar />);
    expect(screen.getByRole('button', { name: /30ft span, 20 kip/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /kN/ })).toBeNull();
  });

  it('uses metric values in metric mode', () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<AiSidebar />);
    expect(screen.getByRole('button', { name: /9 m span, 90 kN/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /kip|ft/ })).toBeNull();
  });
});
