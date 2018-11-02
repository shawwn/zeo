#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

"$DIR"/../index.js server \
  port="$PORT" \
  siteUrl='http://next.niltree.com' \
  vridUrl='http://next.niltree.com' \
  noTty
