#!/usr/bin/env node
'use strict';

process.stderr.write('slow mock stderr marker\n');
process.stdin.resume();
setInterval(() => {}, 1000);
