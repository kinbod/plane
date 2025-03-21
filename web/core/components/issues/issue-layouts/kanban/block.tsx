"use client";

import { MutableRefObject, useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { TIssue, IIssueDisplayProperties, IIssueMap } from "@plane/types";
// hooks
import { ControlLink, DropIndicator, TOAST_TYPE, Tooltip, setToast } from "@plane/ui";
import RenderIfVisible from "@/components/core/render-if-visible-HOC";
import { HIGHLIGHT_CLASS } from "@/components/issues/issue-layouts/utils";
import { cn } from "@/helpers/common.helper";
// hooks
import { useIssueDetail, useProject, useKanbanView } from "@/hooks/store";
import useOutsideClickDetector from "@/hooks/use-outside-click-detector";
import { usePlatformOS } from "@/hooks/use-platform-os";
// components
import { TRenderQuickActions } from "../list/list-view-types";
import { IssueProperties } from "../properties/all-properties";
import { WithDisplayPropertiesHOC } from "../properties/with-display-properties-HOC";
import { getIssueBlockId } from "../utils";
// ui
// types
// helper

interface IssueBlockProps {
  issueId: string;
  groupId: string;
  subGroupId: string;
  issuesMap: IIssueMap;
  displayProperties: IIssueDisplayProperties | undefined;
  draggableId: string;
  canDropOverIssue: boolean;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  canEditProperties: (projectId: string | undefined) => boolean;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
}

interface IssueDetailsBlockProps {
  cardRef: React.RefObject<HTMLElement>;
  issue: TIssue;
  displayProperties: IIssueDisplayProperties | undefined;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  isReadOnly: boolean;
}

const KanbanIssueDetailsBlock: React.FC<IssueDetailsBlockProps> = observer((props) => {
  const { cardRef, issue, updateIssue, quickActions, isReadOnly, displayProperties } = props;
  // hooks
  const { isMobile } = usePlatformOS();
  const { getProjectIdentifierById } = useProject();

  const handleEventPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <>
      <WithDisplayPropertiesHOC displayProperties={displayProperties || {}} displayPropertyKey="key">
        <div className="relative">
          <div className="line-clamp-1 text-xs text-custom-text-300">
            {getProjectIdentifierById(issue.project_id)}-{issue.sequence_id}
          </div>
          <div
            className={cn("absolute -top-1 right-0", {
              "hidden group-hover/kanban-block:block": !isMobile,
            })}
            onClick={handleEventPropagation}
          >
            {quickActions({
              issue,
              parentRef: cardRef,
            })}
          </div>
        </div>
      </WithDisplayPropertiesHOC>

      {issue?.is_draft ? (
        <Tooltip tooltipContent={issue.name} isMobile={isMobile}>
          <span>{issue.name}</span>
        </Tooltip>
      ) : (
        <div className="w-full line-clamp-1 text-sm text-custom-text-100 mb-1.5">
          <Tooltip tooltipContent={issue.name} isMobile={isMobile}>
            <span>{issue.name}</span>
          </Tooltip>
        </div>
      )}

      <IssueProperties
        className="flex flex-wrap items-center gap-2 whitespace-nowrap text-custom-text-300 pt-1.5"
        issue={issue}
        displayProperties={displayProperties}
        activeLayout="Kanban"
        updateIssue={updateIssue}
        isReadOnly={isReadOnly}
      />
    </>
  );
});

