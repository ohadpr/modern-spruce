#!/usr/bin/env bash

set -e
set -o pipefail
set -v


npm install --no-save --no-package-lock js-yaml@^3.12.0
node ./stackbit-pull.js
./ssg-build.sh
