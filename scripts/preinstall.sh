#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../core/engines/bullet/;
./build.sh;
popd;
