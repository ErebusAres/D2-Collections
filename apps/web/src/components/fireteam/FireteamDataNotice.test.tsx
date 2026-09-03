// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  FIRETEAM_BUNGIE_DATA_NOTICE,
  FireteamDataNotice
} from "./FireteamDataNotice";

afterEach(() => cleanup());

describe("FireteamDataNotice", () => {
  it("presents the Bungie data-latency notice as supporting page information", () => {
    render(<FireteamDataNotice />);

    const noticeText = screen.getByText(FIRETEAM_BUNGIE_DATA_NOTICE);
    const notice = noticeText.closest("footer");

    expect(notice).toBeTruthy();
    expect(notice?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
