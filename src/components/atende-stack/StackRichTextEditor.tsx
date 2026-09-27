import { RichTextEditor } from '../RichTextEditor';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Editor rich text para o Stack (sem assistente IA dos Scripts). */
export function StackRichTextEditor({ value, onChange, placeholder, className }: Props) {
  return (
    <RichTextEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      hideAssistant
    />
  );
}
