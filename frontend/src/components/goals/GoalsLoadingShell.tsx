"use client";

import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";

interface Props {
  title?: string;
}

export function GoalsLoadingShell({
  title = "Loading goals",
}: Props) {
  return <AppLoadingScreen fullscreen={false} title={title} />;
}
