"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Feature } from "@/store/app-store";
import { GripVertical, Edit, CheckCircle2, Circle, Loader2, Trash2, Eye, PlayCircle, RotateCcw, StopCircle } from "lucide-react";

interface KanbanCardProps {
  feature: Feature;
  onEdit: () => void;
  onDelete: () => void;
  onViewOutput?: () => void;
  onVerify?: () => void;
  onResume?: () => void;
  onForceStop?: () => void;
  hasContext?: boolean;
  isCurrentAutoTask?: boolean;
}

export function KanbanCard({ feature, onEdit, onDelete, onViewOutput, onVerify, onResume, onForceStop, hasContext, isCurrentAutoTask }: KanbanCardProps) {
  // Disable dragging if the feature is in progress or verified
  const isDraggable = feature.status === "backlog";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: feature.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all backdrop-blur-sm border-white/10 relative",
        isDragging && "opacity-50 scale-105 shadow-lg",
        isCurrentAutoTask && "border-purple-500 border-2 shadow-purple-500/50 shadow-lg animate-pulse"
      )}
      data-testid={`kanban-card-${feature.id}`}
      {...attributes}
    >
      <CardHeader className="p-3 pb-2">
        {isCurrentAutoTask && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-purple-500/20 border border-purple-500 rounded px-2 py-0.5">
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            <span className="text-xs text-purple-400 font-medium">Running...</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <div
            {...listeners}
            className={cn(
              "mt-0.5 touch-none",
              isDraggable ? "cursor-grab" : "cursor-not-allowed opacity-50"
            )}
            data-testid={`drag-handle-${feature.id}`}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm leading-tight">
              {feature.description}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {feature.category}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {/* Steps Preview */}
        {feature.steps.length > 0 && (
          <div className="mb-3 space-y-1">
            {feature.steps.slice(0, 3).map((step, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                {feature.status === "verified" ? (
                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="w-3 h-3 mt-0.5 shrink-0" />
                )}
                <span className="truncate">{step}</span>
              </div>
            ))}
            {feature.steps.length > 3 && (
              <p className="text-xs text-muted-foreground pl-5">
                +{feature.steps.length - 3} more steps
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {isCurrentAutoTask && (
            <>
              {onViewOutput && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-xs bg-purple-600 hover:bg-purple-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOutput();
                  }}
                  data-testid={`view-output-${feature.id}`}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View Output
                </Button>
              )}
              {onForceStop && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onForceStop();
                  }}
                  data-testid={`force-stop-${feature.id}`}
                >
                  <StopCircle className="w-3 h-3 mr-1" />
                  Stop
                </Button>
              )}
            </>
          )}
          {!isCurrentAutoTask && feature.status === "in_progress" && (
            <>
              {hasContext && onResume ? (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResume();
                  }}
                  data-testid={`resume-feature-${feature.id}`}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Resume
                </Button>
              ) : onVerify ? (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerify();
                  }}
                  data-testid={`verify-feature-${feature.id}`}
                >
                  <PlayCircle className="w-3 h-3 mr-1" />
                  Implement
                </Button>
              ) : null}
              {onViewOutput && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOutput();
                  }}
                  data-testid={`view-output-inprogress-${feature.id}`}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Output
                </Button>
              )}
            </>
          )}
          {!isCurrentAutoTask && feature.status !== "in_progress" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                data-testid={`edit-feature-${feature.id}`}
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                data-testid={`delete-feature-${feature.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
