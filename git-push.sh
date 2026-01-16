#!/bin/bash
# Helper script to push using gh CLI authentication
git -c credential.helper= push https://$(gh auth token)@github.com/cf-vnkr/autoblog.git "$@"
