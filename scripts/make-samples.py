"""Render the demo sample illustrations (public/samples/*.jpg) with Playwright.
Each image is labeled as an illustration so it is never mistaken for a real photo.
Run: python3 scripts/make-samples.py
"""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'samples')
os.makedirs(OUT, exist_ok=True)

SKY = '<rect width="800" height="260" fill="#bfe0ea"/>'
SEA = '<rect y="200" width="800" height="150" fill="#2f7f8f"/><path d="M0 230 Q100 215 200 230 T400 230 T600 230 T800 230" stroke="#9cd3db" stroke-width="4" fill="none"/>'
SAND = '<rect y="340" width="800" height="260" fill="#e8d6a8"/>'


def mats(n, color, seed):
    out = []
    for i in range(n):
        x = (i * 97 + seed * 31) % 760
        y = 330 + (i * 53 + seed * 17) % 120
        w = 90 + (i * 37) % 80
        out.append(f'<ellipse cx="{x}" cy="{y}" rx="{w}" ry="{18 + (i * 7) % 14}" fill="{color}" opacity="0.92"/>')
    return ''.join(out)


def label(text):
    return (f'<rect x="16" y="552" width="768" height="34" rx="6" fill="rgba(0,0,0,.55)"/>'
            f'<text x="30" y="575" font-family="Arial" font-size="18" fill="#fff">{text}</text>')


SCENES = {
    'A_before': SKY + SEA + SAND + mats(14, '#7a5a1e', 1) + mats(8, '#4d3a14', 2)
    + label('Sample illustration: sargassum on the beach, before cleanup'),
    'A_after_good': SKY + SEA + SAND
    + ''.join(f'<rect x="{560 + (i % 4) * 46}" y="{300 + (i // 4) * 40}" width="40" height="36" rx="8" fill="#2b2b2b"/>' for i in range(12))
    + label('Sample illustration: same spot after cleanup, material bagged'),
    'A_after_partial': SKY + SEA + SAND + mats(10, '#7a5a1e', 3)
    + ''.join(f'<rect x="{640 + (i % 2) * 46}" y="{330 + (i // 2) * 40}" width="40" height="36" rx="8" fill="#2b2b2b"/>' for i in range(4))
    + label('Sample illustration: cleanup only partly done'),
    'A_ppe': '<rect width="800" height="600" fill="#d9d4c7"/>'
    + '<rect x="80" y="120" width="160" height="200" rx="30" fill="#2c6fbb"/><rect x="270" y="120" width="160" height="200" rx="30" fill="#2c6fbb"/>'
    + '<rect x="480" y="150" width="90" height="230" rx="14" fill="#1f1f1f"/><rect x="590" y="150" width="90" height="230" rx="14" fill="#1f1f1f"/>'
    + '<ellipse cx="200" cy="420" rx="110" ry="40" fill="none" stroke="#333" stroke-width="10"/>'
    + '<rect x="380" y="400" width="120" height="80" rx="12" fill="#f2c200"/><text x="395" y="450" font-family="Arial" font-size="26" fill="#222">H2S</text>'
    + label('Sample illustration: gloves, boots, safety glasses, H2S monitor'),
    'A_truck': SKY + '<rect y="380" width="800" height="220" fill="#8c8c8c"/>'
    + '<rect x="160" y="250" width="380" height="150" rx="8" fill="#c0392b"/><ellipse cx="350" cy="250" rx="190" ry="40" fill="#7a5a1e"/>'
    + '<rect x="540" y="290" width="130" height="110" rx="10" fill="#a93226"/><circle cx="240" cy="410" r="36" fill="#222"/><circle cx="600" cy="410" r="36" fill="#222"/>'
    + label('Sample illustration: truck loaded with collected sargassum'),
    'B_river': '<rect width="800" height="600" fill="#9fc28a"/>'
    + '<path d="M0 260 C200 220 300 340 500 300 S800 260 800 260 L800 420 C600 400 520 470 300 440 S0 420 0 420 Z" fill="#6b8f8a"/>'
    + ''.join(f'<ellipse cx="{120 + i * 60}" cy="{330 + (i % 3) * 18}" rx="34" ry="12" fill="#f4f4f0" opacity=".95"/>' for i in range(10))
    + '<rect x="620" y="170" width="44" height="64" rx="6" fill="#1d5c9b"/><rect x="672" y="176" width="44" height="58" rx="6" fill="#1d5c9b"/>'
    + '<path d="M560 230 L600 300" stroke="#444" stroke-width="14"/>'
    + label('Sample illustration: white foam in a river, drums on the bank (seen from afar)'),
    'B_labslip': '<rect width="800" height="600" fill="#cfd6dc"/><rect x="170" y="70" width="460" height="470" fill="#fff" stroke="#999"/>'
    + '<text x="200" y="120" font-family="Arial" font-size="26" fill="#222">Chain of custody form</text>'
    + ''.join(f'<rect x="200" y="{150 + i * 42}" width="{380 - (i % 3) * 60}" height="14" fill="#c8c8c8"/>' for i in range(8))
    + '<text x="200" y="510" font-family="Arial" font-size="20" fill="#222">Sample ID: DEMO-0001</text>'
    + label('Sample illustration: laboratory chain-of-custody form'),
}

