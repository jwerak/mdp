# Mini Demo Platform (MDP)

Cockpit plugin for deploying and managing demo deployments from Ansible Collections.

## Quick Start

### Prerequisites

- Cockpit installed and running
- User must be member of `cockpit-demo-ops` group
- Node.js and npm for building
- Git access to Ansible Collection repository

### Setup Group and Permissions

1. **Create the `cockpit-demo-ops` group:**
   ```bash
   sudo groupadd cockpit-demo-ops
   ```

2. **Add user to the group:**
   ```bash
   # Replace 'username' with your actual username
   sudo usermod -a -G cockpit-demo-ops username
   ```

3. **Verify group membership:**
   ```bash
   # Log out and log back in, then verify:
   groups
   # Should show 'cockpit-demo-ops' in the list
   ```

4. **Create and set permissions for data directory:**
   ```bash
   sudo mkdir -p /var/lib/cockpit-plugin-demos
   sudo chown root:cockpit-demo-ops /var/lib/cockpit-plugin-demos
   sudo chmod 775 /var/lib/cockpit-plugin-demos
   ```

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the plugin:**
   ```bash
   npm run build
   ```

3. **Deploy to Cockpit:**
   ```bash
   # Create the plugin directory
   sudo mkdir -p /usr/share/cockpit/mdp

   # Copy contents of cockpit directory to the plugin location
   # Typically: /usr/share/cockpit/ or ~/.local/share/cockpit/
   sudo cp -r cockpit/* /usr/share/cockpit/mdp/

   # Ensure dist/ directory and all files are present
   ls -la /usr/share/cockpit/mdp/dist/
   # Should show mdp.js and chunk files
   ```

4. **Verify deployment:**
   ```bash
   # Check that files are in place
   ls -la /usr/share/cockpit/mdp/
   # Should show manifest.json, mdp.html, and dist/ directory

   # Restart Cockpit service
   sudo systemctl restart cockpit.socket

   # Or restart the full service
   sudo systemctl restart cockpit
   ```

5. **Clear browser cache:**
   - Hard refresh the Cockpit page (Ctrl+Shift+R or Cmd+Shift+R)
   - Or clear browser cache and reload

### Troubleshooting

If "Demo Deployments" doesn't appear in the sidebar:

1. **Verify plugin directory structure:**
   ```bash
   ls -la /usr/share/cockpit/mdp/
   # Should contain: manifest.json, mdp.html, dist/
   ```

2. **Check manifest.json syntax:**
   ```bash
   cat /usr/share/cockpit/mdp/manifest.json
   # Should be valid JSON
   python3 -m json.tool /usr/share/cockpit/mdp/manifest.json
   ```

3. **Check Cockpit logs:**
   ```bash
   sudo journalctl -u cockpit -n 50
   # Look for any errors related to the plugin
   ```

4. **Verify file permissions:**
   ```bash
   # Manifest should be readable
   sudo chmod 644 /usr/share/cockpit/mdp/manifest.json
   sudo chmod 644 /usr/share/cockpit/mdp/mdp.html
   sudo chmod -R 755 /usr/share/cockpit/mdp/dist/
   ```

5. **Check if plugin is detected:**
   ```bash
   # List all Cockpit plugins
   ls -d /usr/share/cockpit/*
   # Should include 'mdp' directory
   ```

6. **For user-specific installation:**
   ```bash
   # If installing for current user only:
   mkdir -p ~/.local/share/cockpit/mdp
   cp -r cockpit/* ~/.local/share/cockpit/mdp/
   # Then restart Cockpit or log out/in
   ```

7. **Verify the HTML file loads correctly:**
   ```bash
   # Check if mdp.html exists and is readable
   cat /usr/share/cockpit/mdp/mdp.html
   # Verify dist/mdp.js exists
   ls -lh /usr/share/cockpit/mdp/dist/mdp.js
   ```

### Configuration

1. Open Cockpit and navigate to **Demo Deployments** in the sidebar
2. Go to **Settings** tab
3. Configure:
   - **Git Repository URL**: URL of your Ansible Collection repository
   - **Namespace**: Collection namespace (default: `local`)
   - **Collection Name**: Name of your collection
4. Click **Save & Sync Catalog** to clone/pull the repository

### Usage

1. **View Available Demos:**
   - Navigate to **Catalog** tab
   - Browse available demos from `demos.yaml`

2. **Launch a Demo:**
   - Click on a demo card
   - Fill in the dynamic form with required parameters
   - Click **Launch**

3. **Monitor Instances:**
   - Go to **Instances** tab
   - View deployment status (pending, running, completed, failed)
   - Status auto-refreshes every 5 seconds

### Directory Structure

The plugin maintains this structure:

```
/var/lib/cockpit-plugin-demos/
├── catalog/
│   └── ansible_collections/
│       └── <namespace>/
│           └── <collection>/
│               ├── galaxy.yml
│               ├── demos.yaml
│               └── playbooks/
└── instances/
    └── <instance-id>/
        ├── spec.json
        └── status.json
```

### Example demos.yaml Format

```yaml
- id: web-server
  name: Web Server Demo
  playbook: deploy-web.yml
  parameters:
    - name: hostname
      label: Hostname
      type: text
      default: example.com
    - name: port
      label: Port
      type: number
      default: 8080
    - name: ssl_enabled
      label: Enable SSL
      type: boolean
      default: false
    - name: environment
      label: Environment
      type: select
      options:
        - development
        - staging
        - production
      default: development
```

### Development

- **Watch mode:** `npm run dev`
- **Linting:** `npm run lint`
- **Build:** `npm run build`

### Notes

- Plugin runs as standard user (no sudo required)
- Git operations use `cockpit.spawn` for security
- Instance IDs format: `<demo-id>-<4-char-random>`
- External EDA process watches `/var/lib/cockpit-plugin-demos/instances/` for new deployments
