#!/usr/bin/env python3
import os
import re
import signal
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKSPACE = os.path.dirname(ROOT)
PORT = 5202
START_SERVER = os.environ.get('STREAMIT_START_SERVER', '1') == '1'
BASE = os.environ.get('STREAMIT_BASE_URL', f'http://localhost:{PORT}').rstrip('/')
PREFIX = os.environ.get('STREAMIT_EVIDENCE_PREFIX', 'metadata-search')
dev = None
log_handle = None
errors = []


def fail(message):
    raise RuntimeError(message)


def shot(page, name):
    directory = os.path.join(WORKSPACE, 'evidence')
    os.makedirs(directory, exist_ok=True)
    page.screenshot(path=os.path.join(directory, f'{PREFIX}-{name}.png'), full_page=False)


def open_page(browser, path, width=1440, height=900, reduced_motion=None):
    options = {'viewport': {'width': width, 'height': height}}
    if reduced_motion:
        options['reduced_motion'] = reduced_motion
    page = browser.new_page(**options)
    page.on('pageerror', lambda error: errors.append(f'{path}: {error}'))
    response = page.goto(BASE + path, wait_until='domcontentloaded', timeout=60000)
    if response is not None and response.status >= 400:
        fail(f'{path} returned HTTP {response.status}')
    page.wait_for_timeout(1600)
    return page


def clean_public_ui(page, path):
    body = page.locator('body').inner_text()
    if re.search(r'\bIMDb\b|%\s*Match', body, re.I):
        fail(f'forbidden rating text on {path}')
    forbidden = page.locator('.p-rating, .pv-match, .crating, .cs-lang, .lang-card, .lang-name, .lang-count, .stars, .star-input, .review-card, .review-form')
    if forbidden.count():
        fail(f'forbidden rating/language/review UI on {path}: {forbidden.count()} elements')
    header = page.locator('header.site-header')
    if header.count():
        if header.locator('.lang-pill, [aria-label="Downloads"], .icon-btn-dark').count():
            fail(f'header Download/language control remains on {path}')
        if re.search(r'\bEN\b', header.inner_text()):
            fail(f'EN selector remains on {path}')
    if page.get_by_role('tab', name=re.compile('Reviews', re.I)).count():
        fail(f'Reviews tab remains on {path}')


def no_overflow(page, path):
    overflow = page.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
    if overflow > 2:
        shot(page, 'overflow-failure')
        fail(f'horizontal overflow on {path}: {overflow}px')


def open_spotlight(page):
    trigger = page.get_by_role('button', name='Search', exact=True)
    trigger.click()
    dialog = page.get_by_role('dialog', name='Search the catalogue', exact=True)
    dialog.wait_for(state='visible', timeout=10000)
    return dialog


