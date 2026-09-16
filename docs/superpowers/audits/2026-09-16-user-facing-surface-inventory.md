# BetterBoard User-Facing Surface Inventory

Date: 2026-09-16
Branch: `ui/desktop-capability-reachability`
Purpose: explicit source-outward classification of user-facing and adjacent desktop surfaces so independently valuable functionality cannot remain accidentally buried.

## Classification contract

Every reviewed candidate is assigned exactly one product classification:

- `canonical` — independently meaningful workbench or workflow with a canonical capability ID.
- `shortcut` — independently useful nested sub-tool that remains owned by an existing canonical workbench.
- `owner-internal` — contextual control/metric/mode that is useful only inside its owning workbench and should not become a no-context global shortcut.
- `backend-only` — implementation/backend command with no direct user-facing navigation surface.
- `dead-orphaned` — retired, duplicate, or intentionally disconnected UI that must not silently reappear as a second product surface; a later cleanup phase may remove remaining dead source.

The inventory is deliberately conservative: discoverability is not measured by shortcut count. A new top-level destination is justified by independent user value, not by the mere existence of a button or function.

## Audited inventory

| Surface | Owner/source | Evidence | Classification | Navigation ID | Rationale |
| --- | --- | --- | --- | --- | --- |
| `hardware-session` | `App.tsx` / `HardwareSession` | board/port/profile selection is independently meaningful shared state | `canonical` | `hardware-session` | primary build prerequisite and reusable workflow |
| `hardware-doctor` | `App.tsx` / `HardwareSession` | diagnosis, mismatch, readiness and recovery have independent result/action semantics | `canonical` | `hardware-doctor` | independently useful diagnosis surface |
| `recipe-preflight` | `App.tsx` | core/library readiness check has independent result state | `canonical` | `recipe-preflight` | prerequisite diagnosis before programming |
| `recipe-preflight-check` | `App.tsx` | exact `Check core & libraries` action can be meaningfully located without auto-running | `shortcut` | `recipe-preflight-check` | direct discoverability; backend remains App-owned |
| `program-firmware` | `App.tsx` | prepare/compile/upload workflow is a coherent workbench | `canonical` | `program-firmware` | owns consequential programming actions |
| `program-prepare-firmware` | `App.tsx` | exact Prepare Firmware action is independently discoverable | `shortcut` | `program-prepare-firmware` | navigation focuses but never runs action |
| `program-compile` | `App.tsx` | compile has an independent Hardware Doctor-gated result | `shortcut` | `program-compile` | exact action discoverability without execution |
| `program-compile-upload` | `App.tsx` | compile+upload is a distinct consequential action | `shortcut` | `program-compile-upload` | navigation exposes existing control only |
| `recipe-library` | `App.tsx` | recipe/preset browsing has persistent user value | `canonical` | `recipe-library` | coherent source/preset workbench |
| `recipe-preset-builder` | `App.tsx` | parameterized preset creation creates persistent library state | `shortcut` | `recipe-preset-builder` | meaningful nested workflow with owner-owned persistence |
| `my-recipe-library` | `App.tsx` | saved user presets form a persistent browseable subset | `shortcut` | `my-recipe-library` | direct discoverability with safe empty fallback |
| `circuit-lab` | `CircuitLab.tsx` | persisted wiring design has independent input/output | `canonical` | `circuit-lab` | full workbench |
| `circuit-diagnostics` | `CircuitLab.tsx` | rule checker produces independent issue results | `canonical` | `circuit-diagnostics` | diagnostic workflow is independently meaningful |
| `monitor-live` | `MonitorDataStudio.tsx` | live serial acquisition is a complete workflow | `canonical` | `monitor-live` | primary measurement entry |
| `monitor-snapshot` | `MonitorDataStudio.tsx` | bounded snapshot capture has independent result | `canonical` | `monitor-snapshot` | distinct measurement workflow |
| `measurement-evidence` | `MonitorDataStudio.tsx` | evidence persistence/provenance is an independent workflow | `canonical` | `measurement-evidence` | traceable save operation |
| `measurement-replay` | `MonitorDataStudio.tsx` | historical session replay is independently useful | `canonical` | `measurement-replay` | complete browse/replay workflow |
| `serial-console` | `MonitorDataStudio.tsx` | console panel is an independently useful inspection surface | `shortcut` | `serial-console` | nested monitor sub-tool |
| `serial-transmit` | `MonitorDataStudio.tsx` | serial TX control is independently useful but context-owned | `shortcut` | `serial-transmit` | reveal-only navigation; transmit remains owner-controlled |
| `engineering-export-package` | `MonitorDataStudio.tsx` | export package gathers evidence/compatibility artifacts | `shortcut` | `engineering-export-package` | meaningful nested export workflow |
| `hardware-map-doc` | `MonitorDataStudio.tsx` compatibility/export panel | hardware map is read-only reference content inside the export package | `owner-internal` | `-` | separate global shortcut would duplicate the export owner |
| `serial-protocol-doc` | `MonitorDataStudio.tsx` compatibility/export panel | serial protocol guide is read-only reference content | `owner-internal` | `-` | no independent execution or persistence |
| `honeycomb-guide-doc` | `MonitorDataStudio.tsx` compatibility/export panel | Honeycomb guide is owner-scoped documentation | `owner-internal` | `-` | remains inside export/compatibility context |
| `analysis-evidence` | `AnalysisVisualizationHub.tsx` / `EvidenceInspector` | provenance/schema/channel inspection is a complete lens | `canonical` | `analysis-evidence` | primary analysis entry |
| `analysis-run-compare` | `AnalysisVisualizationHub.tsx` | Run A/Run B comparison has independent selected state and output | `canonical` | `analysis-run-compare` | independent comparison workflow |
| `analysis-annotations` | `AnnotatedEngineeringPlot.tsx` | session-local annotations create independent user state | `canonical` | `analysis-annotations` | reusable analysis capability |
| `analysis-statistics` | `AppliedStatisticsWorkbench.tsx` | statistics/spectrum/change analysis is a full workbench | `canonical` | `analysis-statistics` | complete analysis lane |
| `analysis-models` | `ModelFittingWorkbench.tsx` | fitting/residual comparison has independent inputs/results | `canonical` | `analysis-models` | complete model workflow |
| `analysis-experiment-design` | `ExperimentPlanningWorkbench.tsx` | DOE/sequential recommendations are independently useful | `canonical` | `analysis-experiment-design` | complete experiment-planning workflow |
| `analysis-numerical` | `NumericalErrorVisualWorkbench.tsx` | numerical reliability workbench has independent derived results | `canonical` | `analysis-numerical` | coherent expert analysis lane |
| `numerical-result-viewer` | `NumericalResultVisualization.tsx` | opens analyzer JSON/CSV and visualizes independent result files | `shortcut` | `numerical-result-viewer` | no-context file-open workflow is meaningful |
| `magnet-result-viewer` | `MagnetResultVisualization.tsx` | opens magnetic summary/scan/residual result files | `shortcut` | `magnet-result-viewer` | independent visualization workflow |
| `research-context` | `EngineeringPreparationStudio.tsx` | research question/hypothesis/notebook state is persistent context | `canonical` | `research-context` | one coherent context workbench |
| `research-context-notebook-mode` | `EngineeringPreparationStudio.tsx` | mode shares the same selected evidence and form state | `owner-internal` | `-` | splitting modes would create fake duplicate tools |
| `research-context-annotation-mode` | `EngineeringPreparationStudio.tsx` | mode shares the same research-context state | `owner-internal` | `-` | remains in owner |
| `research-context-lab-journey-mode` | `EngineeringPreparationStudio.tsx` | mode shares the same persistent context object | `owner-internal` | `-` | remains in owner |
| `developer-editor` | `DeveloperIDE.tsx` | source editing is a complete workbench | `canonical` | `developer-editor` | canonical developer owner |
| `developer-new-sketch` | `DeveloperIDE.tsx` | starts a distinct editor workflow | `shortcut` | `developer-new-sketch` | direct action discoverability without auto mutation |
| `developer-load-template` | `DeveloperIDE.tsx` | template load control is independently useful to locate | `shortcut` | `developer-load-template` | reveal/focus only |
| `developer-format-source` | `DeveloperIDE.tsx` | source formatting is a distinct editor action | `shortcut` | `developer-format-source` | discoverable nested action |
| `developer-save-sketch` | `DeveloperIDE.tsx` | exact Save action is distinct from Save to Library | `shortcut` | `developer-save-sketch` | exact matching prevents ambiguous destination |
| `developer-save-library` | `DeveloperIDE.tsx` | persistent library save is a distinct action | `shortcut` | `developer-save-library` | persistence remains owner-controlled |
| `developer-verify` | `DeveloperIDE.tsx` | verify is a distinct action with compile diagnostics | `shortcut` | `developer-verify` | direct discoverability without execution |
| `developer-run-upload` | `DeveloperIDE.tsx` | run/upload is a distinct consequential action | `shortcut` | `developer-run-upload` | reveal only; hardware gates remain owner-controlled |
| `developer-ecosystem` | `ArduinoEcosystemManager.tsx` | boards/libraries/examples management is a coherent workbench | `canonical` | `developer-ecosystem` | canonical ecosystem owner |
| `developer-boards` | `ArduinoEcosystemManager.tsx` | Boards manager has independent search/result state | `shortcut` | `developer-boards` | meaningful nested manager |
| `developer-libraries` | `ArduinoEcosystemManager.tsx` | Libraries manager has independent search/result state | `shortcut` | `developer-libraries` | meaningful nested manager |
| `developer-examples` | `ArduinoEcosystemManager.tsx` | Examples browser has independent search/open workflow | `shortcut` | `developer-examples` | meaningful nested manager |
| `arduino-board-index-url` | `ArduinoEcosystemManager.tsx` | additional Boards Manager URL is independently configurable | `shortcut` | `arduino-board-index-url` | focuses configuration row, never clicks Add URL |
| `ecosystem-install-result` | `ArduinoEcosystemManager.tsx` | install/uninstall depends on the currently selected package/result | `owner-internal` | `-` | no-context shortcut would be unusable/dangerous |
| `developer-sketchbook` | `SketchbookExplorer.tsx` | project/file browsing is a complete workbench | `canonical` | `developer-sketchbook` | canonical project owner |
| `sketchbook-new-project` | `SketchbookExplorer.tsx` | new project starts a meaningful workflow without prior selection | `shortcut` | `sketchbook-new-project` | independent start action |
| `sketchbook-new-file` | `SketchbookExplorer.tsx` | requires an active project context | `owner-internal` | `-` | remains owner-internal |
| `sketchbook-rename-file` | `SketchbookExplorer.tsx` | requires current file selection | `owner-internal` | `-` | cannot launch meaningfully without context |
| `sketchbook-delete-file` | `SketchbookExplorer.tsx` | destructive action requires selected file/project context | `owner-internal` | `-` | never globalize destructive context action |
| `task-center` | `TaskCenter.tsx` | background-task history/state is a coherent system surface | `canonical` | `task-center` | global runtime context |
| `task-copy-log` | `TaskCenter.tsx` | copy requires an existing task/log target | `owner-internal` | `-` | no independent no-context workflow |
| `task-cancel` | `TaskCenter.tsx` | cancel applies only to a running cancellable task | `owner-internal` | `-` | contextual consequential action |
| `task-clear-finished` | `TaskCenter.tsx` | action operates on current task-center state | `owner-internal` | `-` | remains within Task Center |
| `openguin` | `OpenPenguinBridge.tsx` | local AI bridge is an independent global workbench | `canonical` | `openguin` | complete system capability |
| `openguin-quick-prompts` | `OpenPenguinBridge.tsx` | Diagnose/Next experiment/Evidence quality/etc. share one AI context and execution path | `owner-internal` | `-` | prompt presets are not separate tools |
| `hardware-topology` | `HardwareTopology.tsx` | read-only whole-chain status visualization | `canonical` | `hardware-topology` | independently useful system visualization |
| `esp32-capabilities` | `EspressifCapabilityPanel.tsx` | target/readiness/security/research panel is a coherent workbench | `canonical` | `esp32-capabilities` | canonical ESP32 research surface |
| `esp32-core-audit` | `EspressifCapabilityPanel.tsx` | installed core audit has independent read-only result | `shortcut` | `esp32-core-audit` | direct diagnostic discoverability |
| `esp32-board-details` | `EspressifCapabilityPanel.tsx` | CLI board details are independent read-only metadata | `shortcut` | `esp32-board-details` | direct inspection surface |
| `esp32-configuration-risk` | `EspressifCapabilityPanel.tsx` | configuration risk audit produces independent result | `shortcut` | `esp32-configuration-risk` | direct diagnostic surface |
| `campaign-visualization` | `CampaignVisualization.tsx` | independently visualizes Physical source → Embedded mechanism → Evidence → Host reference → Decision plus Numeric Error mechanism coverage | `shortcut` | `campaign-visualization` | stable semantic route exposes an existing campaign result/coverage visualization without duplicating campaign execution |
| `experiment-code-library` | `EngineeringExperimentLibrary.tsx` | repository-discovered firmware/host tools form a complete library | `canonical` | `experiment-code-library` | canonical experiment-code browser |
| `experiment-code-view-source` | `EngineeringExperimentLibrary.tsx` | requires currently selected asset | `owner-internal` | `-` | global shortcut would open empty/no-context state |
| `experiment-code-verify` | `EngineeringExperimentLibrary.tsx` | requires selected supported firmware asset | `owner-internal` | `-` | owner keeps verification target context |
| `experiment-code-upload` | `EngineeringExperimentLibrary.tsx` | requires selected firmware and hardware context | `owner-internal` | `-` | consequential context-bound action |
| `compile_sketch` | Tauri backend invoked by `App.tsx` / Developer owner | backend compile command has no user-facing state by itself | `backend-only` | `-` | users navigate to owning Program/Developer action instead |
| `upload_sketch` | Tauri backend invoked by `App.tsx` / Developer owner | backend upload command is consequential implementation detail | `backend-only` | `-` | never expose backend command directly |
| `user_recipe_save` | Tauri backend invoked by App/Developer owners | persistence command requires owner-supplied recipe/source context | `backend-only` | `-` | user-facing preset/library actions remain owners |
| `arduino_board_url_add` | Tauri backend invoked by ecosystem owner | external configuration mutation requires explicit owner UI | `backend-only` | `-` | navigation must never call it |
| `StudioAdvanced-compatibility-surface` | retired compatibility UI protected by `functionality_surface_check.py` | former duplicate advanced UI is intentionally retired; capabilities were absorbed by canonical owners | `dead-orphaned` | `-` | must not reappear as a competing product surface |

