#!/usr/bin/env pwsh

# Build the app icons for all Tauri targets.
# This PowerShell script runs the cross-platform Python script.
# You need Python 3 and Pillow installed: pip install Pillow

python "$PSScriptRoot/make_icons.py"