STAIRS = ('<rect width="800" height="600" fill="#b9b3a6"/>'
          '<polygon points="0,600 800,600 800,470 0,470" fill="#e4e1da"/><rect y="440" width="800" height="30" fill="#cfcac0"/>'
          '<polygon points="0,440 800,440 800,330 0,330" fill="#e8e5de"/><rect y="300" width="800" height="30" fill="#d3cec4"/>'
          '<polygon points="0,300 800,300 800,200 0,200" fill="#ebe8e2"/><rect y="170" width="800" height="30" fill="#d6d1c7"/>'
          '<rect y="0" width="800" height="170" fill="#8f8a80"/>'
          '<line x1="0" y1="331" x2="800" y2="331" stroke="#3a3a3a" stroke-width="6"/>'
          '<rect x="600" y="150" width="70" height="26" fill="#6b3a1f"/><rect x="622" y="20" width="22" height="140" fill="#2b2b2b"/>'
          '<line x1="240" y1="40" x2="640" y2="160" stroke="#2b2b2b" stroke-width="14"/>')
CRACK = '<path d="M610 176 L596 214 L606 246 L588 286 L598 330" stroke="#222" stroke-width="6" fill="none"/>'
RUST = '<rect x="300" y="300" width="120" height="28" fill="#b5651d" opacity=".7"/>'

SCENES.update({
    'C_stairs': STAIRS + CRACK + RUST + label('Sample illustration: crack from the handrail base, rust stain, open gap between steps'),
    'C_cones': STAIRS + CRACK + RUST
    + '<polygon points="520,330 560,330 540,250" fill="#f26b1d"/><rect x="522" y="300" width="36" height="8" fill="#fff"/>'
    + '<polygon points="680,330 720,330 700,250" fill="#f26b1d"/><rect x="682" y="300" width="36" height="8" fill="#fff"/>'
    + '<line x1="540" y1="262" x2="700" y2="262" stroke="#f2c200" stroke-width="6" stroke-dasharray="18 10"/>'
    + label('Sample illustration: warning cones and tape at the damaged step'),
    'C_mail': '<rect width="800" height="600" fill="#cfd6dc"/><rect x="160" y="120" width="480" height="300" fill="#fff" stroke="#888"/>'
    + '<rect x="160" y="120" width="480" height="40" fill="#2a4d8f"/><text x="180" y="148" font-family="Arial" font-size="20" fill="#fff">CERTIFIED MAIL RECEIPT</text>'
    + '<text x="180" y="200" font-family="Arial" font-size="18" fill="#222">Tracking: 9400 0000 0000 0000 0000 00</text>'
    + ''.join(f'<rect x="180" y="{230 + i * 30}" width="{380 - i * 40}" height="12" fill="#c8c8c8"/>' for i in range(5))
    + label('Sample illustration: certified mail receipt (not a real tracking number)'),
    'C_report': '<rect width="800" height="600" fill="#cfd6dc"/><rect x="200" y="50" width="400" height="500" fill="#fff" stroke="#999"/>'
    + '<text x="230" y="110" font-family="Arial" font-size="22" fill="#222">Structural Condition Report</text>'
    + ''.join(f'<rect x="230" y="{140 + i * 34}" width="{330 - (i % 3) * 50}" height="12" fill="#c8c8c8"/>' for i in range(8))
    + '<circle cx="500" cy="460" r="50" fill="none" stroke="#2a4d8f" stroke-width="6"/><text x="468" y="466" font-family="Arial" font-size="16" fill="#2a4d8f">P.E. SEAL</text>'
    + label('Sample illustration: engineering report cover (not a real seal)'),
})

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 800, 'height': 600})
    for name, body in SCENES.items():
        page.set_content(f'<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">{body}</svg></body></html>')
        page.screenshot(path=os.path.join(OUT, name + '.jpg'), type='jpeg', quality=82)
        print('wrote', name)
    browser.close()
