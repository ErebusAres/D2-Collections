// @vitest-environment jsdom
import type { BuildLink } from "@guardian-nexus/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BuildLinkActions, serviceIconSource } from "./BuildLinkActions";

afterEach(cleanup);

describe("BuildLinkActions", () => {
  it("uses self-hosted service favicons for known build services", () => {
    const links: BuildLink[] = [
      { kind: "youtube", label: "Video", url: "https://youtube.com/watch?v=test" },
      { kind: "twitch", label: "Stream", url: "https://twitch.tv/guardian" },
      { kind: "dim", label: "Open in DIM", url: "https://app.destinyitemmanager.com/optimizer" },
      { kind: "mobalytics", label: "Guide", url: "https://mobalytics.gg/destiny-2/builds/test" },
    ];
    render(<BuildLinkActions links={links} />);

    expect(screen.getByLabelText("Open Video").querySelector("img")?.getAttribute("src")).toBe("/icons/services/youtube.ico");
    expect(screen.getByLabelText("Open Stream").querySelector("img")?.getAttribute("src")).toBe("/icons/services/twitch.ico");
    expect(screen.getByLabelText("Open Open in DIM").querySelector("img")?.getAttribute("src")).toBe("/icons/services/dim.ico");
    expect(screen.getByLabelText("Open Guide").querySelector("img")?.getAttribute("src")).toBe("/icons/services/mobalytics.ico");
  });

  it("uses a source site's favicon and falls back to a globe if it cannot load", () => {
    const link: BuildLink = { kind: "source", label: "Patch notes", url: "https://www.bungie.net/7/en/News" };
    expect(serviceIconSource(link)).toBe("https://www.bungie.net/favicon.ico");
    render(<BuildLinkActions links={[link]} />);
    fireEvent.error(screen.getByLabelText("Open Patch notes").querySelector("img")!);
    expect(screen.getByLabelText("Open Patch notes").querySelector("svg")).not.toBeNull();
  });
});
