#!/bin/bash
# Build MANIFEST.json for an Ansible collection
# Usage: build-manifest.sh <collection-path>
#
# This script attempts to build MANIFEST.json using ansible-galaxy collection build,
# or falls back to generating it from galaxy.yml if ansible-galaxy is not available.

set -euo pipefail

COLLECTION_PATH="${1:-}"
if [ -z "$COLLECTION_PATH" ]; then
    echo "Error: Collection path is required" >&2
    echo "Usage: $0 <collection-path>" >&2
    exit 1
fi

if [ ! -d "$COLLECTION_PATH" ]; then
    echo "Error: Collection path does not exist: $COLLECTION_PATH" >&2
    exit 1
fi

GALAXY_YML="${COLLECTION_PATH}/galaxy.yml"
MANIFEST_JSON="${COLLECTION_PATH}/MANIFEST.json"

# Check if ansible-galaxy is available
if command -v ansible-galaxy >/dev/null 2>&1; then
    echo "Using ansible-galaxy to build MANIFEST.json..."

    # Create a temporary directory for building
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf '$TEMP_DIR'" EXIT

    # Build the collection in temp directory
    cd "$COLLECTION_PATH"
    if ansible-galaxy collection build --output-path "$TEMP_DIR" . >/dev/null 2>&1; then
        # Find the built tarball
        TARBALL=$(find "$TEMP_DIR" -name "*.tar.gz" -type f | head -n 1)

        if [ -n "$TARBALL" ]; then
            # Extract MANIFEST.json from the tarball
            tar -xzf "$TARBALL" -C "$TEMP_DIR" MANIFEST.json 2>/dev/null || true

            # Check if MANIFEST.json was extracted
            if [ -f "$TEMP_DIR/MANIFEST.json" ]; then
                cp "$TEMP_DIR/MANIFEST.json" "$MANIFEST_JSON"
                echo "Successfully built MANIFEST.json using ansible-galaxy"
                exit 0
            fi
        fi
    fi

    echo "Warning: ansible-galaxy build failed, falling back to galaxy.yml parsing" >&2
fi

# Fallback: Generate MANIFEST.json from galaxy.yml
if [ ! -f "$GALAXY_YML" ]; then
    echo "Error: Neither ansible-galaxy build succeeded nor galaxy.yml found" >&2
    exit 1
fi

echo "Generating MANIFEST.json from galaxy.yml..."

# Use Python to parse galaxy.yml and generate MANIFEST.json
python3 << EOF
import json
import yaml
import sys
import os

galaxy_yml_path = "${GALAXY_YML}"
manifest_json_path = "${MANIFEST_JSON}"

try:
    with open(galaxy_yml_path, 'r') as f:
        galaxy_data = yaml.safe_load(f)

    if not galaxy_data:
        print("Error: galaxy.yml is empty", file=sys.stderr)
        sys.exit(1)

    # Extract required fields
    namespace = galaxy_data.get('namespace')
    name = galaxy_data.get('name')
    version = galaxy_data.get('version', '1.0.0')

    if not namespace or not name:
        print(f"Error: galaxy.yml missing required fields (namespace: {namespace}, name: {name})", file=sys.stderr)
        sys.exit(1)

    # Build collection_info structure
    collection_info = {
        'namespace': namespace,
        'name': name,
        'version': version,
    }

    # Add optional fields if present
    if 'readme' in galaxy_data:
        collection_info['readme'] = galaxy_data['readme']

    if 'authors' in galaxy_data:
        collection_info['authors'] = galaxy_data['authors'] if isinstance(galaxy_data['authors'], list) else [galaxy_data['authors']]

    if 'description' in galaxy_data:
        collection_info['description'] = galaxy_data['description']

    if 'license' in galaxy_data:
        collection_info['license'] = galaxy_data['license'] if isinstance(galaxy_data['license'], list) else [galaxy_data['license']]

    if 'tags' in galaxy_data:
        collection_info['tags'] = galaxy_data['tags']

    if 'dependencies' in galaxy_data:
        collection_info['dependencies'] = galaxy_data['dependencies']

    if 'repository' in galaxy_data:
        collection_info['repository'] = galaxy_data['repository']

    if 'documentation' in galaxy_data:
        collection_info['documentation'] = galaxy_data['documentation']

    if 'homepage' in galaxy_data:
        collection_info['homepage'] = galaxy_data['homepage']

    if 'issues' in galaxy_data:
        collection_info['issues'] = galaxy_data['issues']

    # Build MANIFEST.json structure
    manifest = {
        'collection_info': collection_info,
        'format': 1
    }

    # Write MANIFEST.json
    with open(manifest_json_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"Successfully generated MANIFEST.json from galaxy.yml")
    print(f"  namespace: {namespace}")
    print(f"  name: {name}")
    print(f"  version: {version}")

except yaml.YAMLError as e:
    print(f"Error: Failed to parse galaxy.yml: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
EOF

if [ $? -eq 0 ]; then
    echo "MANIFEST.json created successfully"
else
    echo "Error: Failed to generate MANIFEST.json" >&2
    exit 1
fi

