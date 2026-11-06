#!/usr/bin/env python3
import os
from playwright.sync_api import sync_playwright

workspace = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = os.path.join(workspace, 'evidence')
os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    desktop = browser.new_page(viewport={'width': 1440, 'height': 900})
    desktop.goto('https://gndott.theangelorgapps.workers.dev/teachings', wait_until='networkidle', timeout=60000)
    desktop.screenshot(path=os.path.join(out, 'nomenclature-live-teachings.png'), full_page=False)
    assert desktop.locator('.p-card').count() >= 1
    assert 'Teachings' in desktop.locator('body').inner_text()
    mobile = browser.new_page(viewport={'width': 390, 'height': 844})
    mobile.goto('https://gndott.theangelorgapps.workers.dev/video/50', wait_until='networkidle', timeout=60000)
    assert 'IMDb' not in mobile.locator('body').inner_text()
    assert mobile.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth') <= 2
    mobile.screenshot(path=os.path.join(out, 'nomenclature-live-video-mobile.png'), full_page=False)
    browser.close()
print('LIVE_CAPTURE_OK')