def exercise_spotlight(browser):
    page = open_page(browser, '/')
    dialog = open_spotlight(page)
    if 'Find Sermons, Shows and Teachings' not in dialog.inner_text():
        fail('Spotlight catalogue subtitle missing')
    shortcuts = dialog.locator('.spotlight-shortcut')
    if shortcuts.count() != 5:
        fail(f'expected 5 persistent Spotlight shortcuts, got {shortcuts.count()}')
    for label in ('Sermons', 'Shows', 'Teachings', 'Live TV', 'Coming Soon'):
        if not dialog.get_by_role('button', name=label, exact=True).is_visible():
            fail(f'Spotlight shortcut not visible: {label}')
    shot(page, 'spotlight-desktop')
    dialog.get_by_role('button', name='Teachings', exact=True).click()
    page.wait_for_url(re.compile(r'/teachings/?$'), timeout=15000)
    page.wait_for_timeout(400)
    if page.locator('.spotlight-panel').count():
        fail('Spotlight stayed open after category navigation')

    dialog = open_spotlight(page)
    search = dialog.get_by_role('combobox', name='Search Sermons, Shows and Teachings')
    search.fill('a')
    page.wait_for_function("document.querySelectorAll('.spotlight-result').length > 0", timeout=20000)
    count = dialog.locator('.spotlight-result').count()
    if count < 2:
        fail(f'not enough live results for keyboard replay: {count}')
    search.press('End')
    if dialog.locator('.spotlight-result[aria-selected="true"]').count() != 1:
        fail('End did not select a result')
    search.press('Home')
    if dialog.locator('.spotlight-result').first.get_attribute('aria-selected') != 'true':
        fail('Home did not select first result')
    search.press('ArrowDown')
    if dialog.locator('.spotlight-result').nth(1).get_attribute('aria-selected') != 'true':
        fail('ArrowDown did not select second result')
    search.press('ArrowUp')
    if dialog.locator('.spotlight-result').first.get_attribute('aria-selected') != 'true':
        fail('ArrowUp did not return to first result')
    shot(page, 'spotlight-results-desktop')
    search.press('Enter')
    page.wait_for_url(re.compile(r'/(movie|tv-show|teaching|channel)/\d+'), timeout=15000)
    page.wait_for_timeout(400)
    if page.locator('.spotlight-panel').count():
        fail('Spotlight stayed open after keyboard result navigation')

    dialog = open_spotlight(page)
    if dialog.get_by_role('combobox').input_value() != '':
        fail('Spotlight query did not reset on reopen')
    trigger = page.get_by_role('button', name='Search', exact=True)
    dialog.get_by_role('button', name='Close catalogue search', exact=True).click()
    page.wait_for_timeout(350)
    if page.locator('.spotlight-panel').count():
        fail('explicit close button failed')
    if page.evaluate("document.activeElement && document.activeElement.getAttribute('aria-label')") != 'Search':
        fail('focus was not restored to Search trigger')

    dialog = open_spotlight(page)
    page.keyboard.press('Escape')
    page.wait_for_timeout(350)
    if page.locator('.spotlight-panel').count():
        fail('Escape close failed')
    dialog = open_spotlight(page)
    page.mouse.click(2, 2)
    page.wait_for_timeout(350)
    if page.locator('.spotlight-panel').count():
        fail('backdrop close failed')
    page.close()

    mobile = open_page(browser, '/', width=390, height=844)
    dialog = open_spotlight(mobile)
    no_overflow(mobile, 'mobile Spotlight')
    bounds = dialog.bounding_box()
    if not bounds or bounds['x'] < 0 or bounds['x'] + bounds['width'] > 391:
        fail(f'mobile Spotlight exceeds viewport: {bounds}')
    if dialog.locator('.spotlight-shortcut:visible').count() != 5:
        fail('mobile category shortcuts are not all visible')
    shot(mobile, 'spotlight-mobile')
    dialog.get_by_role('combobox').fill('a')
    mobile.wait_for_function("document.querySelectorAll('.spotlight-result').length > 0", timeout=20000)
    no_overflow(mobile, 'mobile Spotlight results')
    shot(mobile, 'spotlight-results-mobile')
    mobile.keyboard.press('Escape')
    mobile.close()

    reduced = open_page(browser, '/', reduced_motion='reduce')
    dialog = open_spotlight(reduced)
    duration = dialog.locator('.spotlight-close').evaluate("el => getComputedStyle(el).transitionDuration")
    if duration not in ('0s', '0s, 0s, 0s'):
        fail(f'reduced-motion close transition is {duration}')
    reduced.keyboard.press('Escape')
    reduced.close()


def exercise_detail(browser, path, name):
    page = open_page(browser, path)
    clean_public_ui(page, path)
    if not page.locator('.detail-title').is_visible():
        fail(f'{name} detail title missing')
    if not page.locator('.watch-section').is_visible():
        fail(f'{name} playback section missing')
    if page.locator('.watch-section iframe, .watch-section .trailer-wrap').count() < 1:
        fail(f'{name} playback container missing')
    if not page.locator('.detail-tabs').is_visible():
        fail(f'{name} blue detail tabs missing')
    if page.get_by_role('button', name=re.compile('watchlist', re.I)).count() < 1:
        fail(f'{name} watchlist control missing')
    for tab, panel in (('Bible', '.bible-panel'), ('Notes', '.notes-panel')):
        page.get_by_role('tab', name=tab, exact=True).click()
        page.wait_for_timeout(250)
        if not page.locator(panel).is_visible():
            fail(f'{name} {tab} panel failed')
    if name == 'sermon':
        shot(page, 'sermon-notes-desktop')
    page.close()