export const KanbanIssueBlock: React.FC<IssueBlockProps> = observer((props) => {
  const {
    issueId,
    groupId,
    subGroupId,
    issuesMap,
    displayProperties,
    canDropOverIssue,
    updateIssue,
    quickActions,
    canEditProperties,
    scrollableContainerRef,
  } = props;

  const cardRef = useRef<HTMLAnchorElement | null>(null);
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // hooks
  const { getIsIssuePeeked, setPeekIssue } = useIssueDetail();
  const { isMobile } = usePlatformOS();

  const handleIssuePeekOverview = (issue: TIssue) =>
    workspaceSlug &&
    issue &&
    issue.project_id &&
    issue.id &&
    !getIsIssuePeeked(issue.id) &&
    setPeekIssue({ workspaceSlug, projectId: issue.project_id, issueId: issue.id });

  const issue = issuesMap[issueId];

  const { setIsDragging: setIsKanbanDragging } = useKanbanView();

  const [isDraggingOverBlock, setIsDraggingOverBlock] = useState(false);
  const [isCurrentBlockDragging, setIsCurrentBlockDragging] = useState(false);

  const canEditIssueProperties = canEditProperties(issue?.project_id ?? undefined);

  const isDragAllowed = !issue?.tempId && canEditIssueProperties;

  useOutsideClickDetector(cardRef, () => {
    cardRef?.current?.classList?.remove(HIGHLIGHT_CLASS);
  });

  // Make Issue block both as as Draggable and,
  // as a DropTarget for other issues being dragged to get the location of drop
  useEffect(() => {
    const element = cardRef.current;

    if (!element) return;

    return combine(
      draggable({
        element,
        dragHandle: element,
        canDrag: () => isDragAllowed,
        getInitialData: () => ({ id: issue?.id, type: "ISSUE" }),
        onDragStart: () => {
          setIsCurrentBlockDragging(true);
          setIsKanbanDragging(true);
        },
        onDrop: () => {
          setIsKanbanDragging(false);
          setIsCurrentBlockDragging(false);
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => source?.data?.id !== issue?.id && canDropOverIssue,
        getData: () => ({ id: issue?.id, type: "ISSUE" }),
        onDragEnter: () => {
          setIsDraggingOverBlock(true);
        },
        onDragLeave: () => {
          setIsDraggingOverBlock(false);
        },
        onDrop: () => {
          setIsDraggingOverBlock(false);
        },
      })
    );
  }, [cardRef?.current, issue?.id, isDragAllowed, canDropOverIssue, setIsCurrentBlockDragging, setIsDraggingOverBlock]);

  if (!issue) return null;

  return (
    <>
      <DropIndicator isVisible={!isCurrentBlockDragging && isDraggingOverBlock} />
      <div
        // make Z-index higher at the beginning of drag, to have a issue drag image of issue block without any overlaps
        className={cn("group/kanban-block relative p-1.5", { "z-[1]": isCurrentBlockDragging })}
        onDragStart={() => {
          if (isDragAllowed) setIsCurrentBlockDragging(true);
          else
            setToast({
              type: TOAST_TYPE.WARNING,
              title: "Cannot move issue",
              message: "Drag and drop is disabled for the current grouping",
            });
        }}
      >
        <ControlLink
          id={getIssueBlockId(issueId, groupId, subGroupId)}
          href={`/${workspaceSlug}/projects/${issue.project_id}/${issue.archived_at ? "archives/" : ""}issues/${
            issue.id
          }`}
          ref={cardRef}
          className={cn(
            "block rounded border-[1px] outline-[0.5px] outline-transparent w-full border-custom-border-200 bg-custom-background-100 text-sm transition-all hover:border-custom-border-400",
            { "hover:cursor-pointer": isDragAllowed },
            { "border border-custom-primary-70 hover:border-custom-primary-70": getIsIssuePeeked(issue.id) },
            { "bg-custom-background-80 z-[100]": isCurrentBlockDragging }
          )}
          onClick={() => handleIssuePeekOverview(issue)}
          disabled={!!issue?.tempId || isMobile}
        >
          <RenderIfVisible
            classNames="space-y-2 px-3 py-2"
            root={scrollableContainerRef}
            defaultHeight="100px"
            horizontalOffset={50}
          >
            <KanbanIssueDetailsBlock
              cardRef={cardRef}
              issue={issue}
              displayProperties={displayProperties}
              updateIssue={updateIssue}
              quickActions={quickActions}
              isReadOnly={!canEditIssueProperties}
            />
          </RenderIfVisible>
        </ControlLink>
      </div>
    </>
  );
});

KanbanIssueBlock.displayName = "KanbanIssueBlock";
