#!/usr/bin/env python3
import os
import re
import signal
import subprocess
import sys
import time
import urllib.request
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKSPACE = os.path.dirname(ROOT)
PORT = 5202
START_SERVER = os.environ.get('STREAMIT_START_SERVER', '1') == '1'
BASE = os.environ.get('STREAMIT_BASE_URL', f'http://localhost:{PORT}').rstrip('/')
PREFIX = os.environ.get('STREAMIT_EVIDENCE_PREFIX', 'experience-local')
EXPECTED_NAV = ['Home', 'Sermons', 'Teachings', 'Shows', 'Videos', 'Live TV', 'Watchlist']
dev = None
log_handle = None
errors = []


def fail(message):
    raise RuntimeError(message)


def shot(page, name):
    directory = os.path.join(WORKSPACE, 'evidence')
    os.makedirs(directory, exist_ok=True)
    page.screenshot(path=os.path.join(directory, f'{PREFIX}-{name}.png'), full_page=False)


def open_page(browser, path, width=1440, height=900, reduced_motion=None, settle=1400):
    options = {'viewport': {'width': width, 'height': height}}
    if reduced_motion:
        options['reduced_motion'] = reduced_motion
    page = browser.new_page(**options)
    page.on('pageerror', lambda error: errors.append(f'{path}: {error}'))
    response = page.goto(BASE + path, wait_until='domcontentloaded', timeout=60000)
    if response is not None and response.status >= 400:
        fail(f'{path} returned HTTP {response.status}')
    page.locator('header.site-header').wait_for(state='visible', timeout=30000)
    if settle:
        page.wait_for_timeout(settle)
    return page


def no_overflow(page, path):
    dimensions = page.evaluate('() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, width: document.documentElement.clientWidth })')
    if dimensions['overflow'] > 2:
        shot(page, 'overflow-failure')
        fail(f'horizontal overflow on {path}: {dimensions["overflow"]}px')


def check_nonhero_clearance(page, path):
    if page.locator('main.page-enter .hero').count():
        return
    header_box = page.locator('header.site-header').bounding_box()
    padding = page.locator('main.page-enter').evaluate("el => parseFloat(getComputedStyle(el).paddingTop)")
    if not header_box or padding < header_box['y'] + header_box['height'] + 4:
        fail(f'non-hero content lacks floating-header clearance on {path}: padding={padding}, header={header_box}')


def clean_public_ui(page, path):
    body = page.locator('body').inner_text()
    if re.search(r'\bIMDb\b|%\s*Match|\bNR\b', body, re.I):
        fail(f'forbidden rating or age metadata on {path}')
    forbidden = page.locator('.p-rating, .pv-match, .crating, .cs-lang, .lang-card, .lang-name, .lang-count, .stars, .star-input, .review-card, .review-form')
    if forbidden.count():
        fail(f'forbidden rating/language/review UI on {path}: {forbidden.count()} elements')
    if page.get_by_role('tab', name=re.compile('Reviews|More Like This|Cast|Directors', re.I)).count():
        fail(f'retired detail tab remains on {path}')
    header = page.locator('header.site-header')
    if header.locator('.lang-pill, [aria-label="Downloads"], .icon-btn-dark').count():
        fail(f'retired header control remains on {path}')


def check_recommendations(page, path):
    groups = page.locator('.recommendation-groups').first
    if not groups.is_visible():
        fail(f'recommendation groups missing on {path}')
    text = groups.inner_text()
    for label in ('Featured for You', 'Discover Something Different', 'Recently Updated'):
        if label not in text:
            fail(f'{label} group missing on {path}')
    if 'Recommended for You' in text:
        fail(f'anonymous fallback is incorrectly labelled personalized on {path}')
    if groups.locator('.recommendation-discovery .p-card').count() != 1:
        fail(f'discovery must contain exactly one content card on {path}')
    if groups.locator('.p-card').count() < 3:
        fail(f'not enough existing catalogue content in recommendations on {path}')


