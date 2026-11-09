"""Local rendered-component checks; no production requests, accounts, or chat posts."""
import sys, pathlib
from playwright.sync_api import sync_playwright, expect
BASE=sys.argv[1]
assert BASE.startswith('http://127.0.0.1:')
OUT=pathlib.Path('/tmp/halobox-nov09-followup/player-evidence');OUT.mkdir(exist_ok=True,parents=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 errors=[]
 def page_for(width=1440,height=900,mobile=False):
  context=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(BASE) else route.abort())
  return page
 def open_player(page,path='/movie/fixture-sermon-1#watch'):
  page.goto(BASE+path)
  expect(page.get_by_role('button',name='Close playback',exact=True)).to_be_visible()
  page.wait_for_function('document.querySelector(".tv-immersive-player video")?.readyState >= 2')
  page.evaluate('document.querySelector(".tv-immersive-player video").pause()')
  page.mouse.move(500,300)
 def hide_test(page):
  expect(page.get_by_role('button',name='Play video',exact=True)).to_be_visible()
  page.wait_for_timeout(3850)
  expect(page.get_by_role('button',name='Play video',exact=True)).not_to_be_visible()
  expect(page.get_by_role('button',name='Close playback',exact=True)).not_to_be_visible()
  expect(page.get_by_role('button',name='Enter full screen',exact=True)).not_to_be_visible()
  expect(page.get_by_role('slider',name='Volume',exact=True)).not_to_be_visible()
  page.mouse.move(510,310)
  expect(page.get_by_role('button',name='Play video',exact=True)).to_be_visible()
  expect(page.get_by_role('button',name='Close playback',exact=True)).to_be_visible()
 page=page_for();open_player(page);hide_test(page)
 page.get_by_role('button',name='Play video',exact=True).click()
 page.wait_for_function('document.querySelector(".tv-immersive-player video")?.paused === false')
 page.get_by_role('button',name='Pause video',exact=True).click()
 hide_test(page)
 page.get_by_role('button',name='Close playback',exact=True).click()
 expect(page.locator('.tv-title-page h1')).to_have_text('Fixture Sermon')
 assert page.url==BASE+'/movie/fixture-sermon-1'
 page.goto(BASE+'/')
 for selector,path in [('.p-card-link','/movie/'),('.top10-item','/movie/'),('.live-card','/channel/')]:
  page.goto(BASE+'/');link=page.locator(selector).first
  assert link.get_attribute('href').endswith('#watch')
  link.click();expect(page.get_by_role('button',name='Close playback',exact=True)).to_be_visible()
  assert path in page.url
  page.get_by_role('button',name='Close playback',exact=True).click()
  assert '#watch' not in page.url
 page.goto(BASE+'/');page.get_by_role('button',name='Search fixtures').click()
 page.get_by_role('combobox').fill('Fixture')
 page.get_by_role('option').filter(has_text='Fixture Video').click()
 expect(page.get_by_role('button',name='Close playback',exact=True)).to_be_visible()
 assert '/video/' in page.url
 page.get_by_role('button',name='Close playback',exact=True).click()
 for route in ['/tv-show/fixture-series-2#watch','/teaching/fixture-teaching-3#watch','/video/fixture-video-4#watch']:
  page.goto(BASE+route);expect(page.get_by_role('button',name='Close playback',exact=True)).to_be_visible()
  page.get_by_role('button',name='Close playback',exact=True).click();assert '#watch' not in page.url
 for route,text in [('/movie/locked-90#watch','Rent Fixture Sermon to watch it in full.'),('/movie/subscriber-91#watch','Subscription required'),('/channel/unavailable-99#watch','This stream is unavailable.')]:
  page.goto(BASE+route);expect(page.get_by_text(text,exact=True)).to_be_visible()
  assert page.locator('.tv-immersive-player video').count()==0
 page.goto(BASE+'/channel/embedded-98#watch')
 expect(page.get_by_role('button',name='Close playback',exact=True)).to_be_visible()
 page.mouse.move(400,300);page.wait_for_timeout(3850)
 expect(page.get_by_role('button',name='Close playback',exact=True)).not_to_be_visible()
 page.mouse.move(40,30)
 expect(page.get_by_role('button',name='Close playback',exact=True)).to_be_visible()
 page.get_by_role('button',name='Close playback',exact=True).click()
 print('PASS: native embed shell hides and restores at the top edge.')
 print('PASS: paused transport hides; title, live, video, series and search clicks open playback; closing returns detail; access and unavailable gates remain safe.')
 for width,height,mobile in [(1440,900,False),(390,844,True),(844,390,True)]:
  page=page_for(width,height,mobile);open_player(page,'/channel/fixture-channel-1#watch')
  if width==1440:
   enter=page.get_by_role('button',name='Enter full screen',exact=True)
   if enter.is_visible():enter.click()
   page.wait_for_function('document.fullscreenElement !== null')
  page.get_by_role('button',name='Live discussion',exact=True).click()
  expect(page.get_by_label('Your comment',exact=True)).to_be_visible()
  assert '5s between messages' not in page.locator('body').inner_text()
  assert page.locator('.chat-sheet').evaluate("el=>getComputedStyle(el).borderTopWidth")=='0px'
  for selector in ['.chat-welcome','.chat-composer','.live-discussion-heading']:
   assert page.locator(selector).evaluate("el=>getComputedStyle(el).borderTopWidth==='0px' && getComputedStyle(el).borderBottomWidth==='0px'")
  page.get_by_role('button',name='Choose a reaction',exact=True).click()
  picker=page.get_by_role('group',name='Send a reaction',exact=True)
  expect(picker).to_be_visible()
  assert picker.evaluate("el=>el.matches(':popover-open')"),'Picker must escape clipping through native top layer'
  box=picker.bounding_box();assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1,box
  page.screenshot(path=str(OUT/f'chat-reaction-{width}.png'))
  page.get_by_role('button',name='Choose a reaction',exact=True).click()
  expect(picker).to_have_count(0)
  page.get_by_role('button',name='Choose a reaction',exact=True).click()
  expect(picker).to_be_visible()
  page.keyboard.press('Escape');expect(picker).to_have_count(0)
  expect(page.locator('.tv-playback-dialog')).to_be_visible()
  field=page.get_by_label('Your comment',exact=True);field.fill('A draft remains intact.')
  page.wait_for_timeout(3850)
  expect(field).to_be_visible();expect(field).to_have_value('A draft remains intact.')
  expect(page.get_by_role('button',name='Play video while reading',exact=True)).not_to_be_visible()
  expect(page.get_by_role('button',name='Close playback',exact=True)).not_to_be_visible()
  page.keyboard.type(' k m');expect(field).to_have_value('A draft remains intact. k m')
  assert page.locator('.tv-immersive-player video').evaluate('v=>v.paused')
  page.get_by_role('button',name='Add emoji',exact=True).click();expect(page.get_by_role('group',name='Add emoji to comment')).to_be_visible()
  page.get_by_role('button',name='Add sparkles',exact=True).click();expect(field).to_have_value('A draft remains intact. k m✨')
  page.get_by_role('button',name='Send comment',exact=True).click()
  expect(page.get_by_role('alert')).to_have_text('Please wait 5 seconds before commenting again.')
  expect(field).to_have_value('A draft remains intact. k m✨')
  page.screenshot(path=str(OUT/f'chat-composer-{width}.png'))
  print(f'PASS: {width}×{height} borderless chat, unclipped viewport-safe picker, Escape, typing after idle, emoji and rate-limit error.')
  page.context.close()
 mobile=page_for(390,844,True);mobile.goto(BASE+'/')
 card=mobile.locator('.p-card-link').first;card.tap();expect(mobile.locator('.p-inline-preview')).to_be_visible()
 assert mobile.url==BASE+'/'
 mobile.locator('.p-inline-action-row').get_by_role('link',name='Watch',exact=True).tap()
 expect(mobile.get_by_role('button',name='Close playback',exact=True)).to_be_visible()
 print('PASS: mobile thumbnail tap previews; explicit Watch enters playback.')
 assert not errors,errors
 browser.close()
print('PLAYER_INTERACTIONS_BROWSER_OK')