try:
    os.makedirs(os.path.join(WORKSPACE, '.tmp'), exist_ok=True)
    if START_SERVER:
        log_handle = open(os.path.join(WORKSPACE, '.tmp', 'metadata-search-dev.log'), 'w')
        dev = subprocess.Popen(['npm', 'run', 'dev', '--', '--port', str(PORT), '--strictPort'], cwd=ROOT, stdout=log_handle, stderr=subprocess.STDOUT, start_new_session=True)
        deadline = time.time() + 90
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(BASE + '/', timeout=5) as response:
                    if response.status == 200:
                        break
            except Exception:
                time.sleep(1.5)
        else:
            fail('dev server never came up')

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = open_page(browser, '/')
        clean_public_ui(page, '/')
        body = page.locator('body').inner_text()
        for label in ('New Released Sermons', 'Popular Shows', 'Teachings'):
            if label not in body:
                fail(f'home missing {label}')
        if 'Popular Language' in body:
            fail('homepage Languages rail remains')
        first_card = page.locator('.p-card').first
        first_card.hover()
        page.wait_for_timeout(750)
        preview = first_card.locator('.pv-card.open')
        if preview.count() != 1:
            fail('delayed hover preview interaction regressed')
        clean_public_ui(page, '/ hover preview')
        shot(page, 'home-hover-desktop')
        page.mouse.move(0, 0)
        page.close()

        listings = {}
        for path, label in (('/movies', 'Sermons'), ('/tv-shows', 'Shows'), ('/teachings', 'Teachings')):
            listing = open_page(browser, path)
            clean_public_ui(listing, path)
            if listing.locator('.section-head h2', has_text=label).count() < 1:
                fail(f'{path} missing {label} heading')
            if listing.locator('.p-card').count() < 1:
                fail(f'{path} has no admin content cards')
            listings[path] = listing.locator('.p-card').first.get_attribute('href')
            if path == '/teachings':
                shot(listing, 'teachings-desktop')
            listing.close()

        for path in ('/videos', '/coming-soon', '/search?q=teaching', '/page/privacy-policy'):
            other = open_page(browser, path)
            clean_public_ui(other, path)
            if path == '/coming-soon':
                shot(other, 'coming-soon-desktop')
            if path == '/page/privacy-policy' and 'Privacy' not in other.locator('body').inner_text():
                fail('custom Privacy page content missing')
            other.close()

        exercise_detail(browser, '/movie/108', 'sermon')
        exercise_detail(browser, listings['/tv-shows'], 'show')
        exercise_detail(browser, listings['/teachings'], 'teaching')
        video = open_page(browser, '/video/50')
        clean_public_ui(video, '/video/50')
        if not video.locator('.watch-section').is_visible():
            fail('video playback section missing')
        shot(video, 'video-desktop')
        video.close()

        exercise_spotlight(browser)

        mobile_paths = ['/', '/movies', '/tv-shows', '/teachings', listings['/tv-shows'], listings['/teachings'], '/movie/108', '/video/50', '/videos', '/coming-soon', '/search?q=teaching', '/page/privacy-policy']
        for path in mobile_paths:
            mobile = open_page(browser, path, width=390, height=844)
            clean_public_ui(mobile, path)
            no_overflow(mobile, path)
            if path == '/':
                shot(mobile, 'home-mobile')
            if path == '/movie/108':
                shot(mobile, 'sermon-mobile')
            mobile.close()
        browser.close()

    if errors:
        fail('browser page errors: ' + '; '.join(errors[:8]))
    print('METADATA_SEARCH_LIVE_OK')
except Exception as error:
    print('FAIL: ' + str(error), file=sys.stderr)
    sys.exit(1)
finally:
    if dev is not None:
        try:
            os.killpg(dev.pid, signal.SIGTERM)
            dev.wait(timeout=10)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            if dev.poll() is None:
                os.killpg(dev.pid, signal.SIGKILL)
    if log_handle is not None:
        log_handle.close()
