"""Exercise local production handlers/UI with temporary accounts; restore data afterward."""
import base64, hashlib, hmac, json, os, pathlib, sqlite3, time
from playwright.sync_api import sync_playwright, expect
ROOT=pathlib.Path(__file__).resolve().parent.parent
BASE=os.environ.get('LIVE_TV_BASE_URL','http://127.0.0.1:5206')
assert BASE.startswith(('http://127.0.0.1:','http://localhost:')), 'UI fixtures must never target production'
DB=next((ROOT/'.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite'))
secret=next(x.split('=',1)[1].strip() for x in (ROOT/'.dev.vars').read_text().splitlines() if x.startswith('SESSION_SECRET='))
conn=sqlite3.connect(DB);conn.row_factory=sqlite3.Row
ids=[9900341,9900342]
assert not conn.execute('SELECT id FROM users WHERE id IN (?,?)',ids).fetchone(),'Test account IDs are already in use'
settings=conn.execute('SELECT * FROM live_channel_settings WHERE channel_id=34').fetchone()
try:
 for uid,role in zip(ids,['user','admin']):
  conn.execute('INSERT INTO users(id,first_name,last_name,email,user_type,password,status,is_banned,is_subscribe) VALUES(?,?,?,?,?,?,1,0,0)',(uid,'Live QA',role,f'live-{role}@fixture.invalid',role,'not-a-valid-password-hash'))
  conn.execute('INSERT INTO user_multi_profiles(id,user_id,name,is_child_profile) VALUES(?,?,?,0)',(uid,uid,'Live QA '+role))
 conn.execute('INSERT INTO live_channel_settings(channel_id,comments_enabled,slow_mode) VALUES(34,1,0) ON CONFLICT(channel_id) DO UPDATE SET comments_enabled=1,slow_mode=0');conn.commit()
 def signed(uid):
  body=base64.b64encode(json.dumps({'uid':uid,'pid':uid,'exp':int(time.time())+3600}).encode()).decode()
  sig=base64.b64encode(hmac.new(secret.encode(),body.encode(),hashlib.sha256).digest()).decode()
  return body+'.'+sig
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  contexts=[]
  def context(uid=None,size=None):
   c=browser.new_context(viewport=size or {'width':1440,'height':1000},reduced_motion='reduce');contexts.append(c)
   c.add_init_script("sessionStorage.setItem('halobox-intro-v1', '1')")
   if uid:c.add_cookies([{'name':'streamit_session','value':signed(uid),'url':BASE,'httpOnly':True,'sameSite':'Lax'}])
   return c
  user=context(ids[0]).new_page();user.goto(BASE+'/channel/34');expect(user.get_by_role('button',name='Watch live',exact=True)).to_be_enabled(timeout=25000)
  user.get_by_label('Your comment',exact=True).fill('Live UI verification message')
  user.get_by_role('button',name='Send',exact=True).click();expect(user.locator('.live-comment').filter(has_text='Live UI verification message')).to_be_visible()
  user.get_by_role('button',name='Reply',exact=True).first.click();user.get_by_label('Your comment',exact=True).fill('A live response')
  user.wait_for_timeout(1100);user.get_by_role('button',name='Send',exact=True).click();expect(user.locator('.live-comment').filter(has_text='A live response')).to_be_visible()
  admin=context(ids[1]).new_page();admin.goto(BASE+'/admin/live-tv');expect(admin.get_by_label('Your comment',exact=True)).to_be_visible();admin.get_by_role('combobox',name='Channel',exact=True).select_option('34');expect(admin.locator('.live-comment').filter(has_text='Live UI verification message').first).to_be_visible()
  admin.get_by_role('tab',name='Admin comments',exact=True).click();admin.get_by_label('Official announcement').fill('Official live announcement');admin.get_by_role('button',name='Send',exact=True).click();expect(admin.locator('.live-comment').filter(has_text='Official live announcement')).to_be_visible()
  admin.get_by_role('switch',name='Enable live comments').uncheck();admin.get_by_role('button',name='Save channel settings').click();expect(admin.get_by_text('Channel settings saved.',exact=True)).to_be_visible()
  expect(user.get_by_text('Live comments are turned off by the administrator.')).to_be_visible(timeout=12000);expect(user.get_by_label('Your comment',exact=True)).to_have_count(0)
  admin.get_by_role('switch',name='Enable live comments').check();admin.get_by_role('button',name='Save channel settings').click();expect(user.get_by_label('Your comment',exact=True)).to_be_visible(timeout=12000)
  user.get_by_role('tab',name='Live comments',exact=True).click();user.locator('.live-comment').filter(has_text='Official live announcement').get_by_role('button',name='Report',exact=True).click()
  user.get_by_label('Details (optional)').fill('UI report verification');user.get_by_role('button',name='Submit report').click();expect(user.get_by_text('Report submitted for review.')).to_be_visible()
  admin.get_by_role('tab',name='Reports',exact=True).click();expect(admin.get_by_text('UI report verification')).to_be_visible(timeout=12000);admin.get_by_role('button',name='Resolve',exact=True).first.click();expect(admin.get_by_text('resolved',exact=True).first).to_be_visible()
  unauthorized=context().new_page();unauthorized.goto(BASE+'/admin/live-tv');expect(unauthorized.get_by_text('Administrator access required.')).to_be_visible();expect(unauthorized.get_by_role('button',name='Save channel settings')).to_have_count(0)
  # Actual configured Bunny HLS playback, not a synthetic media fixture.
  user.get_by_role('button',name='Watch live',exact=True).click();user.get_by_role('button',name='Play video',exact=True).click()
  user.wait_for_function('document.querySelector("video")?.readyState >= 2 && document.querySelector("video").currentTime > 0',timeout=35000)
  initial=user.locator('video').evaluate('(v)=>v.currentTime')
  user.get_by_role('slider',name='Volume',exact=True).fill('0.35');assert abs(user.locator('video').evaluate('(v)=>v.volume')-.35)<.01
  user.get_by_role('button',name='Live discussion',exact=True).click();expect(user.get_by_role('tab',name='Responses',exact=True)).to_be_visible()
  user.wait_for_function('(start)=>document.querySelector("video").currentTime > start + 1',arg=initial,timeout=15000)
  evidence=ROOT/'verification/live-tv';evidence.mkdir(exist_ok=True)
  expect(user.get_by_role('button',name='Send',exact=True)).to_be_in_viewport()
  user.screenshot(path=str(evidence/'desktop-player-discussion.png'))
  user.get_by_role('button',name='Close playback',exact=True).click();expect(user.locator('video')).to_have_count(0)
  admin.screenshot(path=str(evidence/'admin.png'),full_page=True)
  # Deterministic provider-offline control, alongside the real successful feed above.
  attempts=[]
  def offline(route):
   attempts.append(route.request.url);route.fulfill(status=404,body='Offline',headers={'Access-Control-Allow-Origin':'*'})
  user.route('https://stream.castr.com/**',offline)
  user.goto(BASE+'/channel/35');expect(user.get_by_label('Your comment',exact=True)).to_be_visible()
  user.get_by_role('button',name='Watch live',exact=True).click();user.get_by_role('button',name='Play video',exact=True).click()
  expect(user.get_by_role('button',name='Reconnect stream',exact=True)).to_be_visible(timeout=20000)
  before=len(attempts);user.get_by_role('button',name='Reconnect stream',exact=True).click();user.get_by_role('button',name='Play video',exact=True).click()
  expect(user.get_by_role('button',name='Reconnect stream',exact=True)).to_be_visible(timeout=20000);assert len(attempts)>before
  user.get_by_role('button',name='Close playback',exact=True).click()
  for w,h in [(390,844),(768,1024),(3840,2160)]:
   page=context(ids[0],{'width':w,'height':h}).new_page();page.goto(BASE+'/channel/34');expect(page.get_by_role('tab',name='Live comments',exact=True)).to_be_visible()
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),f'Horizontal overflow at {w}'
   page.locator('.live-discussion').scroll_into_view_if_needed();page.screenshot(path=str(evidence/f'discussion-{w}.png'))
   if w==390:
    page.get_by_role('button',name='Watch live',exact=True).click();page.get_by_role('button',name='Live discussion',exact=True).click();expect(page.get_by_label('Your comment',exact=True)).to_be_visible()
    assert page.locator('.tv-player-panel').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),'Mobile player panel overflow'
    expect(page.get_by_role('button',name='Send',exact=True)).to_be_in_viewport()
    buttons=page.locator('.tv-player-tabs button').evaluate_all('(els)=>els.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}})')
    assert all(a['right'] <= b['left']+1 for a,b in zip(buttons,buttons[1:])), 'Player tab labels overlap'
    page.screenshot(path=str(evidence/'mobile-player-discussion.png'))
    page.get_by_role('button',name='Close playback',exact=True).click()
   page.close()
  for c in contexts:c.close()
  browser.close()
 print('Live browser checks: comments, replies, announcements, reports, disable switch, admin denial, real HLS, volume, continued playback, mobile/tablet/4K.')
finally:
 conn.execute('DELETE FROM live_comment_reports WHERE user_id IN (?,?)',ids)
 conn.execute('DELETE FROM live_comments WHERE user_id IN (?,?)',ids)
 conn.execute('DELETE FROM live_chat_mutes WHERE moderator_id IN (?,?) OR user_id IN (?,?)',ids+ids)
 conn.execute('DELETE FROM live_moderation_log WHERE admin_id IN (?,?)',ids)
 conn.execute('DELETE FROM live_channel_settings WHERE channel_id=34')
 if settings:
  keys=list(settings.keys());conn.execute('INSERT INTO live_channel_settings('+','.join(keys)+') VALUES('+','.join('?' for k in keys)+')',list(settings))
 conn.execute('DELETE FROM user_multi_profiles WHERE id IN (?,?)',ids)
 conn.execute('DELETE FROM users WHERE id IN (?,?)',ids);conn.commit();conn.close()
