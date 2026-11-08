<?php
// Isolated behavior tests: executes the unchanged plugin with in-memory WP/Woo adapters.
// No WordPress installation, remote requests, customer data, orders or payment operations.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('ABSPATH', __DIR__ . '/');
define('ARRAY_A', 'ARRAY_A');
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
final class WP_Error { public function __construct(public string $code, public string $message, public array $data=[]) {} }
final class WP_REST_Response { public array $headers=[]; public function __construct(public mixed $data, public int $status=200) {} public function header($key,$value){$this->headers[$key]=$value;} }
final class WooCommerce {}
final class TestRequest {
    public function __construct(public array $data=[], public array $headers=[], public string $route='/halobox-bridge/v1/checkout', public ?string $raw=null) {}
    public function get_header($key){return $this->headers[strtolower($key)]??'';}
    public function get_route(){return $this->route;}
    public function get_body(){return $this->raw??json_encode($this->data, JSON_UNESCAPED_SLASHES);}
    public function get_json_params(){return $this->data;}
    public function get_param($key){return $this->data[$key]??null;}
}
final class TestDie extends Error { public function __construct(public int $status){parent::__construct('wp_die: '.$status);} }
final class TestRedirect extends Error { public function __construct(public string $url){parent::__construct('redirect');} }
$options=['halobox_bridge_enabled'=>true];$transients=[];$routes=[];$order_query=[];$capability=false;
final class TestProductSchema { const IDENTIFIER='product'; }
class_alias(TestProductSchema::class,'Automattic\\WooCommerce\\StoreApi\\Schemas\\V1\\ProductSchema');
function woocommerce_store_api_register_endpoint_data($data){$GLOBALS['product_extension']=$data;}
function add_action(...$args){}
function add_submenu_page(...$args){}
function register_rest_route($namespace,$route,$args){$GLOBALS['routes'][$namespace.$route]=$args;}
function add_option($key,$value,...$args){if(array_key_exists($key,$GLOBALS['options']))return false;$GLOBALS['options'][$key]=$value;return true;}
function get_option($key,$fallback=false){return $GLOBALS['options'][$key]??$fallback;}
function update_option($key,$value,...$args){$GLOBALS['options'][$key]=$value;return true;}
function delete_option($key){unset($GLOBALS['options'][$key]);return true;}
function set_transient($key,$value,$seconds){$GLOBALS['transients'][$key]=['value'=>$value,'expiry'=>time()+$seconds];return true;}
function get_transient($key){$entry=$GLOBALS['transients'][$key]??null;return $entry&&$entry['expiry']>time()?$entry['value']:false;}
function delete_transient($key){unset($GLOBALS['transients'][$key]);return true;}
function sanitize_text_field($value){return trim(strip_tags((string)$value));}
function wp_unslash($value){return $value;}
function esc_html($value){return htmlspecialchars((string)$value);}
function esc_url($value){return $value;}
function home_url($path=''){return 'https://uebertangel.org'.$path;}
function admin_url($path=''){return 'https://uebertangel.org/wp-admin/'.$path;}
function wc_get_checkout_url(){return 'https://uebertangel.org/checkout/';}
function get_woocommerce_currency(){return 'GBP';}
function current_user_can($cap){return $GLOBALS['capability'];}
function check_admin_referer($action){if(!($GLOBALS['valid_admin_nonce']??false))throw new TestDie(403);}
function wp_nonce_field($action){}
function checked($a,$b,$echo=false){return $a===$b?'checked':'';}
function add_query_arg($key,$value,$url){return $url.'?'.rawurlencode($key).'='.rawurlencode($value);}
function nocache_headers(){}
function wp_die($message,$title='',$args=[]){throw new TestDie($args['response']??500);}
function wp_safe_redirect($url){throw new TestRedirect($url);}
function wc_load_cart(){}
function is_wp_error($value){return $value instanceof WP_Error;}
$wpdb=new class { public string $options='wp_options'; public function esc_like($v){return $v;} public function prepare($query,...$params){return $query;} public function query($query){return 0;} };
final class TestProduct {
    public function __construct(public int $id,public string $type='simple', public int $parent=0,public bool $virtual=false,public bool $downloadable=false,public bool $stock=true,public string $status='publish',public int $inventory=25,public bool $single=false,public int $price=2500,public int $stockOwner=0) {}
    public function get_id(){return $this->id;} public function get_type(){return $this->type;} public function is_type($type){return $this->type===$type;}
    public function get_parent_id(){return $this->parent;} public function is_virtual(){return $this->virtual;} public function is_downloadable(){return $this->downloadable;}
    public function is_purchasable(){return $this->status==='publish';} public function is_in_stock(){return $this->stock;} public function get_status(){return $this->status;}
    public function get_stock_managed_by_id(){return $this->stockOwner?:$this->id;} public function has_enough_stock($quantity){return $quantity<=$this->inventory;}
    public function is_sold_individually(){return $this->single;} public function get_variation_attributes(){return ['attribute_pa_size'=>'large','attribute_colour'=>'Blue'];}
    public function get_children(){return array_keys(array_filter($GLOBALS['products'],fn($product)=>$product->parent===$this->id));}
}
$products=[1=>new TestProduct(1),2=>new TestProduct(2,'simple',0,true),3=>new TestProduct(3,'simple',0,false,true),4=>new TestProduct(4,'simple',0,false,false,false),5=>new TestProduct(5,'variable'),6=>new TestProduct(6,'variation',5,false,false,true,'publish',25,false,3700),7=>new TestProduct(7,'simple',0,false,false,true,'draft'),8=>new TestProduct(8,'simple',0,false,false,true,'publish',2),9=>new TestProduct(9,'simple',0,false,false,true,'publish',25,true),10=>new TestProduct(10,'variation',7),11=>new TestProduct(11,'variation',5,false,false,true,'publish',5,false,3700,5),12=>new TestProduct(12,'variation',5,false,false,true,'publish',5,false,3800,5)];
function wc_get_product($id){return $GLOBALS['products'][$id]??false;}
final class TestCart {
    public array $items=[];public array $coupons=[];public int $total=0;
    public function empty_cart(){ $this->items=[];$this->coupons=[]; }
    public function add_to_cart($id,$quantity,$variation_id=0,$variation=[]){$this->items[]=['id'=>$id,'quantity'=>$quantity,'variation_id'=>$variation_id,'variation'=>$variation];return 'cart-item';}
    public function apply_coupon($code){$this->coupons[]=$code;return true;}
    public function calculate_totals(){ $this->total=0;foreach($this->items as $item)$this->total+=wc_get_product($item['variation_id']?:$item['id'])->price*$item['quantity']; }
}
final class TestSession {public array $data=[]; public bool $cookie=false;public function set($key,$value){$this->data[$key]=$value;}public function get($key){return $this->data[$key]??null;}public function __unset($key){unset($this->data[$key]);}public function set_customer_session_cookie($value){$this->cookie=$value;}}
$wc=(object)['cart'=>new TestCart(),'session'=>new TestSession()];function WC(){return $GLOBALS['wc'];}
final class TestOrder {public array $meta=[];public function update_meta_data($key,$value){$this->meta[$key]=$value;}public function get_id(){return 321;}public function get_status(){return 'processing';}public function get_total(){return '25.00';}public function get_currency(){return 'GBP';}public function get_date_created(){return null;}public function get_edit_order_url(){return 'https://uebertangel.org/wp-admin/admin.php?page=wc-orders&action=edit&id=321';}}
function wc_get_orders($query){$GLOBALS['order_query']=$query;return [new TestOrder()];}
$private=openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);check($private!==false,'RSA key creation failed');
define('HALOBOX_BRIDGE_PUBLIC_KEY',openssl_pkey_get_details($private)['key']);
require __DIR__.'/halobox-store-bridge.php';
function signed_request($data=[], $path='/checkout', $timestamp=null, $nonce=null){
    $r=new TestRequest($data,[], '/halobox-bridge/v1'.$path);
    $time=(string)($timestamp??time());$nonce=$nonce??bin2hex(random_bytes(16));
    $canonical=$time."\n".$nonce."\n".$path."\n".$r->get_body();
    openssl_sign($canonical,$signature,$GLOBALS['private'],OPENSSL_ALGO_SHA256);
    $r->headers=['x-halobox-time'=>$time,'x-halobox-nonce'=>$nonce,'x-halobox-signature'=>base64_encode($signature)];return $r;
}
function rejected($result,$code,$message){check($result instanceof WP_Error&&($result->data['status']??null)===$code,$message);}
Halobox_Store_Bridge::routes();
foreach($routes as $route) check($route['permission_callback']===[Halobox_Store_Bridge::class,'authenticate'],'Every bridge endpoint must authenticate');
check(isset($routes['halobox-bridge/v1/orders']),'Order endpoint missing');
$request=signed_request(['items'=>[['id'=>1,'quantity'=>2]]]);check(Halobox_Store_Bridge::authenticate($request)===true,'Valid RSA signature rejected');
rejected(Halobox_Store_Bridge::authenticate($request),409,'Replayed signed request must fail');
$tampered=signed_request(['items'=>[['id'=>1,'quantity'=>1]]]);$tampered->data['items'][0]['quantity']=2;rejected(Halobox_Store_Bridge::authenticate($tampered),401,'Body tampering accepted');
$wrongPath=signed_request([],'/status');$wrongPath->route='/halobox-bridge/v1/orders';rejected(Halobox_Store_Bridge::authenticate($wrongPath),401,'Path tampering accepted');
$wrongSig=signed_request();$wrongSig->headers['x-halobox-signature']=base64_encode(str_repeat('x',256));rejected(Halobox_Store_Bridge::authenticate($wrongSig),401,'Forged signature accepted');
rejected(Halobox_Store_Bridge::authenticate(signed_request([], '/checkout',time()-121)),401,'Stale signature accepted');
rejected(Halobox_Store_Bridge::authenticate(signed_request([], '/checkout',time()+121)),401,'Future signature accepted');
$fresh=signed_request();check(Halobox_Store_Bridge::authenticate($fresh)===true,'Fresh positive control failed after rejection tests');
$GLOBALS['options']['halobox_bridge_enabled']=false;rejected(Halobox_Store_Bridge::authenticate(signed_request()),503,'Disabled bridge accepted a request');$GLOBALS['options']['halobox_bridge_enabled']=true;
Halobox_Store_Bridge::extend_products();$extension=$GLOBALS['product_extension'];check($extension['namespace']==='halobox_bridge','Wrong catalogue extension namespace');
$physical=$extension['data_callback'];check($physical($products[1])['physical']===true,'Physical book rejected');check($physical($products[5])['physical']===true,'Physical variable item rejected');
check($physical($products[2])['physical']===false&&$physical($products[3])['physical']===false,'Virtual/downloadable flags ignored');
$products[13]=new TestProduct(13,'variation',5,true);check($physical($products[5])['physical']===false,'Mixed digital variable product accepted');unset($products[13]);
$valid=Halobox_Store_Bridge::checkout(new TestRequest(['items'=>[['id'=>1,'quantity'=>2,'price'=>1],['id'=>6,'quantity'=>1]],'coupons'=>['BOOKS']]));
check($valid instanceof WP_REST_Response,'Valid physical/variation cart rejected');check(($valid->headers['Cache-Control']??'')==='private, no-store','Checkout token is cacheable');
parse_str(parse_url($valid->data['checkout_url'],PHP_URL_QUERY),$query);$token=$query['halobox_checkout']??'';check((bool)preg_match('/^[a-f0-9]{64}$/',$token),'Weak checkout token');
check($valid->data['expires_in']<=300,'Checkout token expiry too long');
foreach([2,3,4,5,7,10,999] as $invalidId) rejected(Halobox_Store_Bridge::checkout(new TestRequest(['items'=>[['id'=>$invalidId,'quantity'=>1]]])),409,'Virtual/downloadable/parent/unpublished/missing item accepted: '.$invalidId);
foreach([0,21,-1,'2',1.5] as $quantity) rejected(Halobox_Store_Bridge::checkout(new TestRequest(['items'=>[['id'=>1,'quantity'=>$quantity]]])),409,'Invalid quantity accepted');
foreach([[],array_fill(0,41,['id'=>1,'quantity'=>1]),[['id'=>8,'quantity'=>3]],[['id'=>9,'quantity'=>2]],[['id'=>1,'quantity'=>15],['id'=>1,'quantity'=>6]],[['id'=>11,'quantity'=>3],['id'=>12,'quantity'=>3]]] as $items) rejected(Halobox_Store_Bridge::checkout(new TestRequest(['items'=>$items])),409,'Invalid aggregate/stock cart accepted');
rejected(Halobox_Store_Bridge::checkout(new TestRequest(['items'=>[['id'=>1,'quantity'=>1]],'coupons'=>array_fill(0,6,'CODE')])),400,'Too many coupons accepted');
$_GET['halobox_checkout']=$token;
try{Halobox_Store_Bridge::handoff();check(false,'Handoff did not redirect');}catch(TestRedirect $redirect){check($redirect->url==='https://uebertangel.org/checkout/','Wrong checkout destination');}
check(WC()->cart->items[1]===['id'=>5,'quantity'=>1,'variation_id'=>6,'variation'=>['attribute_pa_size'=>'large','attribute_colour'=>'Blue']],'Variation was not reconstructed authoritatively');
check(WC()->cart->total===8700,'Client price influenced authoritative Woo totals');
check(WC()->cart->coupons===['BOOKS'],'Coupon handoff lost');check(WC()->session->cookie,'Woo session cookie missing');
try{Halobox_Store_Bridge::handoff();check(false,'Checkout token replay accepted');}catch(TestDie $die){check($die->status===410,'Wrong replay status');}
$expired=Halobox_Store_Bridge::checkout(new TestRequest(['items'=>[['id'=>1,'quantity'=>1]]]));parse_str(parse_url($expired->data['checkout_url'],PHP_URL_QUERY),$q);$GLOBALS['transients']['halobox_cart_'.hash('sha256',$q['halobox_checkout'])]['expiry']=time()-1;$_GET['halobox_checkout']=$q['halobox_checkout'];
try{Halobox_Store_Bridge::handoff();check(false,'Expired checkout token accepted');}catch(TestDie $die){check($die->status===410,'Wrong expiry status');}
$pending=Halobox_Store_Bridge::checkout(new TestRequest(['items'=>[['id'=>1,'quantity'=>1]]]));parse_str(parse_url($pending->data['checkout_url'],PHP_URL_QUERY),$q);$_GET['halobox_checkout']=$q['halobox_checkout'];$previousCart=WC()->cart->items;$products[1]->stock=false;
try{Halobox_Store_Bridge::handoff();check(false,'Stock changes after handoff creation were ignored');}catch(TestDie $die){check($die->status===409,'Wrong changed-stock status');}
check(WC()->cart->items===$previousCart,'Failed stock revalidation erased the current Woo cart');$products[1]->stock=true;
$revoked=Halobox_Store_Bridge::checkout(new TestRequest(['items'=>[['id'=>1,'quantity'=>1]]]));parse_str(parse_url($revoked->data['checkout_url'],PHP_URL_QUERY),$q);$_GET['halobox_checkout']=$q['halobox_checkout'];$options['halobox_bridge_enabled']=false;
try{Halobox_Store_Bridge::handoff();check(false,'Disabling the bridge did not revoke an existing checkout link');}catch(TestDie $die){check($die->status===503,'Wrong disabled-handoff status');}
check(WC()->cart->items===$previousCart,'Disabled handoff modified the Woo cart');$options['halobox_bridge_enabled']=true;
$order=new TestOrder();Halobox_Store_Bridge::tag_order($order);check(($order->meta['_halobox_source']??null)==='halobox','Bridge order marker missing');Halobox_Store_Bridge::clear_source();$otherOrder=new TestOrder();Halobox_Store_Bridge::tag_order($otherOrder);check($otherOrder->meta===[],'Unrelated order tagged');
$orders=Halobox_Store_Bridge::orders();check($order_query['meta_key']==='_halobox_source'&&$order_query['meta_value']==='halobox','Order endpoint exposes unrelated orders');check(!isset($orders->data['orders'][0]['billing']),'Order endpoint unnecessarily exposes customer address');
ob_start();Halobox_Store_Bridge::page();$denied=ob_get_clean();check($denied==='','Non-admin WP page exposed');
$capability=true;$_POST=['halobox_save'=>'1'];$valid_admin_nonce=false;ob_start();try{Halobox_Store_Bridge::page();check(false,'Settings mutation accepted without nonce');}catch(TestDie $die){check($die->status===403,'Wrong admin nonce rejection');}finally{ob_end_clean();}
check($options['halobox_bridge_enabled']===true,'Rejected settings mutation changed bridge state');
$valid_admin_nonce=true;ob_start();Halobox_Store_Bridge::page();$settings=ob_get_clean();check($options['halobox_bridge_enabled']===false,'Woo admin cannot disable bridge');check(!str_contains($settings,'PRIVATE KEY'),'Private key displayed in settings');
echo "STORE_PHP_BRIDGE_PASS\n";
