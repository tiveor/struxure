// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiKeyField } from '../ApiKeyField';
import { useChatStore } from '../../../store/chat-store';

describe('ApiKeyField', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useChatStore.getState().setApiKeyStorage('session');
    useChatStore.getState().updateSettings({ onlineApiKey: '' });
  });

  it('warns where the key is stored, tied to the key input', () => {
    render(<ApiKeyField placeholder="sk-..." />);

    const input = screen.getByLabelText('API Key');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAccessibleDescription(/session storage until you close this tab/i);
    expect(screen.getByRole('note')).toHaveTextContent(/any script running on this site can read it/i);
  });

  it('defaults to this tab only and updates the warning when the mode changes', async () => {
    render(<ApiKeyField placeholder="sk-..." />);

    expect(screen.getByRole('radio', { name: 'This tab only' })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: 'Remember on this device' }));
    expect(useChatStore.getState().apiKeyStorage).toBe('device');
    expect(screen.getByRole('note')).toHaveTextContent(/local storage on this device/i);

    await userEvent.click(screen.getByRole('radio', { name: "Don't store" }));
    expect(useChatStore.getState().apiKeyStorage).toBe('memory');
    expect(screen.getByRole('note')).toHaveTextContent(/memory only/i);
  });

  it('stores a typed key in session storage, not local storage', async () => {
    render(<ApiKeyField placeholder="sk-..." />);

    await userEvent.type(screen.getByLabelText('API Key'), 'sk-abc');

    expect(sessionStorage.getItem('struxure-ai-key')).toBe('sk-abc');
    const localValues = Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i)!));
    expect(localValues.join('\n')).not.toContain('sk-abc');
  });
});