def check_desktop_header(page):
    header = page.locator('header.site-header')
    nav = header.locator('.main-nav')
    labels = [text.strip() for text in nav.locator('a').all_inner_texts()]
    if labels != EXPECTED_NAV:
        fail(f'desktop navigation mismatch: {labels}')
    if 'Coming Soon' in header.inner_text() or 'All Content' in header.inner_text():
        fail('retired navigation entry remains')
    if header.evaluate("el => getComputedStyle(el).position") != 'fixed':
        fail('header is not fixed')
    if header.evaluate("el => getComputedStyle(el).zIndex") != '80':
        fail('header z-index is not 80')
    floating = header.evaluate("""el => {
        const style = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
            top: rect.top, left: rect.left, rightGap: innerWidth - rect.right,
            background: style.backgroundColor,
            blur: style.backdropFilter || style.webkitBackdropFilter,
            radius: parseFloat(style.borderTopLeftRadius),
        }
    }""")
    if abs(floating['top'] - 12) > 1 or abs(floating['left'] - 20) > 1 or abs(floating['rightGap'] - 20) > 1:
        fail(f'header does not float with desktop viewport insets: {floating}')
    alpha = re.search(r'rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)', floating['background'])
    if not alpha or not 0 < float(alpha.group(1)) < 1:
        fail(f'header background is not translucent: {floating["background"]}')
    if 'blur(' not in floating['blur'] or floating['radius'] < 12:
        fail(f'header lacks glass blur or rounded corners: {floating}')
    hero = page.locator('main.page-enter .hero').first
    hero_box = hero.bounding_box()
    if not hero_box or abs(hero_box['y']) > 1 or hero.evaluate("el => getComputedStyle(el).paddingTop") != '0px':
        fail(f'hero is displaced by the floating header: {hero_box}')
    header_box = header.bounding_box()
    if not header_box or header_box['y'] + header_box['height'] <= hero_box['y']:
        fail('header does not overlay the hero')
    if 'grid' not in header.locator('.site-header-bar').evaluate("el => getComputedStyle(el).display"):
        fail('header is not a grid')
    brand = header.locator('.brand').bounding_box()
    if not brand or abs(brand['width'] - 210) > 2 or abs(brand['height'] - 62) > 2:
        fail(f'desktop brand dimensions differ from reference: {brand}')
    nav_font = nav.locator('a').first.evaluate("el => getComputedStyle(el).fontSize")
    nav_gap = nav.evaluate("el => getComputedStyle(el).gap")
    if nav_font != '14.5px' or nav_gap != '26px':
        fail(f'desktop navigation type/gap mismatch: {nav_font}, {nav_gap}')
    cta = header.locator('.subscribe-glass').bounding_box()
    if not cta or abs(cta['width'] - 142) > 2 or abs(cta['height'] - 40) > 2:
        fail(f'metallic action dimensions differ from reference: {cta}')
    dot = header.locator('.live-nav-dot')
    if not dot.is_visible() or '251, 59, 98' not in dot.evaluate("el => getComputedStyle(el).backgroundColor"):
        fail('Live TV indicator does not match reference')


def open_spotlight(page):
    trigger = page.locator('header').get_by_role('button', name='Search', exact=True)
    if not trigger.is_visible():
        page.locator('header').get_by_role('button', name='Open menu', exact=True).click()
        page.locator('.mobile-menu-search').click()
    else:
        trigger.click()
    dialog = page.get_by_role('dialog', name='Search the catalogue', exact=True)
    dialog.wait_for(state='visible', timeout=10000)
    return dialog


def check_spotlight(page, mobile=False):
    dialog = open_spotlight(page)
    if dialog.locator('.spotlight-shortcut:visible').count() != 6:
        fail('Spotlight does not expose all six flattened destinations plus Watchlist')
    if 'Coming Soon' in dialog.inner_text():
        fail('Coming Soon remains in Spotlight')
    bounds = dialog.bounding_box()
    viewport = page.viewport_size
    if not bounds or bounds['x'] < -1 or bounds['y'] < -1 or bounds['x'] + bounds['width'] > viewport['width'] + 1 or bounds['y'] + bounds['height'] > viewport['height'] + 1:
        fail(f'Spotlight exceeds viewport: {bounds} vs {viewport}')
    no_overflow(page, 'mobile Spotlight' if mobile else 'desktop Spotlight')
    shot(page, 'spotlight-mobile' if mobile else 'spotlight-desktop')
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    if page.locator('.spotlight-panel').count():
        fail('Spotlight did not close with Escape')


