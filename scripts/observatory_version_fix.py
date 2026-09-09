#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'scripts/self_check.py'
s=p.read_text().replace('0.2.0-alpha.7','0.2.0-alpha.8')
p.write_text(s)
print('Alpha 0.8 version contract applied')
