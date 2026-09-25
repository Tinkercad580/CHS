import React from "react";
import { iconPaths } from "./iconPaths";
import { EmptyState } from "./EmptyState";

/**
 * The `error` branch of a LoadState: what failed, in the server's words, and a
 * way to try again. A request that fails must never leave a skeleton standing
 * in for it (docs/LOADING_AND_MOTION.md).
 */
export function LoadError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return <EmptyState iconPath={iconPaths.alert} title={title} body={message} actionLabel={onRetry ? "Try again" : undefined} onAction={onRetry} dashed={false} />;
}
