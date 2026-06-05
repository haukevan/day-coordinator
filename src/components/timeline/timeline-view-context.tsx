"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";

type TimelineViewMode = "list" | "gantt";

interface TimelineViewContextValue {
  view: TimelineViewMode;
  setView: (view: TimelineViewMode) => void;
  /** Incremented each time the toolbar requests the create-task panel */
  createPanelTrigger: number;
  openCreatePanel: () => void;
}

const TimelineViewContext = createContext<TimelineViewContextValue | null>(
  null,
);

export function TimelineViewProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();

  // Initialize from URL on mount, then drive from local state
  const [view, setViewState] = useState<TimelineViewMode>(() => {
    const fromUrl = searchParams.get("view");
    return fromUrl === "gantt" ? "gantt" : "list";
  });

  const setView = useCallback((newView: TimelineViewMode) => {
    setViewState(newView);
    const url = new URL(window.location.href);
    url.searchParams.set("view", newView);
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search,
    );
  }, []);

  // Panel trigger — incremented each time toolbar requests create panel.
  // TimelineView watches this counter to open the slide-in form instantly.
  const [createPanelTrigger, setCreatePanelTrigger] = useState(0);
  const openCreatePanel = useCallback(() => {
    setCreatePanelTrigger((n) => n + 1);
  }, []);

  // Keep view in sync if URL changes externally (e.g. back/forward)
  useEffect(() => {
    const fromUrl = searchParams.get("view");
    if (fromUrl === "gantt" || fromUrl === "list") {
      setViewState(fromUrl);
    }
  }, [searchParams]);

  return (
    <TimelineViewContext.Provider
      value={{ view, setView, createPanelTrigger, openCreatePanel }}
    >
      {children}
    </TimelineViewContext.Provider>
  );
}

export function useTimelineView() {
  const ctx = useContext(TimelineViewContext);
  if (!ctx) {
    return {
      view: "list" as TimelineViewMode,
      setView: () => {},
      createPanelTrigger: 0,
      openCreatePanel: () => {},
    };
  }
  return ctx;
}
