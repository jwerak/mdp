#!/bin/bash
# Quick debug command for testing ansible-navigator execution
# Run from the mdp project directory

cd /var/lib/cockpit-plugin-demos

export ANSIBLE_CONFIG="/usr/share/cockpit-plugin-demos/meta/ansible.cfg"

ansible-navigator run "/usr/share/cockpit-plugin-demos/meta/meta_playbook.yml" \
  --eei "ghcr.io/ansible/community-ansible-dev-tools" \
  --extra-vars '{"instance_id":"test-debug","demo_type":"role","demo_path":"mdp.test.hello","demo_vars":{"greeting":"Hello, World!","count":1,"uppercase":false,"language":"english"},"variable_definitions":[{"name":"greeting","label":"Greeting Message","description":"The greeting message to display","type":"text","required":true},{"name":"count","label":"Count","description":"Number of times to repeat the greeting","type":"number","required":false},{"name":"uppercase","label":"Uppercase Output","description":"Whether to display output in uppercase","type":"boolean","required":false},{"name":"language","label":"Language","description":"Language for the greeting","type":"select","required":false,"options":["english","spanish","french","german"]}]}' \
  --mode stdout \
  --pull-policy missing \
  --pae true \
  --lf "/var/lib/cockpit-plugin-demos/instances/test-debug/ansible-navigator.log"
