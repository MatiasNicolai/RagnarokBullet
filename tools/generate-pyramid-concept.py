#!/usr/bin/env python
"""Generate a deterministic Pyramid level concept map.

Creates an original 793x1983 vertical bullet-hell background inspired by
classic desert crypt/dungeon visual language. It does not reuse pixels from
existing maps and does not overwrite runtime assets.
"""
from PIL import Image, ImageDraw, ImageFilter
import math, random
from pathlib import Path

W, H = 793, 1983
SEED = 0xA60A
rng = random.Random(SEED)
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "art-clean" / "pyramid-concept"
OUT.mkdir(parents=True, exist_ok=True)

# Palette: volcanic shadow, old sandstone, lapis, oxidized gold, ember.
BG = (9, 7, 8)
STONE = (78, 53, 34)
STONE_LIGHT = (134, 94, 52)
STONE_DARK = (35, 24, 20)
GOLD = (174, 119, 38)
LAPIS = (23, 81, 105)
EMBER = (244, 112, 34)

im = Image.new("RGB", (W, H), BG)
p = im.load()

# Multi-scale sandstone/noise base.
def value_noise(x, y):
    return (math.sin(x * .031 + math.sin(y * .013)) +
            math.sin(y * .043 - x * .009) * .55 +
            math.sin((x + y) * .117) * .18)

for y in range(H):
    depth = y / H
    for x in range(W):
        edge = abs(x - W / 2) / (W / 2)
        n = value_noise(x, y) + rng.uniform(-.30, .30)
        center = max(0, 1 - edge ** 1.6)
        base = 16 + 20 * center + 5 * n + 5 * depth
        p[x, y] = (int(base * 1.30), int(base * .88), int(base * .55))

d = ImageDraw.Draw(im, "RGBA")

# Playable central causeway, clear enough for bullets.
left, right = 137, 656
d.rectangle((left, 0, right, H), fill=(73, 50, 32, 255))

