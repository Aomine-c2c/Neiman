Redesign the user interface and user experience of the application from scratch, delivering a complete design architecture, design system specifications, and full frontend implementation for production operational use.

Integrity mode: development

## Requirements

### R1. UI/UX Design System and Architecture Specification
Produce a design system specification document detailing the design tokens, visual palette, typography scale, navigation structure, view layouts, and component hierarchies for the entire application. The specification must define the complete operational interface for daily production use, covering all interaction workflows and explicit view states (loading, empty, populated, error).

### R2. Frontend Redesign Implementation
Implement the redesigned UI/UX across the application codebase, completely replacing the legacy visual styling, page layouts, navigation structures, and interactive flows. Ensure all UI elements and controls connect to functional routines, eliminating dummy, unstyled, or disconnected UI components.

## Acceptance Criteria

### Design Specification
- [ ] A design specification document exists defining design tokens (color palette, typography, spacing), layout hierarchy, navigation architecture, and view states across all application views.
- [ ] Every defined view in the specification explicitly details loading, empty, populated, and error states.

### Frontend Implementation
- [ ] All application routes and views render using the new design system components, styling tokens, and layout structures.
- [ ] Interactive controls (buttons, links, toggles, navigation items, forms) trigger active functional handlers with zero non-functional or placeholder UI controls.
- [ ] The application supports both light mode (default) and dark mode, with theme preference persisted across sessions.

### Build and Verification
- [ ] The frontend application builds cleanly with zero TypeScript errors (`tsc --noEmit` or project type-check passes with exit code 0).
- [ ] The production build command succeeds with zero build errors and exit code 0.
- [ ] Existing frontend test suites run and pass with exit code 0.
