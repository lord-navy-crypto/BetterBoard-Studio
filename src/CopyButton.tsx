import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type Props = {
  text: string;
  label?: string;
  copiedLabel?: string;
  disabled?: boolean;
  className?: string;
};

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  area.style.pointerEvents = 'none';
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  if (!copied) throw new Error('Clipboard copy is unavailable in this webview.');
}

export default function CopyButton({ text, label = 'Copy', copiedLabel = 'Copied', disabled = false, className = 'ghost mini' }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleCopy() {
    if (disabled || !text) return;
    try {
      await copyText(text);
      setState('copied');
      window.setTimeout(() => setState('idle'), 1400);
    } catch {
      setState('failed');
      window.setTimeout(() => setState('idle'), 1800);
    }
  }

  const caption = state === 'copied' ? copiedLabel : state === 'failed' ? 'Copy failed' : label;
  return <button className={className} type="button" disabled={disabled || !text} onClick={() => void handleCopy()} title={state === 'failed' ? 'Clipboard API was unavailable.' : label}>
    {state === 'copied' ? <Check size={13}/> : <Copy size={13}/>} {caption}
  </button>;
}
