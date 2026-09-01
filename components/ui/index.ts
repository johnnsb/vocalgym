// VocalGym design-system primitives — ported from the "VocalGym Design System"
// Claude Design project (f8a47408-…). Faithful to the DS's inline-style +
// CSS-custom-property-token approach; the tokens live in app/styles/tokens.css
// and are also mapped onto Tailwind utilities in tailwind.config.ts.
//
// Not yet ported (no current screen uses them): Dialog, Toast, Tooltip,
// SidebarNav. Add from the DS project if a feature needs them.

export { Button, type ButtonProps } from "./Button";
export { IconButton, type IconButtonProps } from "./IconButton";
export { Icon, type IconProps } from "./Icon";
export { Card, type CardProps } from "./Card";
export { Badge, type BadgeProps } from "./Badge";
export { Tag, type TagProps } from "./Tag";
export { BrandMark, type BrandMarkProps } from "./BrandMark";
export { Waveform, type WaveformProps } from "./Waveform";

export { Field, type FieldProps } from "./Field";
export { Input, type InputProps } from "./Input";
export { Textarea, type TextareaProps } from "./Textarea";
export { Select, type SelectProps } from "./Select";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export { Radio, type RadioProps } from "./Radio";
export { Switch, type SwitchProps } from "./Switch";

export { Tabs, type TabsProps } from "./Tabs";
export { Callout, type CalloutProps } from "./Callout";
