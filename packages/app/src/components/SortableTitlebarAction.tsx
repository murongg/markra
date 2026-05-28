import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent
} from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { TitlebarActionId } from "../lib/settings/app-settings";

export type SortableTitlebarActionRenderProps = {
  actionAttributes: Partial<Omit<DraggableAttributes, "aria-pressed">>;
  actionClassName: string;
  actionListeners: Record<string, (event: SyntheticEvent<HTMLElement>) => unknown>;
  isDragging: boolean;
  itemClassName: string;
  itemStyle: CSSProperties;
  setItemRef: (element: HTMLElement | null) => void;
};

type SortableTitlebarActionProps = {
  children: (props: SortableTitlebarActionRenderProps) => ReactNode;
  disabled?: boolean;
  id: TitlebarActionId;
};

const sortableItemClassName =
  "inline-flex touch-none transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none";
const sortableActionClassName =
  "transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

export function SortableTitlebarAction({
  children,
  disabled = false,
  id
}: SortableTitlebarActionProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id, disabled });

  const actionListeners: SortableTitlebarActionRenderProps["actionListeners"] = disabled ? {} : Object.fromEntries(
    Object.entries(listeners ?? {}).map(([eventName, listener]) => {
      const actionListener = listener as (event: SyntheticEvent<HTMLElement>) => unknown;

      return [
        eventName,
        (event: SyntheticEvent<HTMLElement>) => actionListener(event)
      ];
    })
  );
  const itemStyle: CSSProperties = {
    opacity: isDragging ? 0.92 : undefined,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined
  };
  const actionAttributes: SortableTitlebarActionRenderProps["actionAttributes"] = disabled ? {} : {
    "aria-describedby": attributes["aria-describedby"],
    "aria-disabled": attributes["aria-disabled"],
    "aria-roledescription": attributes["aria-roledescription"],
    role: attributes.role,
    tabIndex: attributes.tabIndex
  };

  return children({
    actionAttributes,
    actionClassName: sortableActionClassName,
    actionListeners,
    isDragging,
    itemClassName: sortableItemClassName,
    itemStyle,
    setItemRef: setNodeRef
  });
}
