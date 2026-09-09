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

const ARDUINO_HOVER: Record<string, string> = {
  pinMode: '`pinMode(pin, mode)` configures a digital pin as INPUT, OUTPUT, or INPUT_PULLUP.',
  digitalWrite: '`digitalWrite(pin, value)` writes HIGH or LOW to a digital pin.',
  digitalRead: '`digitalRead(pin)` reads HIGH or LOW from a digital pin.',
  analogRead: '`analogRead(pin)` samples an analog-capable input and returns the board ADC reading.',
  analogWrite: '`analogWrite(pin, value)` requests PWM/DAC-style output where supported by the selected board.',
  delay: '`delay(ms)` blocks for the requested number of milliseconds.',
  millis: '`millis()` returns elapsed milliseconds since the sketch started.',
  micros: '`micros()` returns elapsed microseconds since the sketch started.',
  attachInterrupt: '`attachInterrupt(...)` registers an interrupt service routine for a supported interrupt source.',
  Serial: '`Serial` is the primary Arduino serial interface on boards that expose it.',
  HIGH: '`HIGH` is the logical high digital level.',
  LOW: '`LOW` is the logical low digital level.',
  INPUT: '`INPUT` configures a pin as a digital input.',
  OUTPUT: '`OUTPUT` configures a pin as a digital output.',
  INPUT_PULLUP: '`INPUT_PULLUP` enables the board-supported internal pull-up resistor.',
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  diagnostics?: Array<{ line: number; column?: number; message: string; severity?: 'error' | 'warning' }>;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findDefinitionLine(model: editor.ITextModel, word: string) {
  const escaped = escapeRegExp(word);
  const definePattern = new RegExp(`^\\s*#\\s*define\\s+${escaped}\\b`);
  const declarationPattern = new RegExp(`\\b(?:void|bool|boolean|byte|char|short|int|long|float|double|String|size_t|uint\\d+_t|int\\d+_t|unsigned\\s+(?:char|short|int|long)|[A-Za-z_]\\w*)\\s+[*&\\s]*${escaped}\\s*(?:\\(|=|;|,|\\[)`);
  for (let line = 1; line <= model.getLineCount(); line += 1) {
    const text = model.getLineContent(line);
    if (!definePattern.test(text) && !declarationPattern.test(text)) continue;
    const column = text.search(new RegExp(`\\b${escaped}\\b`));
    if (column >= 0) return { line, column: column + 1 };
  }
  return null;
}

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

    monaco.languages.registerDefinitionProvider('cpp', {
      provideDefinition(model: editor.ITextModel, position: Position) {
        const current = model.getWordAtPosition(position);
        if (!current?.word) return null;
        const found = findDefinitionLine(model, current.word);
        if (!found) return null;
        return {
          uri: model.uri,
          range: new monaco.Range(found.line, found.column, found.line, found.column + current.word.length),
        };
      },
    });

    monaco.languages.registerHoverProvider('cpp', {
      provideHover(model: editor.ITextModel, position: Position) {
        const current = model.getWordAtPosition(position);
        if (!current?.word) return null;
        const documentation = ARDUINO_HOVER[current.word];
        if (!documentation) return null;
        return {
          range: new monaco.Range(position.lineNumber, current.startColumn, position.lineNumber, current.endColumn),
          contents: [{ value: `**Arduino · ${current.word}**` }, { value: documentation }],
        };
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
      stickyScroll: { enabled: true },
    }}
  />;
}