def first_content_link(browser, listing):
    page = open_page(browser, listing)
    clean_public_ui(page, listing)
    card = page.locator('.p-card').first
    if not card.is_visible():
        fail(f'no existing admin content on {listing}')
    href = card.get_attribute('href')
    page.close()
    if not href:
        fail(f'content link missing on {listing}')
    return href


def check_episode_layout(page, path, mobile=False):
    layout = page.locator('.season-selector-layout')
    layout.wait_for(state='visible', timeout=10000)
    page.wait_for_timeout(650)
    summary = layout.locator('.season-summary')
    selector = layout.locator('.season-selector')
    if summary.count() != 1 or selector.count() != 1:
        fail(f'season summary/selector regions missing on {path}')
    if selector.locator('.episode-list').count() != 1:
        fail(f'episode list is not inside the selector column on {path}')
    summary_box = summary.bounding_box()
    selector_box = selector.bounding_box()
    if not summary_box or not selector_box:
        fail(f'season layout has no measurable bounds on {path}')
    if mobile:
        if selector_box['y'] < summary_box['y'] + summary_box['height'] - 3:
            fail(f'season selector does not stack below summary on mobile: {summary_box}, {selector_box}')
    elif selector_box['x'] < summary_box['x'] + summary_box['width'] - 3:
        fail(f'season selector is not right of summary on desktop: {summary_box}, {selector_box}')
    pills = selector.locator('.season-pills')
    if pills.count() and not pills.is_visible():
        fail(f'season pills are not visible in the selector column on {path}')


