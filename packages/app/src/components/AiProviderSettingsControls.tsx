import type { ReactNode } from "react";
import { Button, Field, Select, Switch, Textarea, TextInput } from "@markra/ui";

export function AiSettingsTextField({
  label,
  onChange,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => unknown;
  type?: "password" | "text";
  value: string;
}) {
  return (
    <Field label={label}>
      <TextInput
        type={type}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </Field>
  );
}

export function AiSettingsTextAreaField({
  description,
  label,
  onChange,
  value
}: {
  description?: string;
  label: string;
  onChange: (value: string) => unknown;
  value: string;
}) {
  return (
    <Field label={label} description={description}>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </Field>
  );
}

export function AiSettingsSelectField<TValue extends string>({
  children,
  label,
  onChange,
  value
}: {
  children: ReactNode;
  label: string;
  onChange: (value: TValue) => unknown;
  value: TValue;
}) {
  return (
    <Field label={label}>
      <Select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as TValue)}
      >
        {children}
      </Select>
    </Field>
  );
}

export function AiSettingsSection({ children, label }: { children: ReactNode; label: string }) {
  const sectionId = `ai-settings-section-${label.replace(/\s+/g, "-")}`;

  return (
    <section className="settings-section mb-8 last:mb-0" aria-labelledby={sectionId}>
      <h3 className="m-0 mb-3 text-[12px] leading-5 font-bold tracking-normal text-(--text-secondary)" id={sectionId}>
        {label}
      </h3>
      {children}
    </section>
  );
}

export function AiProviderSwitch({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: () => unknown;
}) {
  return (
    <Switch checked={checked} label={label} onCheckedChange={onChange} />
  );
}

export function AiSettingsActionButton({
  children,
  disabled,
  label,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => unknown;
}) {
  return (
    <Button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
