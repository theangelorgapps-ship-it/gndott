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
$options=['halobox_bridge_enabled'=>true];$transients=[];$routes=[];$order_query=[];$capability=false;$orders_by_id=[];$halobox_orders=[];
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
function sanitize_email($value){return trim((string)$value);}
function is_email($value){return (bool)filter_var($value,FILTER_VALIDATE_EMAIL);}
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
    public function calculate_shipping(){}
    public function calculate_totals(){ $this->total=0;foreach($this->items as $item)$this->total+=wc_get_product($item['variation_id']?:$item['id'])->price*$item['quantity']; }
}
final class TestSession {public array $data=[]; public bool $cookie=false;public function set($key,$value){$this->data[$key]=$value;}public function get($key){return $this->data[$key]??null;}public function __unset($key){unset($this->data[$key]);}public function set_customer_session_cookie($value){$this->cookie=$value;}}
final class TestShippingRate { public function __construct(private string $id,private string $label,private string $cost){} public function get_id(){return $this->id;} public function get_label(){return $this->label;} public function get_method_id(){return 'flat_rate';} public function get_cost(){return $this->cost;} }
final class TestWoo {
    public $cart; public $session; public $countries; public $customer;
    public function __construct(){
        $this->cart=new TestCart(); $this->session=new TestSession();
        $this->countries=new class { public function get_countries(){return ['GB'=>'United Kingdom','US'=>'United States'];} };
        $this->customer=new class { public array $shippingLocation=[]; public function set_billing_location($c,$s,$p,$city){} public function set_shipping_location($c,$s,$p,$city){$this->shippingLocation=[$c,$s,$p,$city];} };
    }
    public function shipping(){ return new class { public function get_packages(){ return [['rates'=>[new TestShippingRate('flat_rate:1','Standard delivery','4.95'),new TestShippingRate('express:2','Express delivery','9.95')]]]; } }; }
}
$wc=new TestWoo();function WC(){return $GLOBALS['wc'];}
final class WC_Order_Item_Shipping { public string $title=''; public string $methodId=''; public string $total='0'; public function set_method_title($t){$this->title=$t;} public function set_method_id($i){$this->methodId=$i;} public function set_total($t){$this->total=$t;} }
final class TestOrderLine { public function __construct(private TestProduct $product, private int $qty){} public function get_product(){return $this->product;} public function get_variation_id(){return 0;} public function get_quantity(){return $this->qty;} public function get_subtotal(){return $this->product->price*$this->qty/100;} }
final class TestDraftOrder {
    public array $items=[]; public array $addresses=[]; public array $meta=[]; public string $status='checkout-draft'; public string $email=''; public float $shipping=0.0; public string $shippingLabel='';
    private static int $nextId=500; public int $id;
    public function __construct(){ $this->id=self::$nextId++; $GLOBALS['orders_by_id'][$this->id]=$this; }
    public function get_id(){return $this->id;} public function get_status(){return $this->status;}
    public function add_product($product,$quantity){ $this->items[]=['product'=>$product,'quantity'=>$quantity]; }
    public function remove_order_items(){ $this->items=[]; }
    public function set_address($address,$type){ $this->addresses[$type]=$address; }
    public function apply_coupon($code){ if($code==='BOOKS') return true; return new WP_Error('bridge_coupon','Invalid coupon.'); }
    public function get_items(){ return array_map(fn($i)=>new TestOrderLine($i['product'],$i['quantity']),$this->items); }
    public function add_item($shipping){ $this->shipping=(float)$shipping->total; $this->shippingLabel=$shipping->title; }
    public function calculate_totals(){} public function save(){}
    public function get_currency(){return 'GBP';}
    public function get_subtotal(){ $t=0; foreach($this->items as $i) $t+=$i['product']->price*$i['quantity']; return number_format($t/100,2,'.',''); }
    public function get_discount_total(){return '0.00';}
    public function get_shipping_total(){return number_format($this->shipping,2,'.','');}
    public function get_total_tax(){return '0.00';}
    public function get_total(){ return number_format((float)$this->get_subtotal()+$this->shipping,2,'.',''); }
    public function set_billing_email($e){$this->email=$e;}
    public function set_created_via($v){} public function set_payment_method_title($t){} public function set_transaction_id($t){}
    public function update_meta_data($key,$value){$this->meta[$key]=$value;}
    public function payment_complete($reference){ $this->status='processing'; }
    public function get_order_number(){return (string)$this->id;}
    public function get_date_created(){return null;}
    public function get_edit_order_url(){return 'https://uebertangel.org/wp-admin/admin.php?page=wc-orders&action=edit&id='.$this->id;}
}
function wc_create_order($args){ return new TestDraftOrder(); }
function wc_get_order($id){ return $GLOBALS['orders_by_id'][$id]??null; }
final class TestOrder {public array $meta=[];public function update_meta_data($key,$value){$this->meta[$key]=$value;}public function get_id(){return 321;}public function get_order_number(){return '321';}public function get_status(){return 'processing';}public function get_total(){return '25.00';}public function get_currency(){return 'GBP';}public function get_date_created(){return null;}public function get_edit_order_url(){return 'https://uebertangel.org/wp-admin/admin.php?page=wc-orders&action=edit&id=321';}}
function wc_get_orders($query){
    if(($query['meta_key']??'')==='_halobox_payment_ref'){
        $found=[];foreach($GLOBALS['orders_by_id'] as $order) if(($order->meta['_halobox_payment_ref']??null)===$query['meta_value']) $found[]=$order;
        return $found;
    }
    $GLOBALS['order_query']=$query;
    return ($query['limit']??0)===-1 ? $GLOBALS['halobox_orders'] : [new TestOrder()];
}
$halobox_orders=[new TestOrder()];
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
check(isset($routes['halobox-bridge/v1/quote']),'Quote endpoint missing');
check(isset($routes['halobox-bridge/v1/order']),'Order creation endpoint missing');
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
check($orders->data['orders'][0]['number']==='321','Order number missing from dashboard feed');
check($orders->data['summary']['count']===1&&$orders->data['summary']['revenue']==='25.00'&&$orders->data['summary']['currency']==='GBP','Revenue summary missing or wrong');