def check_detail(browser, path, kind):
    page = open_page(browser, path)
    clean_public_ui(page, path)
    if not page.locator('.detail-title').is_visible():
        fail(f'detail title missing on {path}')
    if not page.locator('.watch-section').is_visible() or page.locator('.watch-section .trailer-wrap').count() < 1:
        fail(f'playback container missing on {path}')
    actions = page.locator('.detail-info .hero-actions')
    if actions.locator('.btn-play').count() or actions.get_by_role('button', name=re.compile('^(?:Watch now|Play)$', re.I)).count():
        fail(f'redundant detail Watch now/Play action remains on {path}')
    if not actions.get_by_role('button', name='Share', exact=True).is_visible():
        fail(f'Share action missing on {path}')
    expected = ['Featured', 'Bible', 'Notes', 'About']
    if kind in ('show', 'teaching'):
        expected.insert(1, 'Volumes' if kind == 'teaching' else 'Episodes')
    tabs = page.locator('.detail-tabs [role="tab"]')
    labels = tabs.evaluate_all("els => els.map(el => el.getAttribute('title'))")
    if labels != expected:
        fail(f'tab order mismatch on {path}: {labels} != {expected}')
    if tabs.first.get_attribute('aria-selected') != 'true':
        fail(f'Featured is not the initial tab on {path}')
    check_recommendations(page, path)
    if kind != 'video' and page.get_by_role('button', name=re.compile('watchlist', re.I)).count() < 1:
        fail(f'watchlist control missing on {path}')
    if kind in ('show', 'teaching'):
        page.locator('.detail-tabs [role="tab"]').nth(1).click()
        page.locator('.episodes-panel').wait_for(state='visible', timeout=10000)
        check_episode_layout(page, path)
        shot(page, f'{kind}-episodes-desktop')
    page.get_by_role('tab', name='Bible', exact=True).click()
    page.locator('.bible-panel').wait_for(state='visible', timeout=10000)
    if 'Psalm 119:105' not in page.locator('.bible-panel').inner_text():
        fail(f'Bible panel failed on {path}')
    page.get_by_role('tab', name='Notes', exact=True).click()
    page.locator('.notes-panel textarea').wait_for(state='visible', timeout=10000)
    if kind == 'movie':
        note = f'Browser acceptance {int(time.time())}'
        page.locator('.notes-panel textarea').fill(note)
        page.get_by_role('button', name='Save note', exact=True).click()
        if 'Note saved on this device.' not in page.locator('.notes-status').inner_text():
            fail('Notes did not save locally')
        page.get_by_role('button', name='Clear', exact=True).click()
    page.get_by_role('tab', name='About', exact=True).click()
    page.locator('.about-panel').wait_for(state='visible', timeout=10000)
    page.wait_for_timeout(450)
    headings = page.locator('.about-column .section-head h2').all_inner_texts()
    if headings != ['Personality', 'Location']:
        fail(f'About headings mismatch on {path}: {headings}')
    columns = page.locator('.about-column')
    first = columns.nth(0).bounding_box()
    second = columns.nth(1).bounding_box()
    if not first or not second or abs(first['y'] - second['y']) > 3 or second['x'] <= first['x']:
        fail(f'About columns are not adjacent on desktop: {first}, {second}')
    no_overflow(page, path)
    shot(page, f'{kind}-about-desktop')
    page.close()

    mobile = open_page(browser, path, width=390, height=844)
    clean_public_ui(mobile, path)
    if kind in ('show', 'teaching'):
        mobile.locator('.detail-tabs [role="tab"]').nth(1).click()
        mobile.locator('.episodes-panel').wait_for(state='visible', timeout=10000)
        check_episode_layout(mobile, path, mobile=True)
        no_overflow(mobile, f'{path} episodes mobile')
        shot(mobile, f'{kind}-episodes-mobile')
    mobile.get_by_role('tab', name='About', exact=True).click()
    mobile.locator('.about-panel').wait_for(state='visible', timeout=10000)
    first = mobile.locator('.about-column').nth(0).bounding_box()
    second = mobile.locator('.about-column').nth(1).bounding_box()
    if not first or not second or second['y'] < first['y'] + first['height'] - 3:
        fail(f'About columns do not stack on mobile: {first}, {second}')
    no_overflow(mobile, path)
    shot(mobile, f'{kind}-about-mobile')
    mobile.close()


def check_hero_start_and_sound(page, hero):
    kind = hero.get_attribute('data-preview-state')
    if kind == 'video':
        page.wait_for_function("document.querySelector('.hero-preview video')?.currentTime >= 79", timeout=7000)
        if not hero.locator('.hero-preview video').evaluate('el => el.muted'):
            fail('direct hero video did not begin muted')
    else:
        iframe = hero.locator('.hero-preview iframe')
        source = iframe.get_attribute('src') or ''
        params = parse_qs(urlparse(source).query)
        if kind == 'bunny':
            if params.get('t') != ['80'] or params.get('muted') != ['true']:
                fail(f'Bunny hero must start muted at 80 seconds: {source}')
        elif kind == 'youtube':
            if params.get('start') != ['80'] or params.get('mute') != ['1']:
                fail(f'YouTube hero must start muted at 80 seconds: {source}')
        else:
            fail(f'unknown hero media kind: {kind}')
    unmute = hero.get_by_role('button', name='Unmute hero preview', exact=True)
    unmute.wait_for(state='visible', timeout=3000)
    if unmute.get_attribute('aria-pressed') != 'false':
        fail('initial hero sound button pressed state is incorrect')
    unmute.click()
    mute = hero.get_by_role('button', name='Mute hero preview', exact=True)
    mute.wait_for(state='visible', timeout=3000)
    if mute.get_attribute('aria-pressed') != 'true':
        fail('unmuted hero sound button pressed state is incorrect')
    if kind == 'video':
        if hero.locator('.hero-preview video').evaluate('el => el.muted'):
            fail('direct hero video did not unmute')
    else:
        source = hero.locator('.hero-preview iframe').get_attribute('src') or ''
        params = parse_qs(urlparse(source).query)
        expected = '0' if kind == 'youtube' else 'false'
        key = 'mute' if kind == 'youtube' else 'muted'
        if params.get(key) != [expected]:
            fail(f'{kind} iframe did not unmute: {source}')
    shot(page, 'hero-unmuted')


