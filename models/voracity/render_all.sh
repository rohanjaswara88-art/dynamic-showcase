#!/bin/bash
# renders the three showcase stills (1080p) and then the 12 second loop
cd "$(dirname "$0")"
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
for f in 1 130 210; do "$B" -b --python build_voracity.py -- still $f 128 1920 1080; done
"$B" -b --python build_voracity.py -- anim 1280 720 32 1 360
echo ALLDONE
