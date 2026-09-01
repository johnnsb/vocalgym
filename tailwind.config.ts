import type { Config } from "tailwindcss";

/**
 * Maps the VocalGym design-system tokens (app/styles/tokens.css) onto Tailwind
 * utilities, so screen-level layout glue can use `bg-canvas`, `text-text-body`,
 * `rounded-card`, `shadow-sm`, `font-serif`, `max-w-prose`, etc. The primitive
 * components in components/ui/ style themselves directly from the CSS vars.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        charcoal: "var(--charcoal)",
        ember: "var(--ember)",
        "ember-text": "var(--ember-text)",
        "ember-press": "var(--ember-press)",
        "ember-tint": "var(--ember-tint)",
        "ember-line": "var(--ember-line)",
        fog: "var(--fog)",
        parchment: "var(--parchment)",
        canvas: "var(--canvas)",
        stone: "var(--stone)",

        "text-primary": "var(--text-primary)",
        "text-body": "var(--text-body)",
        "text-muted": "var(--text-muted)",
        "text-disabled": "var(--text-disabled)",
        "text-accent": "var(--text-accent)",
        "text-inverse": "var(--text-inverse)",
        "text-inverse-muted": "var(--text-inverse-muted)",

        "surface-page": "var(--surface-page)",
        "surface-card": "var(--surface-card)",
        "surface-sunken": "var(--surface-sunken)",
        "surface-inverse": "var(--surface-inverse)",
        "surface-inverse-2": "var(--surface-inverse-2)",
        "surface-accent": "var(--surface-accent)",
        "surface-accent-tint": "var(--surface-accent-tint)",
        "surface-hover": "var(--surface-hover)",

        "border-subtle": "var(--border-subtle)",
        "border-default": "var(--border-default)",
        "border-strong": "var(--border-strong)",
        "border-accent": "var(--border-accent)",
        "border-inverse": "var(--border-inverse)",

        "status-positive": "var(--status-positive)",
        "status-positive-tint": "var(--status-positive-tint)",
        "status-critical": "var(--status-critical)",
        "status-critical-tint": "var(--status-critical-tint)",
        live: "var(--live)",

        "focus-ring": "var(--focus-ring)",
      },
      fontFamily: {
        serif: "var(--font-serif)",
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      fontSize: {
        display: [
          "var(--text-display-size)",
          {
            lineHeight: "var(--text-display-line)",
            fontWeight: "600",
            letterSpacing: "var(--text-display-tracking)",
          },
        ],
        h2: [
          "var(--text-h2-size)",
          { lineHeight: "var(--text-h2-line)", fontWeight: "500" },
        ],
        h3: [
          "var(--text-h3-size)",
          { lineHeight: "var(--text-h3-line)", fontWeight: "500" },
        ],
        h4: [
          "var(--text-h4-size)",
          { lineHeight: "var(--text-h4-line)", fontWeight: "600" },
        ],
        body: ["var(--text-body-size)", { lineHeight: "var(--text-body-line)" }],
        "body-sm": [
          "var(--text-body-sm-size)",
          { lineHeight: "var(--text-body-sm-line)" },
        ],
        label: [
          "var(--text-label-size)",
          {
            lineHeight: "var(--text-label-line)",
            fontWeight: "500",
            letterSpacing: "var(--text-label-tracking)",
          },
        ],
        caption: [
          "var(--text-caption-size)",
          { lineHeight: "var(--text-caption-line)" },
        ],
        eyebrow: [
          "var(--text-eyebrow-size)",
          {
            lineHeight: "var(--text-eyebrow-line)",
            fontWeight: "600",
            letterSpacing: "var(--text-eyebrow-tracking)",
          },
        ],
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        panel: "var(--radius-panel)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        hairline: "var(--shadow-hairline)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        "inset-sunken": "var(--shadow-inset-sunken)",
      },
      maxWidth: {
        prose: "var(--measure-prose)",
        narrow: "var(--container-narrow)",
        container: "var(--container-max)",
      },
      transitionTimingFunction: {
        settle: "var(--ease-settle)",
        out: "var(--ease-out)",
      },
      spacing: {
        section: "var(--space-11)",
        block: "var(--space-8)",
        field: "var(--space-5)",
      },
    },
  },
  plugins: [],
};

export default config;
