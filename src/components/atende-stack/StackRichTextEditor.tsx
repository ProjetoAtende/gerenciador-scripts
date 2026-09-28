import { RichTextEditor } from '../RichTextEditor';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Preenche altura do container (modal editor completo). */
  fillHeight?: boolean;
}

/** Editor rich text para o Stack (sem assistente IA dos Scripts). */
export function StackRichTextEditor({ value, onChange, placeholder, className, fillHeight }: Props) {
  return (
    <RichTextEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      hideAssistant
      fillHeight={fillHeight}
    />
  );
}
