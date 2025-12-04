systemd-run --user --unit cockpit-demo-hello-world-xobo \
            --collect --wait -- \
            bash -c export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:$HOME/.local/bin:$PATH" && \
            ansible-navigator run "/var/lib/cockpit-plugin-demos/meta/meta_playbook.yml" --eei "ghcr.io/ansible/community-ansible-dev-tools" \
                --extra-vars '{"instance_id":"hello-world-xobo","demo_type":"role","demo_path":"hello-world","demo_vars":{"greeting":"Hello, World!","count":1,"uppercase":true,"language":"english"},"variable_definitions":[{"name":"greeting","label":"Greeting Message","description":"The greeting message to display","type":"text","required":true},{"name":"count","label":"Count","description":"Number of times to repeat the greeting","type":"number","required":false},{"name":"uppercase","label":"Uppercase Output","description":"Whether to display output in uppercase","type":"boolean","required":false},{"name":"language","label":"Language","description":"Language for the greeting","type":"select","required":false,"options":["english","spanish","french","german"]}]}' \
                --mode stdout \
                --pull-policy missing


systemd-run --user --unit cockpit-demo-hello-world-myvn \
            --working-directory /var/lib/cockpit-plugin-demos \
            --collect --wait -- \
            bash -c export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:$HOME/.local/bin:$PATH" && \
            ansible-navigator run "meta/meta_playbook.yml" --eei "ghcr.io/ansible/community-ansible-dev-tools" \
                --extra-vars '{"instance_id":"hello-world-myvn","demo_type":"role","demo_path":"mdp.example.hello-world","demo_vars":{"greeting":"Hello, World!","count":1,"uppercase":false,"language":"english"},"variable_definitions":[{"name":"greeting","label":"Greeting Message","description":"The greeting message to display","type":"text","required":true},{"name":"count","label":"Count","description":"Number of times to repeat the greeting","type":"number","required":false},{"name":"uppercase","label":"Uppercase Output","description":"Whether to display output in uppercase","type":"boolean","required":false},{"name":"language","label":"Language","description":"Language for the greeting","type":"select","required":false,"options":["english","spanish","french","german"]}]}' \
                --mode stdout \
                --pull-policy missing


systemd-run --user --unit cockpit-demo-hello-world-6eqk \
            --working-directory /var/lib/cockpit-plugin-demos \
            --collect --wait -- \
            bash -c export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:$HOME/.local/bin:$PATH" && \
            export ANSIBLE_CONFIG="/var/lib/cockpit-plugin-demos/meta/ansible.cfg" && \
            ansible-navigator run "meta/meta_playbook.yml" --eei "ghcr.io/ansible/community-ansible-dev-tools" \
                --extra-vars '{"instance_id":"hello-world-6eqk","demo_type":"role","demo_path":"mdp.example.hello-world","demo_vars":{"greeting":"Hello, World!","count":1,"uppercase":false,"language":"english"},"variable_definitions":[{"name":"greeting","label":"Greeting Message","description":"The greeting message to display","type":"text","required":true},{"name":"count","label":"Count","description":"Number of times to repeat the greeting","type":"number","required":false},{"name":"uppercase","label":"Uppercase Output","description":"Whether to display output in uppercase","type":"boolean","required":false},{"name":"language","label":"Language","description":"Language for the greeting","type":"select","required":false,"options":["english","spanish","french","german"]}]}' \
                --mode stdout \
                --pull-policy missing