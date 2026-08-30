import React from "react"
import { useFeatureFlags } from "../hooks/useFeatureFlags"
import { EmptyState } from "./ui"

interface RequireFeatureProps {
  feature: string
  children: React.ReactNode
}

/**
 * Guards an admin route behind a feature flag. While the flag is disabled the
 * page is replaced with a friendly notice instead of rendering.
 */
export const RequireFeature: React.FC<RequireFeatureProps> = ({ feature, children }) => {
  const { isEnabled, loaded } = useFeatureFlags()

  if (!loaded) return <div className="py-10" />
  if (!isEnabled(feature)) {
    return (
      <EmptyState
        title="Feature not enabled"
        description="This module is disabled via feature flags. Enable it from the Feature Flags page to use it."
      />
    )
  }
  return <>{children}</>
}