def check_hero_timing(browser):
    page = open_page(browser, '/', settle=0)
    hero = page.locator('.hero[data-hero-slide]').first
    hero.wait_for(state='visible', timeout=30000)
    dots = hero.locator('.hero-dots button').count()
    if dots < 2:
        fail('hero needs at least two slides to prove the repeating cycle')
    found_preview = False
    cycle_start = time.monotonic()
    initial_slide = int(hero.get_attribute('data-hero-slide'))
    for attempt in range(min(dots, 3)):
        cycle_start = time.monotonic()
        initial_slide = int(hero.get_attribute('data-hero-slide'))
        page.wait_for_timeout(2200)
        if hero.get_attribute('data-preview-state') != 'poster':
            fail('hero preview began before the three-second delay')
        try:
            page.wait_for_function("['video', 'youtube', 'bunny'].includes(document.querySelector('.hero[data-hero-slide]')?.dataset.previewState)", timeout=3500)
            found_preview = True
            break
        except PlaywrightTimeoutError:
            if attempt + 1 >= min(dots, 3):
                break
            hero.get_by_role('button', name='Next slide', exact=True).click()
            page.wait_for_timeout(150)
    if not found_preview:
        shot(page, 'hero-no-preview')
        fail('no hero trailer became active after three seconds on the available slides')
    preview_elapsed = time.monotonic() - cycle_start
    if preview_elapsed < 2.8 or preview_elapsed > 6.5:
        fail(f'hero preview delay outside tolerance: {preview_elapsed:.2f}s')
    check_hero_start_and_sound(page, hero)
    page.wait_for_function(f"document.querySelector('.hero[data-hero-slide]')?.dataset.heroSlide !== '{initial_slide}'", timeout=9000)
    advance_elapsed = time.monotonic() - cycle_start
    if advance_elapsed < 7 or advance_elapsed > 12:
        fail(f'hero advance timing outside tolerance: {advance_elapsed:.2f}s')
    if hero.locator('.hero-sound-toggle').count():
        fail('sound control remained visible after the preview slide advanced')
    repeated_slide = int(hero.get_attribute('data-hero-slide'))
    repeat_start = time.monotonic()
    page.wait_for_function(f"document.querySelector('.hero[data-hero-slide]')?.dataset.heroSlide !== '{repeated_slide}'", timeout=11000)
    repeat_elapsed = time.monotonic() - repeat_start
    if repeat_elapsed < 6.5 or repeat_elapsed > 11:
        fail(f'hero did not repeat its eight-second cycle: {repeat_elapsed:.2f}s')
    before_manual = int(hero.get_attribute('data-hero-slide'))
    hero.get_by_role('button', name='Next slide', exact=True).click()
    page.wait_for_timeout(200)
    if int(hero.get_attribute('data-hero-slide')) == before_manual or hero.get_attribute('data-preview-state') != 'poster':
        fail('manual slide control did not reset preview state')
    hero.locator('.hero-dots button').nth(initial_slide).click()
    page.wait_for_function("['video', 'youtube', 'bunny'].includes(document.querySelector('.hero[data-hero-slide]')?.dataset.previewState)", timeout=5500)
    reset_sound = hero.get_by_role('button', name='Unmute hero preview', exact=True)
    reset_sound.wait_for(state='visible', timeout=3000)
    if reset_sound.get_attribute('aria-pressed') != 'false':
        fail('hero sound did not reset to muted on slide selection')
    shot(page, 'hero-timed-preview')
    page.close()

    reduced = open_page(browser, '/', reduced_motion='reduce', settle=0)
    hero = reduced.locator('.hero[data-hero-slide]').first
    hero.wait_for(state='visible', timeout=30000)
    initial = hero.get_attribute('data-hero-slide')
    reduced.wait_for_timeout(9000)
    if hero.get_attribute('data-hero-slide') != initial or hero.get_attribute('data-preview-state') != 'reduced-motion':
        fail('reduced-motion preference did not disable automatic playback and advance')
    if reduced.locator('.hero-sound-toggle').count():
        fail('sound control appeared without an active reduced-motion preview')
    reduced.close()


