"""Public UI checks against local fixture server functions. No live writes."""
import json, pathlib, sys
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1]
assert BASE.startswith('http://127.0.0.1:')
OUT = pathlib.Path('/tmp/halobox-nov09-library/feedback-evidence')
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    errors = []
    pending = []
    def page_for(width=1440, height=900):
        context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        def handle(route):
            url = route.request.url
            if not url.startswith(BASE):
                route.abort()
            elif url.endswith('/fixture-api/getLibrary'):
                route.fulfill(json={'signedIn': True, 'profileKey': 'fixture:1', 'notes': [], 'verses': []})
            elif url.endswith('/fixture-api/saveLibraryNote'):
                pending.append(route)
            elif url.endswith('/fixture-api/getPersonalityDetail'):
                route.fulfill(json={'person': {'id': 1, 'name': 'Robert Brown', 'bio': 'A fixture biography from the server response.'}, 'works': [], 'links': []})
            elif '/fixture-api/' in url:
                route.fulfill(status=404, json={'message': 'Unexpected fixture request'})
            else:
                route.continue_()
        page.route('**/*', handle)
        page.goto(BASE)
        expect(page.get_by_role('textbox', name='Your note', exact=True)).to_be_visible()
        return page

    def fill_note(page, scope, text):
        scope.get_by_role('textbox', name='Your note', exact=True).fill(text)
        if page.viewport_size['width'] < 760:
            scope.get_by_role('button', name='Finish editing and dismiss keyboard').click()
        else:
            page.keyboard.press('Tab')

    page = page_for()
    fill_note(page, page, 'A persisted reflection.')
    page.get_by_role('button', name='Save note', exact=True).click()
    expect(page.get_by_role('button', name='Saving…', exact=True)).to_be_disabled()
    expect(page.get_by_role('status', name='Note saved', exact=True)).to_have_count(0)
    page.wait_for_timeout(100)
    assert len(pending) == 1
    pending.pop().fulfill(json={'html': '<p>A persisted reflection.</p>'})
    card = page.get_by_role('status', name='Note saved', exact=True)
    expect(card).to_be_visible()
    expect(card).to_contain_text('My Notes')
    card.get_by_role('button', name='Dismiss notification', exact=True).click()
    expect(card).to_have_count(0)
    expect(page.get_by_text('Unsaved changes', exact=False)).to_have_count(0)
    print('PASS: success appears only after the persisted response, in a dismissible accessible card.')

    fill_note(page, page, 'Keep this draft after a rejected save.')
    page.get_by_role('button', name='Save note', exact=True).click()
    expect(page.get_by_role('button', name='Saving…', exact=True)).to_be_disabled()
    page.wait_for_timeout(100)
    pending.pop().fulfill(status=503, json={'message': 'The library is temporarily unavailable.'})
    failure = page.get_by_role('alert', name='Note could not be saved', exact=True)
    expect(failure).to_be_visible()
    expect(failure).to_contain_text('Your unsaved note is still here.')
    expect(page.get_by_role('textbox', name='Your note', exact=True)).to_have_text('Keep this draft after a rejected save.')
    expect(page.get_by_text('Unsaved changes', exact=False)).to_be_visible()
    failure.get_by_role('button', name='Dismiss notification', exact=True).click()
    expect(failure).to_have_count(0)
    page.screenshot(path=str(OUT / 'notes-desktop.png'))
    print('PASS: failed persistence preserves the editable draft and gives a dismissible error card.')

    for width, height in [(1440, 900), (390, 844)]:
        player_page = page_for(width, height)
        player_page.get_by_role('button', name='Open fixture playback', exact=True).click()
        player = player_page.get_by_role('dialog', name='Fixture playback', exact=True)
        if width == 1440:
            player.get_by_role('button', name='Enter fixture full screen', exact=True).click()
            player_page.wait_for_function('document.fullscreenElement !== null')
        fill_note(player_page, player, 'Player reflection.')
        player.get_by_role('button', name='Save note', exact=True).click()
        expect(player.get_by_role('button', name='Saving…', exact=True)).to_be_disabled()
        player_page.wait_for_timeout(100)
        pending.pop().fulfill(json={'html': '<p>Player reflection.</p>'})
        saved_card = player.get_by_role('status', name='Note saved', exact=True)
        expect(saved_card).to_be_visible()
        bounds = saved_card.bounding_box()
        assert bounds['x'] >= 0 and bounds['y'] >= 0 and bounds['x'] + bounds['width'] <= width + 1 and bounds['y'] + bounds['height'] <= height + 1, bounds
        player_page.screenshot(path=str(OUT / f'notes-player-{width}.png'))
        saved_card.get_by_role('button', name='Dismiss notification', exact=True).click()
        expect(saved_card).to_have_count(0)
        expect(player).to_be_visible()
        player_page.context.close()
    print('PASS: cards remain visible, within the viewport, and clickable inside native modal playback on desktop and mobile.')

    people = page.get_by_role('button', name='Personalities, 3 people', exact=True)
    expect(people).to_have_attribute('aria-expanded', 'false')
    expect(page.get_by_role('button', name='About Robert Brown', exact=True)).to_have_count(0)
    people.focus()
    page.keyboard.press('Enter')
    expect(people).to_have_attribute('aria-expanded', 'true')
    expect(page.get_by_role('button', name='About Robert Brown', exact=True)).to_be_visible()
    page.get_by_role('button', name='About Robert Brown', exact=True).click()
    biography = page.get_by_role('dialog', name='Robert Brown', exact=True)
    expect(biography).to_be_visible()
    expect(biography).to_contain_text('A fixture biography from the server response.')
    page.keyboard.press('Escape')
    expect(biography).to_have_count(0)
    expect(page.get_by_role('button', name='About Robert Brown', exact=True)).to_be_focused()
    print('PASS: keyboard expansion reveals the real people and opens the existing biography dialog.')

    for about_page, width in [(page, 1440), (page_for(390, 844), 390)]:
        group = about_page.get_by_role('region', name='About this title', exact=True)
        people_toggle = about_page.get_by_role('button', name='Personalities, 3 people', exact=True)
        if people_toggle.get_attribute('aria-expanded') == 'true':
            people_toggle.click()
        people_toggle.scroll_into_view_if_needed()
        about_page.screenshot(path=str(OUT / f'about-collapsed-{width}.png'))
        people_toggle.focus()
        about_page.keyboard.press('Space')
        expect(people_toggle).to_have_attribute('aria-expanded', 'true')
        expect(about_page.get_by_role('button', name='About Guest without portrait', exact=True)).to_be_visible()
        locations_toggle = about_page.get_by_role('button', name='Locations, 1 location', exact=True)
        expect(about_page.get_by_text('London, United Kingdom', exact=True)).to_have_count(0)
        locations_toggle.click()
        expect(locations_toggle).to_have_attribute('aria-expanded', 'true')
        expect(about_page.get_by_text('London, United Kingdom', exact=True)).to_be_visible()
        group.scroll_into_view_if_needed()
        assert group.evaluate('el => el.scrollWidth <= el.clientWidth'), 'About content must fit its panel'
        assert about_page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'No horizontal page overflow'
        about_page.screenshot(path=str(OUT / f'about-expanded-{width}.png'))
        people_toggle.click()
        expect(about_page.get_by_role('button', name='About Robert Brown', exact=True)).to_have_count(0)
        expect(people_toggle).to_be_focused()
        locations_toggle.click()
        expect(about_page.get_by_text('London, United Kingdom', exact=True)).to_have_count(0)
    print('PASS: Space/Enter expansion and collapse, actual counts, missing-portrait fallback, and location address fit desktop and mobile.')
    assert not errors, errors
    browser.close()
print('FEEDBACK_PEOPLE_BROWSER_OK')
