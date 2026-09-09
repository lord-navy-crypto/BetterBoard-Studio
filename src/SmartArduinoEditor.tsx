import { useEffect, useRef } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import type { editor, Position } from 'monaco-editor';

const ARDUINO_COMPLETIONS = [
  ['setup', 'void setup() {\n\t$0\n}', 'Arduino setup entry point'],
  ['loop', 'void loop() {\n\t$0\n}', 'Arduino loop entry point'],
  ['pinMode', 'pinMode(${1:pin}, ${2:OUTPUT});', 'Configure a digital pin'],
  ['digitalWrite', 'digitalWrite(${1:pin}, ${2:HIGH});', 'Write a digital pin'],
  ['digitalRead', 'digitalRead(${1:pin})', 'Read a digital pin'],
  ['analogRead', 'analogRead(${1:A0})', 'Read an analog pin'],
  ['analogWrite', 'analogWrite(${1:pin}, ${2:value});', 'Write PWM value'],
  ['delay', 'delay(${1:1000});', 'Delay in milliseconds'],
  ['millis', 'millis()', 'Milliseconds since boot'],
  ['micros', 'micros()', 'Microseconds since boot'],
  ['Serial.begin', 'Serial.begin(${1:115200});', 'Start serial port'],
  ['Serial.print', 'Serial.print(${1:value});', 'Print to serial'],
  ['Serial.println', 'Serial.println(${1:value});', 'Print line to serial'],
  ['attachInterrupt', 'attachInterrupt(digitalPinToInterrupt(${1:pin}), ${2:isr}, ${3:RISING});', 'Attach hardware interrupt'],
] as const;

const CONSTANTS = ['HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'RISING', 'FALLING', 'CHANGE', 'LED_BUILTIN'];

type Props = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  diagnostics?: Array<{ line: number; column?: number; message: string; severity?: 'error' | 'warning' }>;
};

export default function SmartArduinoEditor({ value, onChange, readOnly = false, diagnostics = [] }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  useEffect(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) return;
    monaco.editor.setModelMarkers(model, 'betterboard', diagnostics.map(item => ({
      startLineNumber: Math.max(1, item.line),
      startColumn: Math.max(1, item.column ?? 1),
      endLineNumber: Math.max(1, item.line),
      endColumn: Math.max(2, (item.column ?? 1) + 1),
      message: item.message,
      severity: item.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
    })));
  }, [diagnostics]);

  function beforeMount(monaco: Monaco) {
    monaco.languages.registerCompletionItemProvider('cpp', {
      provideCompletionItems(model: editor.ITextModel, position: Position) {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const snippets = ARDUINO_COMPLETIONS.map(([label, insertText, documentation]) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation,
          range,
        }));
        const constants = CONSTANTS.map(label => ({
          label,
          kind: monaco.languages.CompletionItemKind.Constant,
          insertText: label,
          documentation: 'Arduino constant',
          range,
        }));
        return { suggestions: [...snippets, ...constants] };
      },
    });
  }

  return <Editor
    height="100%"
    language="cpp"
    theme="vs-dark"
    value={value}
    beforeMount={beforeMount}
    onMount={(instance, monaco) => { editorRef.current = instance; monacoRef.current = monaco; }}
    onChange={next => onChange(next ?? '')}
    options={{
      readOnly,
      automaticLayout: true,
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      bracketPairColorization: { enabled: true },
      minimap: { enabled: false },
      wordWrap: 'off',
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      tabSize: 2,
      insertSpaces: true,
      formatOnPaste: true,
      smoothScrolling: true,
      fontSize: 13,
      scrollBeyondLastLine: false,
    }}
  />;
}
