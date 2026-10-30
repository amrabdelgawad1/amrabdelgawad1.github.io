# Compares two folders from shots.js: pixels (PNG) and computed styles (.css.txt). Needs Pillow.
import sys, os
from PIL import Image, ImageChops
a, b = sys.argv[1], sys.argv[2]
for f in sorted(os.listdir(a)):
    if f.endswith('.png'):
        ia, ib = Image.open(os.path.join(a,f)).convert('RGB'), Image.open(os.path.join(b,f)).convert('RGB')
        if ia.size != ib.size: print(f, 'SIZE', ia.size, ib.size); continue
        bb = ImageChops.difference(ia, ib).getbbox()
        print(f, 'same' if bb is None else 'DIFF %s' % (bb,))
    elif f.endswith('.css.txt'):
        same = open(os.path.join(a,f)).read() == open(os.path.join(b,f)).read()
        print(f, 'same' if same else 'DIFF')