// In-site checkout: quote and paid order creation.
$address=['first_name'=>'Ada','last_name'=>'Lovelace','address_1'=>'1 Halo Way','city'=>'London','postcode'=>'N1 9GU','country'=>'GB'];
$quote=Halobox_Store_Bridge::quote(new TestRequest(['items'=>[['id'=>1,'quantity'=>2,'price'=>1]],'address'=>$address]));
check($quote instanceof WP_REST_Response && (bool)preg_match('/^[a-f0-9]{64}$/',$quote->data['quote_id']),'Quote id malformed');
check($quote->data['items_total']==='50.00','Quote items total must come from Woo prices, not client input');
check($quote->data['total']==='50.00','Unchosen shipping must not inflate the quote total');
check(count($quote->data['shipping_rates'])===2 && $quote->data['shipping_rates'][0]['id']==='flat_rate:1','Live shipping rates missing from quote');
check($quote->data['expires_in']<=1800,'Quote lifetime too long');
check((WC()->customer->shippingLocation[0]??'')==='GB','Quote did not set the customer shipping location');
rejected(Halobox_Store_Bridge::quote(new TestRequest(['items'=>[['id'=>1,'quantity'=>1]],'address'=>['country'=>'XX','postcode'=>'AB1']])),400,'Invalid country accepted in quote');
rejected(Halobox_Store_Bridge::quote(new TestRequest(['items'=>[['id'=>1,'quantity'=>1]],'address'=>['country'=>'GB']])),400,'Missing postcode accepted in quote');
rejected(Halobox_Store_Bridge::quote(new TestRequest(['items'=>[['id'=>2,'quantity'=>1]],'address'=>$address])),409,'Virtual product accepted in quote');
$express=Halobox_Store_Bridge::quote(new TestRequest(['items'=>[['id'=>1,'quantity'=>2]],'address'=>$address,'shipping_rate'=>'express:2']));
check($express->data['shipping_total']==='9.95' && $express->data['total']==='59.95','Chosen shipping rate not reflected in quote total');
check($express->data['shipping_rates'][1]['selected']===true,'Chosen rate not marked selected');
$orderRequest=fn($overrides)=>new TestRequest(array_merge(['quote_id'=>$express->data['quote_id'],'payment'=>['gateway'=>'stripe','reference'=>'pi_live_ABC123','amount'=>'59.95','currency'=>'GBP'],'customer'=>['email'=>'buyer@example.com'],'billing'=>$address],$overrides));
rejected(Halobox_Store_Bridge::order($orderRequest(['payment'=>['reference'=>'not-a-stripe-ref','amount'=>'59.95','currency'=>'GBP']])),400,'Non-Stripe payment reference accepted');
rejected(Halobox_Store_Bridge::order($orderRequest(['payment'=>['reference'=>'pi_live_WRONG99','amount'=>'1.00','currency'=>'GBP']])),409,'Paid amount mismatch accepted');
rejected(Halobox_Store_Bridge::order($orderRequest(['payment'=>['reference'=>'pi_live_WRONG99','amount'=>'59.95','currency'=>'USD']])),409,'Currency mismatch accepted');
rejected(Halobox_Store_Bridge::order($orderRequest(['payment'=>['reference'=>'pi_live_WRONG99','amount'=>'59.95','currency'=>'GBP'],'customer'=>['email'=>'not-an-email']])),400,'Invalid customer email accepted');
rejected(Halobox_Store_Bridge::order($orderRequest(['payment'=>['reference'=>'pi_live_WRONG99','amount'=>'59.95','currency'=>'GBP'],'billing'=>['country'=>'GB','postcode'=>'N1 9GU']])),400,'Incomplete billing address accepted');
$paid=Halobox_Store_Bridge::order($orderRequest([]));
check($paid instanceof WP_REST_Response && $paid->data['already']===false,'Paid order not created');
check($paid->data['order']['status']==='processing','payment_complete did not move the draft to processing');
check($paid->data['order']['number']==='501','Order number missing from confirmation');
$draft=$orders_by_id[501];check($draft->email==='buyer@example.com' && ($draft->meta['_halobox_source']??'')==='halobox' && ($draft->meta['_halobox_payment_ref']??'')==='pi_live_ABC123','Order not stamped with customer, source and payment reference');
$repeat=Halobox_Store_Bridge::order($orderRequest([]));
check($repeat->data['already']===true && $repeat->data['order']['number']==='501','Duplicate payment reference created a second order');
rejected(Halobox_Store_Bridge::order($orderRequest(['quote_id'=>hash('sha256','expired'),'payment'=>['reference'=>'pi_live_NEWREF1','amount'=>'59.95','currency'=>'GBP']])),410,'Expired quote accepted for order creation');
ob_start();Halobox_Store_Bridge::page();$denied=ob_get_clean();check($denied==='','Non-admin WP page exposed');
$capability=true;$_POST=['halobox_save'=>'1'];$valid_admin_nonce=false;ob_start();try{Halobox_Store_Bridge::page();check(false,'Settings mutation accepted without nonce');}catch(TestDie $die){check($die->status===403,'Wrong admin nonce rejection');}finally{ob_end_clean();}
check($options['halobox_bridge_enabled']===true,'Rejected settings mutation changed bridge state');
$valid_admin_nonce=true;ob_start();Halobox_Store_Bridge::page();$settings=ob_get_clean();check($options['halobox_bridge_enabled']===false,'Woo admin cannot disable bridge');check(!str_contains($settings,'PRIVATE KEY'),'Private key displayed in settings');
echo "STORE_PHP_BRIDGE_PASS\n";
