# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mini Demo Platform (MDP) is a Cockpit plugin for deploying and managing demo deployments from Ansible Collections. It provides a web UI within Cockpit for discovering demos from a collection's `demos.yaml`, launching them with parameters, and monitoring execution.

**Security Model:**
- Plugin runs as standard user (member of `cockpit-demo-ops` group) or system administrator
- **NO `sudo` in code** - all operations use user permissions
- Per-user instance data and configuration prevent cross-user interference
- Shared collections cache for efficiency while maintaining security boundaries

## Build and Development Commands

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Development with hot reload
npm run dev

# Linting
npm run lint
```

Build output goes to `cockpit/dist/` directory. The plugin is deployed to `/usr/share/cockpit/mdp/` on the target system.

## Architecture

### Multi-User Storage Model

The plugin uses a hybrid storage approach:

- **System-wide shared collections**: `/var/lib/cockpit-plugin-demos/collections/` - Ansible collections shared across all users, owned by `root:cockpit-demo-ops` with group write permissions
- **Per-user instance data**:
  - Regular users: `~/.local/share/cockpit-plugin-demos/instances/` and `~/.local/share/cockpit-plugin-demos/config.json`
  - Superuser (UID 0): `/var/lib/cockpit-plugin-demos/instances/` and `/var/lib/cockpit-plugin-demos/config.json`
- **Static meta files**: `/usr/share/cockpit-plugin-demos/meta/` - Contains `meta_playbook.yml` and `ansible.cfg`

Path resolution is handled by `src/lib/paths.ts:getUserPaths()` which detects user context (UID) and returns appropriate paths. Collections are always shared, but instances and config are per-user.

### Execution Flow

1. **Collection Installation**: User configures catalog in Settings modal
   - Installs Ansible collection via `ansible-galaxy` (runs in execution environment container, with fallback to local)
   - Collections installed to `/var/lib/cockpit-plugin-demos/collections/ansible_collections/`
   - Metadata extracted from `MANIFEST.json` or `galaxy.yml` and cached in per-user `config.json`

2. **Demo Discovery**: Reads `demos.yaml` from installed collection
   - Located at `{collection_path}/demos.yaml`
   - Parsed by `src/lib/catalog.ts:parseDemosYaml()` - simple YAML parser, not using external library
   - Supports playbook and role types with typed parameters (text, number, boolean, select)

3. **Instance Creation**: User launches demo with form parameters
   - Creates instance directory structure in per-user instances path
   - Writes `spec.json` (demo definition + parameters) and `status.json` (execution state)
   - Instance ID format: `{demo-id}-{4-char-random}`

4. **Playbook Execution**:
   - Uses `systemd-run --user` to run `ansible-navigator` as background service
   - Mounts per-user instance directory into container with `:Z` for SELinux relabeling
   - Executes `/usr/share/cockpit-plugin-demos/meta/meta_playbook.yml` which validates parameters and includes target playbook/role
   - Meta playbook expands `demo_vars` into individual Ansible variables
   - Artifacts saved to per-user `{instances}/{instance-id}/artifacts/` directory
   - Container runs as current user with `cockpit-demo-ops` group to access shared collections
   - Status tracked via `status.json` (updated by both UI and meta playbook)

5. **Status Monitoring**:
   - UI polls `status.json` every 5 seconds
   - States: `pending`, `running`, `completed`, `failed`
   - Success determined by ansible-navigator artifact status (not exit code)

### Key Components

**TypeScript/React Frontend:**
- `src/App.tsx` - Main application with routing between catalog/instances view and detail view
- `src/components/CatalogGrid.tsx` - Displays available demos from collection
- `src/components/LaunchModal.tsx` - Dynamic form generation from demo parameter definitions
- `src/components/InstanceList.tsx` - Lists all instances with status polling
- `src/components/InstanceDetail.tsx` - Shows instance execution details, logs, and artifacts

**Core Library Modules:**
- `src/lib/catalog.ts` - Collection sync, metadata parsing, demo discovery
- `src/lib/instances.ts` - Instance lifecycle (create, execute, monitor, delete)
- `src/lib/paths.ts` - Per-user vs system-wide path resolution
- `src/lib/config.ts` - Catalog configuration persistence
- `src/lib/types.ts` - TypeScript interfaces for all data structures

**Cockpit Integration:**
- All file I/O via `cockpit.file()` API
- All shell commands via `cockpit.spawn()` - never direct bash commands in UI code
- Cockpit API accessed via `window.cockpit` global

**Ansible Integration:**
- `meta/meta_playbook.yml` - Wrapper playbook that validates parameters and includes target demo playbook/role
- `meta/ansible.cfg` - Configures `collections_paths` to include shared collections directory
- Execution via `ansible-navigator` in container (not raw `ansible-playbook`)

### SELinux and Permissions

- Shared collections directory pre-labeled with `container_file_t` context (allows non-root podman access)
- Per-user instance directories relabeled at runtime with `:Z` flag when mounted into container
- All directories created with `umask 002` and group `cockpit-demo-ops` for shared write access
- Containers run as current user UID with `cockpit-demo-ops` GID via `--user` and `--group-add keep-groups`

### Container Execution Strategy

Collection installation uses a two-tier approach:
1. **Primary**: Run `ansible-galaxy` inside execution environment container (matches playbook execution environment)
2. **Fallback**: If container fails (SELinux errors, permission issues), retry with local `ansible-galaxy` on host

This ensures collections are installed consistently but provides robustness against container/SELinux issues.

## Important Patterns

### Cockpit Process Handling

The Cockpit spawn API has quirks with callbacks vs promises:

```typescript
// Always handle both .done()/.fail() callbacks AND promise chain
const process = cockpit.spawn(['command'], { err: 'out' });
let hasResolved = false;

