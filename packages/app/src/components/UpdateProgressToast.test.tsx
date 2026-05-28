import { render, screen } from "@testing-library/react";
import { UpdateProgressToast } from "./UpdateProgressToast";

describe("UpdateProgressToast", () => {
  it("renders determinate update download progress", () => {
    const { container } = render(
      <UpdateProgressToast message="Downloading Markra 0.0.7 (42%)." progress={42} />
    );

    expect(screen.getByText("Downloading Markra 0.0.7 (42%).")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Downloading Markra 0.0.7 (42%)." })).toHaveAttribute(
      "aria-valuenow",
      "42"
    );
    expect(container.querySelector(".app-update-progress-bar-value")).toHaveStyle({ width: "42%" });
  });

  it("renders indeterminate update download progress without a known content length", () => {
    const { container } = render(
      <UpdateProgressToast message="Downloading Markra 0.0.7..." progress={null} />
    );

    expect(screen.getByRole("progressbar", { name: "Downloading Markra 0.0.7..." })).not.toHaveAttribute("aria-valuenow");
    expect(container.querySelector(".app-update-progress-bar-value")).toHaveClass("w-1/3", "animate-pulse");
  });
});