try:
    os.makedirs(os.path.join(WORKSPACE, '.tmp'), exist_ok=True)
    if START_SERVER:
        log_handle = open(os.path.join(WORKSPACE, '.tmp', 'experience-dev.log'), 'w')
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
            fail('temporary dev server never came up')

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = open_page(browser, '/')
        check_desktop_header(page)
        clean_public_ui(page, '/')
        if 'Coming Soon' in page.locator('main').inner_text():
            fail('Coming Soon remains in homepage discovery')
        check_recommendations(page, '/')
        check_spotlight(page)
        first_card = page.locator('.p-card').first
        first_card.scroll_into_view_if_needed()
        page.wait_for_timeout(350)
        first_card.hover()
        page.wait_for_timeout(800)
        preview = page.locator('.pv-card.open')
        if preview.count() != 1:
            fail('hover preview did not open')
        bounds = preview.bounding_box()
        if not bounds or bounds['x'] < 0 or bounds['y'] < 0 or bounds['x'] + bounds['width'] > 1441 or bounds['y'] + bounds['height'] > 901:
            fail(f'hover preview exceeds viewport: {bounds}')
        shot(page, 'home-hover-desktop')
        page.mouse.move(0, 0)
        page.close()

        links = {kind: first_content_link(browser, listing) for kind, listing in [('movie', '/movies'), ('show', '/tv-shows'), ('teaching', '/teachings'), ('video', '/videos')]}
        for kind, path in links.items():
            check_detail(browser, path, kind)

        for path in ('/videos', '/coming-soon', '/search?q=teaching', '/page/privacy-policy', '/live-tv', '/watchlist'):
            other = open_page(browser, path)
            clean_public_ui(other, path)
            check_nonhero_clearance(other, path)
            no_overflow(other, path)
            if path == '/page/privacy-policy' and 'Privacy' not in other.locator('body').inner_text():
                fail('custom Privacy page content missing')
            other.close()

        mobile = open_page(browser, '/', width=390, height=844)
        clean_public_ui(mobile, '/')
        no_overflow(mobile, '/')
        if mobile.locator('.main-nav').is_visible() or not mobile.locator('.mobile-dock').is_visible():
            fail('mobile navigation/dock breakpoint is incorrect')
        if mobile.locator('.mobile-dock a, .mobile-dock button').count() != 5:
            fail('mobile dock does not have five reference actions')
        mobile.locator('header').get_by_role('button', name='Open menu', exact=True).click()
        sheet = mobile.get_by_role('dialog', name='Site menu', exact=True)
        sheet.wait_for(state='visible')
        labels = [text.strip() for text in sheet.locator('.mobile-menu-nav a').all_inner_texts()]
        if labels != EXPECTED_NAV:
            fail(f'mobile sheet navigation mismatch: {labels}')
        shot(mobile, 'navigation-mobile')
        mobile.keyboard.press('Escape')
        mobile.wait_for_timeout(250)
        if mobile.locator('.mobile-menu-sheet').count():
            fail('mobile menu did not close with Escape')
        check_spotlight(mobile, mobile=True)
        shot(mobile, 'home-mobile')
        mobile.close()

        for path in ['/movies', '/tv-shows', '/teachings', '/videos', '/coming-soon', '/search?q=teaching', '/page/privacy-policy']:
            other = open_page(browser, path, width=390, height=844)
            clean_public_ui(other, path)
            check_nonhero_clearance(other, path)
            no_overflow(other, path)
            other.close()

        check_hero_timing(browser)
        browser.close()

    if errors:
        fail('browser page errors: ' + '; '.join(errors[:8]))
    print('EXPERIENCE_LOCAL_OK')
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