// Stream output
process.stream((data) => { outputBuffer += data; });

// Handle callbacks (preferred method)
if (typeof (process as any).done === 'function') {
  (process as any).done((exitCode) => {
    if (!hasResolved) {
      hasResolved = true;
      // Handle success
    }
  });
}

// Also handle promise chain as fallback
process.then(() => { /* ... */ }).catch(() => { /* ... */ });
```

### Dynamic Variable Expansion

The meta playbook converts the `demo_vars` dictionary into individual Ansible variables:

```yaml
- name: Expand demo_vars dictionary into individual variables
  ansible.builtin.set_fact:
    "{{ item.key }}": "{{ item.value }}"
  loop: "{{ demo_vars | dict2items }}"
```

This allows demo playbooks to use variables directly (e.g., `{{ hostname }}`) rather than `{{ demo_vars.hostname }}`.

### Success Detection

Playbook success is determined by ansible-navigator artifact status, NOT exit code:

```typescript
const artifact = JSON.parse(artifactContent);
const artifactStatus = artifact.status; // 'successful', 'failed', etc.
const isSuccess = artifactStatus === 'successful';
```

This is more reliable than systemd-run exit codes which can be non-zero for non-playbook reasons.

## Data Structures

### demos.yaml Structure

Each collection must have a `demos.yaml` in its root directory:

```yaml
- id: web-server
  name: Web Server Demo
  description: Deploy a web server  # Optional
  type: playbook  # or 'role'
  path: playbooks/deploy-web.yml
  parameters:
    - name: hostname
      label: Hostname  # Optional
      description: Server hostname  # Optional, shown as helper text
      type: text  # text | number | boolean | select
      required: true
      default: example.com  # Optional
    - name: environment
      label: Environment
      type: select
      required: true
      options:
        - development
        - staging
        - production
      default: development
```

**Important**: The `required` field controls validation, NOT the presence of a default value.

### Status File Structure

Located at `{instances}/{instance-id}/status.json`:

```json
{
  "state": "pending" | "running" | "completed" | "failed",
  "message": "Status message",
  "startedAt": "2024-01-01T12:00:00Z",
  "completedAt": "2024-01-01T12:05:00Z",
  "error": "Error message if failed",
  "output": "Full ansible-navigator output",
  "summary": {
    "demo_execution_results": {
      "key": "value"
    }
  }
}
```

**Meta Playbook Responsibilities:**
- Meta playbook writes ONLY `message` and `summary` fields to status.json
- TypeScript code sets `state`, `completedAt`, `error`, and `output` based on execution result
- This ensures accurate failure detection even if playbook completes but container fails

## Development Conventions

### Ansible

Follow [Ansible good practices](https://redhat-cop.github.io/automation-good-practices/):
- Use snake_case for all variable names
- Task names should be descriptive and start with action verb
- Demo execution results variable must be named `demo_execution_results` for consistency
- Avoid modifying `state` or `completedAt` fields in status.json from playbooks

### PatternFly UI (v6)

This project uses PatternFly v6 with specific patterns:

**Class Naming:**
- Use `pf-v6-` prefixed classes (NOT older `pf-v5-`)
- Prefer PatternFly utility classes over custom CSS

**Common Patterns:**
- **Page Layout**: Use `PageSection` with `hasBodyWrapper={true}` for proper padding
- **Icons**: Always wrap in `Icon` component from `@patternfly/react-core` for consistent sizing
- **Tables**: Use composable `Table` from `@patternfly/react-table` with `variant="compact"`
- **Clickable Rows**: Use `isClickable` prop on `<Tr>`, add `onClick={(e) => e.stopPropagation()}` to interactive cells
- **Expandable Sections**: Use `ExpandableSection` with `displaySize="lg"` for logs
- **CSS Variables**: Use PatternFly variables for theming: `var(--pf-v6-global--Color--200)` for muted text, `var(--pf-v6-global--BorderColor--100)` for borders

**Log Display Pattern:**
```typescript
<ExpandableSection displaySize="lg" toggleText="Logs">
  <pre style={{
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    padding: '1rem',
    maxHeight: '400px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap'
  }}>
    {logContent}
  </pre>
</ExpandableSection>
```

## Testing Changes

After building:

1. Deploy to Cockpit plugin directory:
   ```bash
   sudo cp -r cockpit/* /usr/share/cockpit/mdp/
   ```

2. Restart Cockpit:
   ```bash
   sudo systemctl restart cockpit.socket
   ```

3. Hard refresh browser (Ctrl+Shift+R)

For debugging, check browser console and:
```bash
sudo journalctl -u cockpit -f
```

## Common Modifications

**Adding demo parameter types**: Update `DemoParameter` interface in `src/lib/types.ts` and form generator in `src/components/LaunchModal.tsx`.

**Changing execution behavior**: Modify `meta/meta_playbook.yml` or `src/lib/instances.ts:executeInstance()`.

**Status polling interval**: Change timeout in `src/components/InstanceList.tsx` or `src/components/InstanceDetail.tsx`.

**Path customization**: Update `src/lib/paths.ts` constants and `getUserPaths()` function.