# Large rectangular stone slabs with chipped seams.
row_h = 72
y = -20
row = 0
while y < H + row_h:
    offset = 0 if row % 2 == 0 else 54
    x = left - offset
    while x < right:
        ww = rng.randint(92, 142)
        tone = rng.randint(-10, 11)
        col = (max(25, 82 + tone), max(20, 57 + tone // 2), max(15, 35 + tone // 3), 255)
        d.rectangle((x + 2, y + 2, min(x + ww - 2, right), y + row_h - 2), fill=col)
        d.line((x + 2, y + 3, min(x + ww - 2, right), y + 3), fill=(166, 117, 66, 70), width=2)
        # cracks kept subtle in center
        if rng.random() < .55:
            cx = x + rng.randint(18, max(19, ww - 18))
            cy = y + rng.randint(12, row_h - 12)
            pts = [(cx, cy)]
            for _ in range(rng.randint(2, 5)):
                cx += rng.randint(-13, 13); cy += rng.randint(5, 15)
                pts.append((cx, cy))
            d.line(pts, fill=(28, 19, 17, 105), width=2)
        x += ww
    y += row_h
    row += 1

# Edge walls: dense funerary architecture, leaving center uncluttered.
for side in (-1, 1):
    wall_x0, wall_x1 = (0, left) if side < 0 else (right, W)
    d.rectangle((wall_x0, 0, wall_x1, H), fill=(22, 15, 14, 225))
    # stepped inner border
    for k, col in enumerate([(31,20,16,255),(83,55,31,255),(156,103,50,210),(39,26,20,255)]):
        x = left - 18 + k * 5 if side < 0 else right + 18 - k * 5
        d.line((x, 0, x, H), fill=col, width=4)

# Repeating side crypt bays with pillars, sarcophagi, niches and braziers.
def pillar(x, y0, y1, mirror=False):
    sx = -1 if mirror else 1
    d.rectangle((x-16, y0, x+16, y1), fill=(66,43,27,255), outline=(152,100,49,180), width=2)
    for yy in range(y0+10, y1-8, 15):
        d.line((x-12, yy, x+12, yy), fill=(31,20,17,190), width=2)
    d.polygon([(x-24,y0+8),(x+24,y0+8),(x+17,y0-7),(x-17,y0-7)], fill=(105,70,38,255))
    d.polygon([(x-23,y1-8),(x+23,y1-8),(x+17,y1+8),(x-17,y1+8)], fill=(105,70,38,255))

for bay, yy in enumerate(range(100, H-100, 245)):
    for side in (-1, 1):
        inner = left - 38 if side < 0 else right + 38
        outer = 46 if side < 0 else W - 46
        x0, x1 = sorted((outer-36, inner+36))
        d.rounded_rectangle((x0, yy, x1, yy+174), radius=10,
                            fill=(18,12,13,245), outline=(112,73,38,220), width=3)
        pillar(inner, yy+8, yy+166, side>0)
        # Sarcophagus lid, alternating orientation.
        cx = outer
        body = [(cx-28,yy+38),(cx+28,yy+38),(cx+36,yy+112),(cx+18,yy+148),(cx-18,yy+148),(cx-36,yy+112)]
        d.polygon(body, fill=(94,62,35,255), outline=(189,128,55,220))
        d.polygon([(cx-13,yy+56),(cx+13,yy+56),(cx+18,yy+91),(cx,yy+113),(cx-18,yy+91)],
                  fill=(24,68,78,230), outline=(208,148,55,210))
        d.ellipse((cx-10,yy+65,cx+10,yy+86), outline=(224,165,70,230), width=2)
        # Carved glyph rows.
        for gy in (yy+24, yy+156):
            for j in range(4):
                gx = x0+18+j*21
                d.rectangle((gx,gy,gx+9,gy+5), fill=(171,112,44,150))
                d.line((gx+4,gy-5,gx+4,gy+10), fill=(31,88,99,150), width=2)

# Four monumental gates create progression beats.
for gy in (350, 815, 1285, 1690):
    d.rectangle((left+15, gy-25, right-15, gy+31), fill=(38,24,19,230))
    d.line((left+35, gy, right-35, gy), fill=(192,128,49,190), width=4)
    # broken lintel leaves broad passage
    d.rectangle((left+28,gy-18,left+112,gy+24),fill=(93,59,31,255),outline=(173,111,50,210),width=2)
    d.rectangle((right-112,gy-18,right-28,gy+24),fill=(93,59,31,255),outline=(173,111,50,210),width=2)
    # central scarab floor seal, decorative but dark
    cx=W//2
    d.ellipse((cx-44,gy-20,cx+44,gy+20),fill=(35,66,68,130),outline=(202,137,52,190),width=3)
    d.ellipse((cx-12,gy-11,cx+12,gy+11),fill=(14,87,106,180),outline=(222,153,52,220),width=2)
    d.arc((cx-34,gy-16,cx-4,gy+16),80,280,fill=(214,150,58,180),width=3)
    d.arc((cx+4,gy-16,cx+34,gy+16),-100,100,fill=(214,150,58,180),width=3)

# Side braziers: warm pools kept at field edges.
light = Image.new("RGBA", (W,H), (0,0,0,0)); ld=ImageDraw.Draw(light,"RGBA")
for yy in range(205, H-100, 245):
    for xx in (left+18, right-18):
        for rad,a in ((78,10),(52,18),(28,34)):
            ld.ellipse((xx-rad,yy-rad,xx+rad,yy+rad),fill=(255,117,31,a))
        ld.polygon([(xx,yy-20),(xx-8,yy+7),(xx,yy+14),(xx+8,yy+7)],fill=(255,177,56,240))
        ld.ellipse((xx-9,yy+8,xx+9,yy+18),fill=(80,47,25,255),outline=(211,136,50,220))
light=light.filter(ImageFilter.GaussianBlur(14))
im=Image.alpha_composite(im.convert("RGBA"),light)
d=ImageDraw.Draw(im,"RGBA")

# Burial sand drift and rubble concentrated outside central combat lane.
for _ in range(850):
    side = rng.choice((-1,1))
    x = rng.randint(left-5, left+72) if side < 0 else rng.randint(right-72,right+5)
    y = rng.randrange(H)
    rr = rng.choice((1,1,1,2,2,3))
    col = rng.choice([(171,112,53,95),(221,160,76,70),(58,37,27,150)])
    d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=col)

# Sparse hieroglyph inlays along the lane edges.
for yy in range(45,H,92):
    for xx in (left+38,right-38):
        col=(29,112,125,95) if (yy//92)%3==0 else (190,126,46,75)
        d.line((xx-7,yy,xx+7,yy),fill=col,width=2)
        d.line((xx,yy-7,xx,yy+7),fill=col,width=2)
        d.rectangle((xx-4,yy-4,xx+4,yy+4),outline=col,width=1)

# Monumental guardian statues break the repeated crypt rhythm. They stay outside
# the central firing lane and read as carved architecture rather than enemies.
def guardian(cx, cy, face=1):
    # deep alcove and projected floor shadow
    d.ellipse((cx-58,cy+106,cx+58,cy+142),fill=(3,2,4,145))
    d.polygon([(cx-53,cy-92),(cx+53,cy-92),(cx+66,cy+112),(cx-66,cy+112)],
              fill=(16,11,12,245),outline=(126,80,38,210))
    # seated jackal-headed funerary guardian
    d.polygon([(cx-22,cy-54),(cx-10,cy-95),(cx+3,cy-62),(cx+20,cy-82),
               (cx+17,cy-35),(cx+31,cy+48),(cx+22,cy+101),(cx-28,cy+101),
               (cx-36,cy+48)],fill=(42,31,27,255),outline=(155,103,49,210))
    d.polygon([(cx-12,cy-61),(cx+18,cy-58),(cx+8,cy-24),(cx-17,cy-28)],
              fill=(24,70,76,210),outline=(207,143,57,220))
    d.ellipse((cx-2,cy-48,cx+3,cy-43),fill=(244,164,55,255))
    d.line((cx-20,cy+8,cx+22,cy+8),fill=(198,132,48,170),width=3)
    d.line((cx,cy-25,cx,cy+87),fill=(188,122,44,140),width=2)

for gx,gy in ((74,585),(719,1040),(75,1510)):
    guardian(gx,gy,1 if gx<W//2 else -1)

# Irregular collapsed bays, bones and broken masonry prevent wallpaper repetition.
for cx,cy in ((58,330),(730,760),(55,1215),(728,1760)):
    d.polygon([(cx-50,cy-60),(cx+44,cy-74),(cx+57,cy+74),(cx-30,cy+92)],
              fill=(7,5,7,220),outline=(76,48,29,210))
    for _ in range(18):
        rx=cx+rng.randint(-54,54); ry=cy+rng.randint(-72,84); rr=rng.randint(3,11)
        d.polygon([(rx-rr,ry),(rx,ry-rr//2),(rx+rr,ry+2),(rx-2,ry+rr)],
                  fill=rng.choice([(77,49,29,255),(111,72,37,235),(39,27,22,255)]))
for _ in range(45):
    side=rng.choice((-1,1)); x=rng.randint(left+8,left+82) if side<0 else rng.randint(right-82,right-8)
    y=rng.randrange(120,H-80)
    if rng.random()<.35:
        d.arc((x-9,y-3,x+9,y+9),180,355,fill=(185,157,111,100),width=2)
        d.line((x-7,y+5,x+8,y+2),fill=(185,157,111,85),width=2)

# Worn central traffic path and dust pools add depth without compromising bullet readability.
wear=Image.new('RGBA',(W,H),(0,0,0,0)); wd=ImageDraw.Draw(wear,'RGBA')
for _ in range(950):
    y=rng.randrange(H); spread=92+int(28*math.sin(y*.009)); x=int(rng.gauss(W/2,spread))
    if left+75 < x < right-75:
        rr=rng.choice((1,1,2,2,3,5));
        wd.ellipse((x-rr,y-rr,x+rr,y+rr),fill=rng.choice([(20,13,15,22),(222,157,72,13),(7,6,10,18)]))
wear=wear.filter(ImageFilter.GaussianBlur(1.1))
im=Image.alpha_composite(im,wear); d=ImageDraw.Draw(im,'RGBA')

# A ritual solar mosaic halfway through the descent, low contrast under bullets.
mx,my=W//2,1110
for rad,col,wid in ((92,(24,75,82,80),3),(67,(205,137,48,105),3),(35,(25,98,111,115),2)):
    d.ellipse((mx-rad,my-rad//2,mx+rad,my+rad//2),outline=col,width=wid)
for ang in range(0,360,20):
    a=math.radians(ang); d.line((mx+42*math.cos(a),my+21*math.sin(a),
                                 mx+80*math.cos(a),my+40*math.sin(a)),fill=(190,124,43,75),width=2)

# A distant sealed solar door at the top hints at Amon-Ra's chamber.
d.rounded_rectangle((278,18,515,190),radius=65,fill=(21,14,14,245),outline=(185,121,43,230),width=5)
d.arc((310,46,483,215),180,360,fill=(235,168,68,230),width=5)
d.ellipse((365,68,428,131),fill=(111,57,24,255),outline=(246,177,66,240),width=4)
d.polygon([(397,61),(410,91),(397,120),(384,91)],fill=(25,105,124,230))
for ang in range(0,360,30):
    a=math.radians(ang); x0=397+40*math.cos(a); y0=99+40*math.sin(a); x1=397+57*math.cos(a); y1=99+57*math.sin(a)
    d.line((x0,y0,x1,y1),fill=(225,153,53,190),width=3)

# Edge vignette + warm depth grade.
vig=Image.new("RGBA",(W,H),(0,0,0,0)); vd=ImageDraw.Draw(vig,"RGBA")
for i in range(95):
    a=int((1-i/95)*2.1)
    vd.rectangle((i,0,W-1-i,H-1),outline=(0,0,6,a),width=1)
# top mystery shadow and bottom entrance warmth
for y in range(H):
    top_shadow=max(0,1-y/420)
    bottom_warm=max(0,(y-(H-360))/360)
    if top_shadow: vd.line((0,y,W,y),fill=(0,0,5,int(85*top_shadow)))
    if bottom_warm: vd.line((0,y,W,y),fill=(100,42,5,int(20*bottom_warm)))
im=Image.alpha_composite(im,vig)

# Downsample/upsample micro-softening then sharpen: painterly-pixel hybrid.
im=im.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.2,percent=125,threshold=3))
out=OUT/"pyramid001-concept.png"
im.save(out,optimize=True)
print(out)
print(f"{W}x{H} RGB seed={SEED}")