## Audit decisions carried forward

1. **Promote by independent value, not by button count.** Exact action shortcuts are appropriate when users can meaningfully locate the action without a current selected child object; they still do not execute automatically.
2. **Context-bound destructive/mutating controls stay owner-internal.** Install/uninstall, selected-file mutation, selected experiment asset upload, task cancellation, and similar actions require owner state.
3. **Reference fragments do not become fake tools.** Hardware-map/protocol/Honeycomb documentation remains in its owning export/compatibility surface.
4. **Research Context stays one capability.** Notebook, Annotation, and Lab Journey are modes over shared evidence/research state.
5. **Backend commands stay backend-only.** `compile_sketch`, `upload_sketch`, persistence commands, and configuration mutation commands never become navigation destinations.
6. **Retired duplicate surfaces stay retired.** The product keeps one canonical owner per capability instead of reintroducing compatibility-era duplicate shells.
7. **Campaign Visualization is now promoted.** Its standalone visualization/coverage value warrants a direct shortcut, while campaign execution remains owned by `experiments-campaigns`.

## Next audit pass

Future source-outward audits should append newly confirmed independent surfaces here first, then promote them through focused reachability contracts. Presentation layers such as the first-principles home and All Tools tiers organize existing semantic destinations; they do not create duplicate backend ownership.
