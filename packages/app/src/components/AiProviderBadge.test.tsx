import { render, screen } from "@testing-library/react";
import type { AiProviderConfig } from "@markra/providers";
import { AiProviderBadge } from "./AiProviderBadge";

function provider(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    enabled: true,
    id: "mock-provider",
    models: [],
    name: "gap provider",
    type: "openai-compatible",
    ...overrides
  };
}

describe("AiProviderBadge", () => {
  it("uses safe line height for fallback provider initials", () => {
    render(<AiProviderBadge provider={provider()} translate={(key) => key} />);

    expect(screen.getByText("ga")).toHaveClass("leading-4");
  });
});
