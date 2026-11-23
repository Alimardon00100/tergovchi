import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
export type PaperOption = { value: string; label: string };
export function PaperSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly PaperOption[];
  onChange: (value: string) => void;
}) {
  // React controls the value; Provider omits the native form fallback.
  return (
    <span className="paper-select">
      <Select.unstable_Provider value={value} onValueChange={onChange}>
        <Select.Trigger className="paper-select-trigger" aria-label={label}>
          <Select.Value />
          <Select.Icon>
            <ChevronDown size={14} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="paper-select-content paper"
            position="popper"
            sideOffset={6}
            align="start"
          >
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item
                  className="paper-select-option"
                  key={option.value}
                  value={option.value}
                >
                  <Select.ItemIndicator>
                    <Check size={14} />
                  </Select.ItemIndicator>
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.unstable_Provider>
    </span>
  );
}
