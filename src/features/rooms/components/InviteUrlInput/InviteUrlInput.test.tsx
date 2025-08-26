import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";
import { InviteUrlInput } from "./index";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { beforeEach } from "node:test";
import { describe } from "node:test";

// Mock window.location.href
delete (window as any).location;
window.location = { href: "" } as any;

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    readText: vi.fn(),
  },
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("InviteUrlInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = "";
  });

  it("renders correctly", () => {
    renderWithRouter(<InviteUrlInput />);
    
    expect(screen.getByText("Join with Invite URL")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste invite URL...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });

  it("shows error when submitting empty input", async () => {
    renderWithRouter(<InviteUrlInput />);
    
    const submitButton = screen.getByRole("button", { name: "Go" });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText("Please enter an invite URL")).toBeInTheDocument();
    });
  });

  it("navigates to full invite URL", async () => {
    renderWithRouter(<InviteUrlInput />);
    
    const input = screen.getByPlaceholderText("Paste invite URL...");
    const submitButton = screen.getByRole("button", { name: "Go" });
    
    const inviteUrl = "https://example.com/invite/room123?role=band_member";
    fireEvent.change(input, { target: { value: inviteUrl } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(window.location.href).toBe(inviteUrl);
    });
  });

  it("navigates to invite URL without query params", async () => {
    renderWithRouter(<InviteUrlInput />);
    
    const input = screen.getByPlaceholderText("Paste invite URL...");
    const submitButton = screen.getByRole("button", { name: "Go" });
    
    const inviteUrl = "https://example.com/invite/room456";
    fireEvent.change(input, { target: { value: inviteUrl } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(window.location.href).toBe(inviteUrl);
    });
  });

  it("shows error for invalid URL format", async () => {
    renderWithRouter(<InviteUrlInput />);
    
    const input = screen.getByPlaceholderText("Paste invite URL...");
    const submitButton = screen.getByRole("button", { name: "Go" });
    
    fireEvent.change(input, { target: { value: "invalid-url-format" } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText("Invalid invite URL format")).toBeInTheDocument();
    });
  });

  it("shows error for non-invite URL", async () => {
    renderWithRouter(<InviteUrlInput />);
    
    const input = screen.getByPlaceholderText("Paste invite URL...");
    const submitButton = screen.getByRole("button", { name: "Go" });
    
    fireEvent.change(input, { target: { value: "https://example.com/room/room123" } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText("Invalid invite URL format")).toBeInTheDocument();
    });
  });

  it("shows error for invalid role parameter", async () => {
    renderWithRouter(<InviteUrlInput />);
    
    const input = screen.getByPlaceholderText("Paste invite URL...");
    const submitButton = screen.getByRole("button", { name: "Go" });
    
    fireEvent.change(input, { target: { value: "https://example.com/invite/room123?role=invalid_role" } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText("Invalid invite URL format")).toBeInTheDocument();
    });
  });

  it("accepts valid role parameters", async () => {
    renderWithRouter(<InviteUrlInput />);
    
    const input = screen.getByPlaceholderText("Paste invite URL...");
    const submitButton = screen.getByRole("button", { name: "Go" });
    
    // Test band_member role
    const bandMemberUrl = "https://example.com/invite/room123?role=band_member";
    fireEvent.change(input, { target: { value: bandMemberUrl } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(window.location.href).toBe(bandMemberUrl);
    });
  });

  it("handles paste from clipboard", async () => {
    const mockClipboardText = "https://example.com/invite/clipboard-room?role=audience";
    vi.mocked(navigator.clipboard.readText).mockResolvedValue(mockClipboardText);
    
    renderWithRouter(<InviteUrlInput />);
    
    const pasteButton = screen.getByRole("button", { name: "📋" });
    fireEvent.click(pasteButton);
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText("Paste invite URL...") as HTMLInputElement;
      expect(input.value).toBe(mockClipboardText);
    });
  });

  it("clears error when input changes", async () => {
    renderWithRouter(<InviteUrlInput />);
    
    const input = screen.getByPlaceholderText("Paste invite URL...");
    const submitButton = screen.getByRole("button", { name: "Go" });
    
    // First, trigger an error
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText("Please enter an invite URL")).toBeInTheDocument();
    });
    
    // Then change input to clear error
    fireEvent.change(input, { target: { value: "https://example.com/invite/room123" } });
    
    await waitFor(() => {
      expect(screen.queryByText("Please enter an invite URL")).not.toBeInTheDocument();
    });
  });
});