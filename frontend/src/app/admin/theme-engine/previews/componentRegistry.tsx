// ─────────────────────────────────────────────────────────────────────────────
// Component pane preview registry (KDL-203, sub-task 2/3).
//
// Maps a pane's semantic id → its live component preview. Integration (KDL-205)
// merges this with KDL-202's DEVICE_PANE_PREVIEWS and mounts the result inside
// the device shell. Panes not listed here fall back to KDL-202's default shell.
// ─────────────────────────────────────────────────────────────────────────────

import type React from 'react'
import {
  AlertPreview,
  AppBarPreview,
  AssetsPreview,
  BottomNavPreview,
  ButtonPreview,
  CardPreview,
  ChipsPreview,
  CollectionsPreview,
  EmptyStatePreview,
  FabPreview,
  FormPreview,
  ImagesPreview,
  LayoutPreview,
  NavPreview,
  OnboardingPreview,
  PopupPreview,
  SideMenuPreview,
  TabBarPreview,
  TablePreview,
  TokensPreview,
  type TEPaneLite,
} from './ComponentPreviews'

export const COMPONENT_PANE_PREVIEWS: Record<
  string,
  (ctx: { pane: TEPaneLite; values: Record<string, string> }) => React.ReactNode
> = {
  // Base panes (all platforms)
  buttons: (ctx) => <ButtonPreview pane={ctx.pane} values={ctx.values} />,
  forms: (ctx) => <FormPreview pane={ctx.pane} values={ctx.values} />,
  tables: (ctx) => <TablePreview pane={ctx.pane} values={ctx.values} />,
  cards: (ctx) => <CardPreview pane={ctx.pane} values={ctx.values} />,
  popup: (ctx) => <PopupPreview pane={ctx.pane} values={ctx.values} />,
  alerts: (ctx) => <AlertPreview pane={ctx.pane} values={ctx.values} />,
  navigation: (ctx) => <NavPreview pane={ctx.pane} values={ctx.values} />,
  layout: (ctx) => <LayoutPreview pane={ctx.pane} values={ctx.values} />,
  images: (ctx) => <ImagesPreview pane={ctx.pane} values={ctx.values} />,
  // Android-specific extra panes
  bottomnav: (ctx) => <BottomNavPreview pane={ctx.pane} values={ctx.values} />,
  appbar: (ctx) => <AppBarPreview pane={ctx.pane} values={ctx.values} />,
  fab: (ctx) => <FabPreview pane={ctx.pane} values={ctx.values} />,
  chips: (ctx) => <ChipsPreview pane={ctx.pane} values={ctx.values} />,
  // iOS-specific extra panes
  tabbar: (ctx) => <TabBarPreview pane={ctx.pane} values={ctx.values} />,
  sidemenu: (ctx) => <SideMenuPreview pane={ctx.pane} values={ctx.values} />,
  collections: (ctx) => <CollectionsPreview pane={ctx.pane} values={ctx.values} />,
  // Shared Android/iOS extra panes
  emptystates: (ctx) => <EmptyStatePreview pane={ctx.pane} values={ctx.values} />,
  onboarding: (ctx) => <OnboardingPreview pane={ctx.pane} values={ctx.values} />,
  tokens: (ctx) => <TokensPreview pane={ctx.pane} values={ctx.values} />,
  assets: (ctx) => <AssetsPreview pane={ctx.pane} values={ctx.values} />,
}
