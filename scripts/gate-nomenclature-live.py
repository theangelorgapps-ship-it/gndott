#!/usr/bin/env python3
import os
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKSPACE = os.path.dirname(ROOT)
PORT = 5201
BASE = f'http://localhost:{PORT}'
dev = None
log_handle = None


def fail(message):
    raise RuntimeError(message)


def open_page(browser, path, width=1440, height=900):
    page = browser.new_page(viewport={'width': width, 'height': height})
    page.goto(BASE + path, wait_until='domcontentloaded', timeout=60000)
    page.wait_for_timeout(2200)
    return page


try:
    os.makedirs(os.path.join(WORKSPACE, '.tmp'), exist_ok=True)
    os.makedirs(os.path.join(WORKSPACE, 'evidence'), exist_ok=True)
    log_handle = open(os.path.join(WORKSPACE, '.tmp', 'nomenclature-dev.log'), 'w')
    dev = subprocess.Popen(['npm', 'run', 'dev', '--', '--port', str(PORT), '--strictPort'], cwd=ROOT, stdout=log_handle, stderr=subprocess.STDOUT)
    deadline = time.time() + 90
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(BASE + '/teachings', timeout=5) as response:
                if response.status == 200:
                    break
        except Exception:
            time.sleep(1.5)
    else:
        fail('dev server never came up')

    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = open_page(browser, '/')
        page.on('pageerror', lambda error: errors.append(str(error)))
        body = page.locator('body').inner_text()
        for label in ('Sermons', 'Shows', 'Teachings', 'New Released Sermons', 'Popular Shows'):
            if label not in body:
                fail(f'home missing {label}')
        if 'Popular TV Shows' in body or 'New Released Movies' in body:
            fail('old home nomenclature remains')
        page.get_by_role('button', name='Search', exact=True).click()
        page.wait_for_timeout(500)
        page.locator('input').last.hover()
        page.wait_for_timeout(1000)
        if not page.get_by_role('button', name='Teachings', exact=True).is_visible():
            fail('Spotlight Teachings shortcut is not visible')
        page.keyboard.press('Escape')
        page.close()

        teachings = open_page(browser, '/teachings')
        if teachings.locator('.p-card').count() < 1:
            fail('Teachings does not render admin collection')
        first_href = teachings.locator('.p-card').first.get_attribute('href')
        if not first_href or not first_href.startswith('/teaching/'):
            fail(f'invalid Teaching detail URL: {first_href}')
        teachings.screenshot(path=os.path.join(WORKSPACE, 'evidence', 'nomenclature-teachings-desktop.png'), full_page=True)
        teachings.close()

        detail = open_page(browser, first_href)
        detail_text = detail.locator('body').inner_text()
        if 'Volume' not in detail_text or 'Episodes' not in detail_text:
            detail.screenshot(path=os.path.join(WORKSPACE, 'evidence', 'nomenclature-teaching-detail-failure.png'), full_page=True)
            fail('Teaching hierarchy does not use Volumes/Episodes: ' + detail_text[:1600])
        for tab in ('Featured', 'Bible', 'Notes'):
            if not detail.get_by_role('tab', name=tab, exact=True).count():
                fail(f'Teaching missing {tab} tab')
        detail.get_by_role('tab', name='Bible', exact=True).click()
        detail.wait_for_timeout(400)
        if not detail.locator('.bible-panel').is_visible():
            fail('Teaching Bible tab failed')
        detail.close()

        sermons = open_page(browser, '/movies')
        if '<h2>Sermons</h2>' not in sermons.locator('.section-head').inner_html():
            fail('Sermons listing heading missing')
        sermons.close()
        shows = open_page(browser, '/tv-shows')
        if '<h2>Shows</h2>' not in shows.locator('.section-head').inner_html():
            fail('Shows listing heading missing')
        shows.close()

        search = open_page(browser, '/search?q=teaching')
        if not search.locator('.section-head h2', has_text='Teachings').count():
            fail('Search does not render Teachings results')
        search.close()

        for path in ('/videos', '/video/50'):
            video = open_page(browser, path)
            text = video.locator('body').inner_text()
            if 'IMDb' in text or 'IMDB' in text:
                fail(f'video IMDb visible on {path}')
            if video.locator('.p-rating, .pv-match').count():
                fail(f'video rating badge or Match remains on {path}')
            if path == '/video/50':
                video.screenshot(path=os.path.join(WORKSPACE, 'evidence', 'nomenclature-video-desktop.png'), full_page=True)
            video.close()

        movie = open_page(browser, '/movie/108')
        if 'IMDb' not in movie.locator('body').inner_text():
            fail('non-video IMDb positive control missing on sermon detail')
        movie.close()

        mobile_paths = ['/', '/movies', '/tv-shows', '/teachings', first_href, '/videos', '/video/50', '/search?q=teaching']
        for path in mobile_paths:
            mobile = open_page(browser, path, width=390, height=844)
            overflow = mobile.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
            if overflow > 2:
                mobile.screenshot(path=os.path.join(WORKSPACE, 'evidence', 'nomenclature-overflow.png'), full_page=True)
                fail(f'horizontal overflow on {path}: {overflow}px')
            if path == '/teachings':
                mobile.screenshot(path=os.path.join(WORKSPACE, 'evidence', 'nomenclature-teachings-mobile.png'), full_page=True)
            mobile.close()
        browser.close()

    if errors:
        fail('page errors: ' + '; '.join(errors[:5]))
    print('NOMENCLATURE_LIVE_OK')
except Exception as error:
    print('FAIL: ' + str(error), file=sys.stderr)
    sys.exit(1)
finally:
    if dev is not None:
        dev.terminate()
        try:
            dev.wait(timeout=10)
        except subprocess.TimeoutExpired:
            dev.kill()
    if log_handle is not None:
        log_handle.close()
    subprocess.run(['bash', '-c', f'lsof -ti tcp:{PORT} | xargs kill 2>/dev/null'], check=False)
