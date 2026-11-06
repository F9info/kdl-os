'use client'

import { Save, RotateCcw, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PLATFORMS } from './constants'
import { FieldSections } from './FieldSections'
import { PaneSidebar } from './PaneSidebar'
import { PreviewFrame } from './PreviewFrame'
import { useThemeEngineActions } from './useThemeEngineActions'
import { useThemeEngineState } from './useThemeEngineState'

export function AdvancedThemeEditor() {
  const state = useThemeEngineState()
  const { handleSave, isSaving, isResetting, resetMutation, takeoverMutation } =
    useThemeEngineActions(state)
  const {
    platform,
    setPlatform,
    activePane,
    setActivePane,
    search,
    setSearch,
    paneMode,
    setPaneMode,
    paneDevice,
    setPaneDevice,
    isLoading,
    isError,
    activeThemeSaved,
    activeThemeLocal,
    setActiveThemeLocal,
    activeThemeIsDirty,
    isDirtyPane,
    handleFieldChange,
    hasLockedFields,
    activePaneData,
    activePaneValues,
    activePaneIsDirty,
    customFontNames,
    filteredGroups,
    toggleSection,
    isSectionOpen,
    sidebarItems,
  } = state

  // Fills the fixed-height column page.tsx puts it in (flex-1) instead of sizing itself, so the
  // Simple/Advanced bar above it is already accounted for and Save/Reset stay on screen. The
  // scrolling lives in the sidebar and the field list inside.
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30"
      data-testid="theme-engine-page"
    >
      {/* ── Title bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b bg-sidebar px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="flex-1 text-center text-sm font-semibold text-muted-foreground">
          Settings — Themes
        </span>
      </div>

      {/* ── Platform bar ─────────────────────────────────────────────────── */}
      {PLATFORMS.length > 1 && (
        <div
          className="flex flex-shrink-0 items-center gap-1 border-b bg-sidebar px-4 py-2"
          data-testid="platform-bar"
        >
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              data-testid={`platform-btn-${p.id}`}
              aria-pressed={platform === p.id}
              onClick={() => setPlatform(p.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                platform === p.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Active theme bar ─────────────────────────────────────────────── */}
      {/* Platform-wide "the running app should render in ___" — distinct from
          the per-pane Dark/Light mode tabs below, which only pick which
          theme's field values are being edited. Read by the runtime
          ThemeEngineProvider via GET /tokens. */}
      <div
        className="flex flex-shrink-0 items-center justify-center gap-2 border-b bg-sidebar px-4 py-1.5"
        data-testid="active-theme-bar"
      >
        <span className="text-xs text-muted-foreground">Active Theme</span>
        <div className="flex gap-1">
          {(['dark', 'light', 'system'] as const).map((t) => {
            const current = activeThemeLocal[platform] ?? activeThemeSaved[platform] ?? 'system'
            return (
              <button
                key={t}
                data-testid={`active-theme-btn-${t}`}
                aria-pressed={current === t}
                onClick={() => setActiveThemeLocal((prev) => ({ ...prev, [platform]: t }))}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  current === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-secondary'
                )}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Lock banner — only when schema reports at least one locked field ── */}
      {hasLockedFields && (
        <div
          className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          data-testid="locked-by-banner"
          role="status"
        >
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              A Template Engine run is currently writing some of these values. Locked fields are
              marked; everything else is editable.
            </span>
          </div>
          <button
            data-testid="btn-takeover"
            onClick={() => takeoverMutation.mutate()}
            disabled={takeoverMutation.isPending}
            className="shrink-0 rounded-md border border-amber-400 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-200 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
          >
            {takeoverMutation.isPending ? 'Taking over…' : 'Take over these settings'}
          </button>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <PaneSidebar
          search={search}
          setSearch={setSearch}
          isLoading={isLoading}
          isError={isError}
          sidebarItems={sidebarItems}
          activePane={activePane}
          setActivePane={setActivePane}
          isDirtyPane={isDirtyPane}
        />

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Pane header */}
          {activePaneData && (
            <div className="flex-shrink-0 border-b bg-background px-7 py-4">
              <h1 className="text-2xl font-bold tracking-tight">{activePaneData.label}</h1>
              {activePaneData.groups[0] && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {activePaneData.groups.length} sections
                </p>
              )}

              {/* Device/Mode sub-tabs */}
              {(activePaneData.devices || activePaneData.modes) && (
                <div className="mt-3 flex flex-wrap gap-4">
                  {activePaneData.devices && activePaneData.devices.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Device</span>
                      <div className="flex gap-1">
                        {activePaneData.devices.map((d) => {
                          const isActive =
                            (paneDevice[activePane] ?? activePaneData.devices![0]!.id) === d.id
                          return (
                            <button
                              key={d.id}
                              data-testid={`device-tab-${d.id}`}
                              aria-pressed={isActive}
                              onClick={() =>
                                setPaneDevice((prev) => ({ ...prev, [activePane]: d.id }))
                              }
                              className={cn(
                                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                                isActive
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-secondary'
                              )}
                            >
                              {d.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {activePaneData.modes && activePaneData.modes.length > 0 && (
                    <div className="flex items-center gap-2">
                      {/* Distinct from the "Active Theme" bar above (KDL-199 Problem
                          2): this only picks which theme's *field values* are being
                          edited here, not the app's live theme. */}
                      <span className="text-xs text-muted-foreground">Editing values for</span>
                      <div className="flex gap-1">
                        {activePaneData.modes.map((m) => {
                          const isActive =
                            (paneMode[activePane] ?? activePaneData.modes![0]!.id) === m.id
                          return (
                            <button
                              key={m.id}
                              data-testid={`mode-tab-${m.id}`}
                              aria-pressed={isActive}
                              onClick={() =>
                                setPaneMode((prev) => ({ ...prev, [activePane]: m.id }))
                              }
                              className={cn(
                                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                                isActive
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-secondary'
                              )}
                            >
                              {m.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sections */}
          <FieldSections
            activePaneData={activePaneData}
            activePane={activePane}
            activePaneValues={activePaneValues}
            filteredGroups={filteredGroups}
            search={search}
            isLoading={isLoading}
            isSectionOpen={isSectionOpen}
            toggleSection={toggleSection}
            handleFieldChange={handleFieldChange}
            customFontNames={customFontNames}
          />

          {/* Footer */}
          <div
            className="flex flex-shrink-0 items-center justify-between border-t bg-sidebar px-7 py-3"
            data-testid="footer"
          >
            <span className="text-xs text-muted-foreground">
              {activePaneIsDirty || activeThemeIsDirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <div className="flex gap-2">
              <Button
                data-testid="btn-reset"
                variant="outline"
                size="sm"
                onClick={() => resetMutation.mutate({ paneId: activePane, platform })}
                disabled={isResetting || !activePane}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                data-testid="btn-save"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !activePane || (!activePaneIsDirty && !activeThemeIsDirty)}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>

        {/* Right preview panel */}
        <aside className="hidden w-80 flex-shrink-0 flex-col items-center gap-4 overflow-y-auto border-l bg-sidebar px-4 py-5 xl:flex scrollbar-thin">
          <div className="self-start text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Live Preview
          </div>
          <PreviewFrame
            platform={platform}
            pane={activePaneData}
            values={activePaneValues}
            device={activePaneData ? paneDevice[activePaneData.id] : undefined}
          />
          <div className="text-center text-[11px] text-muted-foreground">
            {activePaneData?.label ?? 'Select a pane'} — updates live as you edit
          </div>
        </aside>
      </div>
    </div>
  )
}
