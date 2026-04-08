import { Input as UiInput } from "@/components/ui/Input";

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  autoComplete?: "email" | "password" | "username" | "off";
  keyboardType?: "default" | "email-address";
  textContentType?: "emailAddress" | "password" | "username" | "none";
};

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  autoCapitalize = "sentences",
  autoCorrect = true,
  autoComplete,
  keyboardType = "default",
  textContentType
}: Props) {
  return (
    <UiInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={secureTextEntry}
      error={error}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      autoComplete={autoComplete}
      keyboardType={keyboardType}
      textContentType={textContentType}
    />
  );
}
