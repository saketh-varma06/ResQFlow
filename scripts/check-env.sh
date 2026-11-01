#!/usr/bin/env bash
echo "Node:  $(node --version 2>&1)"
echo "npm:   $(npm --version 2>&1)"
echo "Git:   $(git --version 2>&1)"
echo "Docker: $(docker --version 2>&1 || echo 'not installed')"
echo "Docker Compose: $(docker compose version 2>&1 || echo 'not available')"
