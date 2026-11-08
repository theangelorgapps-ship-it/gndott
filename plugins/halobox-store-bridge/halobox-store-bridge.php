<?php
/**
 * Plugin Name: Halobox Store Bridge
 * Description: Secure Halobox cart handoff and fulfilment visibility. WooCommerce remains the product, payment and order authority.
 * Version: 1.0.0
 * Requires PHP: 8.0
 * Requires Plugins: woocommerce
 * License: GPL-2.0-or-later
 */
defined('ABSPATH') || exit;
require_once __DIR__ . '/trusted-key.php';

final class Halobox_Store_Bridge {
    public static function boot() {
        add_action('rest_api_init', [__CLASS__, 'routes']);
        add_action('template_redirect', [__CLASS__, 'handoff']);
        add_action('woocommerce_checkout_create_order', [__CLASS__, 'tag_order'], 10, 2);
        add_action('woocommerce_store_api_checkout_update_order_meta', [__CLASS__, 'tag_order']);
        add_action('woocommerce_thankyou', [__CLASS__, 'clear_source']);
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('woocommerce_blocks_loaded', [__CLASS__, 'extend_products']);
    }
    public static function routes() {
        foreach (['status','checkout','orders'] as $endpoint) {
            register_rest_route('halobox-bridge/v1', '/' . $endpoint, [
                'methods' => 'POST', 'permission_callback' => [__CLASS__, 'authenticate'],
                'callback' => [__CLASS__, $endpoint],
            ]);
        }
    }
    public static function authenticate($request) {
        if (!class_exists('WooCommerce') || !defined('HALOBOX_BRIDGE_PUBLIC_KEY') || !get_option('halobox_bridge_enabled', false)) {
            return new WP_Error('bridge_unconfigured', 'Store bridge is not configured.', ['status'=>503]);
        }
        $time = $request->get_header('x-halobox-time');
        $nonce = $request->get_header('x-halobox-nonce');
        $signature = $request->get_header('x-halobox-signature');
        if (!ctype_digit($time) || abs(time() - (int)$time) > 120 || !preg_match('/^[a-zA-Z0-9-]{20,80}$/', $nonce) || strlen($signature)>1024 || !preg_match('/^[A-Za-z0-9+\/=]+$/', $signature)) {
            return new WP_Error('bridge_auth', 'Invalid bridge request.', ['status'=>401]);
        }
        $path = substr($request->get_route(), strlen('/halobox-bridge/v1'));
        $message = $time . "\n" . $nonce . "\n" . $path . "\n" . $request->get_body();
        $signature = base64_decode($signature, true);
        if ($signature === false || openssl_verify($message, $signature, HALOBOX_BRIDGE_PUBLIC_KEY, OPENSSL_ALGO_SHA256) !== 1) return new WP_Error('bridge_auth', 'Invalid bridge request.', ['status'=>401]);
        // Atomic unique insert prevents concurrent replay of a signed request. Bounded cleanup.
        if (!add_option('halobox_nonce_' . hash('sha256',$nonce), time()+240, '', false)) return new WP_Error('bridge_replay','Request already used.',['status'=>409]);
        global $wpdb;
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s AND CAST(option_value AS UNSIGNED)<%d LIMIT 100", $wpdb->esc_like('halobox_nonce_').'%', time()));
        return true;
    }
    private static function reply($data) { $r = new WP_REST_Response($data); $r->header('Cache-Control','private, no-store'); return $r; }
    public static function status() {
        return self::reply(['version'=>'1.0.0','store_url'=>home_url(),'currency'=>get_woocommerce_currency(),'checkout_url'=>wc_get_checkout_url(),'orders_managed_at'=>admin_url('admin.php?page=wc-orders')]);
    }
    private static function validate_items($items) {
        if (!is_array($items) || count($items)<1 || count($items)>40) throw new Exception('Choose between 1 and 40 products.');
        $validated=[]; $quantities=[];
        foreach($items as $item) {
            if (!isset($item['id'],$item['quantity']) || !is_int($item['id']) || !is_int($item['quantity']) || $item['id']<1 || $item['quantity']<1 || $item['quantity']>20) throw new Exception('Invalid product quantity.');
            $product=wc_get_product($item['id']);
            if (!$product || !in_array($product->get_type(),['simple','variation'],true) || $product->is_virtual() || $product->is_downloadable() || !$product->is_purchasable() || !$product->is_in_stock()) throw new Exception('A product in this cart is unavailable.');
            $parent=$product->is_type('variation') ? wc_get_product($product->get_parent_id()) : $product;
            if (!$parent || $parent->get_status()!=='publish') throw new Exception('A product in this cart is unavailable.');
            $stock_id=$product->get_stock_managed_by_id();
            $quantities[$stock_id]=($quantities[$stock_id]??0)+$item['quantity'];
            if ($quantities[$stock_id]>20 || !$product->has_enough_stock($quantities[$stock_id]) || ($product->is_sold_individually() && $quantities[$stock_id]>1)) throw new Exception('The requested quantity is unavailable.');
            $validated[]=['id'=>$parent->get_id(),'variation_id'=>$product->is_type('variation')?$product->get_id():0,'variation'=>$product->is_type('variation')?$product->get_variation_attributes():[],'quantity'=>$item['quantity']];
        }
        return $validated;
    }
    public static function checkout($request) {
        $data=$request->get_json_params();
        try { self::validate_items($data['items']??null); }
        catch(Exception $e){return new WP_Error('bridge_cart',$e->getMessage(),['status'=>409]);}
        $coupons=$data['coupons']??[];
        if (!is_array($coupons) || count($coupons)>5) return new WP_Error('bridge_coupon','Invalid coupons.',['status'=>400]);
        $token=bin2hex(random_bytes(32));
        set_transient('halobox_cart_'.hash('sha256',$token),['items'=>$data['items'],'coupons'=>array_map('sanitize_text_field',$coupons)],300);
        return self::reply(['checkout_url'=>add_query_arg('halobox_checkout',$token,home_url('/')),'expires_in'=>300]);
    }
    public static function handoff() {
        if (!isset($_GET['halobox_checkout'])) return;
        nocache_headers(); header('Referrer-Policy: no-referrer'); header('X-Robots-Tag: noindex, nofollow');
        if (!class_exists('WooCommerce') || !get_option('halobox_bridge_enabled', false)) wp_die('Store checkout is temporarily unavailable. Please return to Halobox.','Checkout',['response'=>503]);
        $token=sanitize_text_field(wp_unslash($_GET['halobox_checkout']));
        if (!preg_match('/^[a-f0-9]{64}$/',$token)) wp_die('Invalid checkout link. Return to Halobox and try again.', 'Checkout', ['response'=>400]);
        $hash=hash('sha256',$token); $data=get_transient('halobox_cart_'.$hash);
        if (!$data || !add_option('halobox_nonce_'.$hash,time()+600,'',false)) wp_die('This checkout link has expired or was already used. Return to Halobox to create a new checkout.','Checkout',['response'=>410]);
        delete_transient('halobox_cart_'.$hash);
        try {
            $items=self::validate_items($data['items']);
            wc_load_cart();
            WC()->cart->empty_cart();
            foreach($items as $item) if (!WC()->cart->add_to_cart($item['id'],$item['quantity'],$item['variation_id'],$item['variation'])) throw new Exception('An item could not be added. Please review your cart.');
            foreach($data['coupons'] as $coupon) WC()->cart->apply_coupon($coupon);
            WC()->session->set('halobox_order_source',true);
            WC()->session->set_customer_session_cookie(true);
            WC()->cart->calculate_totals();
            wp_safe_redirect(wc_get_checkout_url()); exit;
        } catch(Exception $e) { wp_die(esc_html($e->getMessage()).' Return to Halobox to review your cart.','Checkout',['response'=>409]); }
    }
    public static function tag_order($order) {
        if (WC()->session && WC()->session->get('halobox_order_source')) $order->update_meta_data('_halobox_source','halobox');
    }
    public static function clear_source() { if(WC()->session) WC()->session->__unset('halobox_order_source'); }
    public static function orders() {
        $orders=wc_get_orders(['limit'=>50,'orderby'=>'date','order'=>'DESC','meta_key'=>'_halobox_source','meta_value'=>'halobox']);
        return self::reply(['orders'=>array_map(static function($o){return ['id'=>$o->get_id(),'status'=>$o->get_status(),'total'=>$o->get_total(),'currency'=>$o->get_currency(),'date'=>$o->get_date_created()?->date('c'),'edit_url'=>$o->get_edit_order_url()];},$orders)]);
    }
    public static function menu() { add_submenu_page('woocommerce','Halobox Bridge','Halobox Bridge','manage_woocommerce','halobox-bridge',[__CLASS__,'page']); }
    public static function extend_products() {
        if (!function_exists('woocommerce_store_api_register_endpoint_data')) return;
        woocommerce_store_api_register_endpoint_data([
            'endpoint'=>\Automattic\WooCommerce\StoreApi\Schemas\V1\ProductSchema::IDENTIFIER,
            'namespace'=>'halobox_bridge',
            'data_callback'=>static function($p) {
                $physical = in_array($p->get_type(), ['simple','variable'], true) && !$p->is_virtual() && !$p->is_downloadable();
                if ($physical && $p->is_type('variable')) {
                    foreach($p->get_children() as $id) { $v=wc_get_product($id); if ($v && ($v->is_virtual() || $v->is_downloadable())) { $physical=false; break; } }
                }
                return ['physical'=>$physical];
            },
            'schema_callback'=>static function(){return ['physical'=>['description'=>'Physical goods eligibility','type'=>'boolean','readonly'=>true]];},
            'schema_type'=>ARRAY_A,
        ]);
    }
    public static function page() {
        if (!current_user_can('manage_woocommerce')) return;
        if (isset($_POST['halobox_save'])) {
            check_admin_referer('halobox_bridge_settings');
            update_option('halobox_bridge_enabled', isset($_POST['halobox_enabled']), false);
            echo '<div class="notice notice-success"><p>Bridge settings saved.</p></div>';
        }
        $enabled = get_option('halobox_bridge_enabled', false);
        $fingerprint = substr(hash('sha256', HALOBOX_BRIDGE_PUBLIC_KEY),0,20);
        echo '<div class="wrap"><h1>Halobox Store Bridge</h1><p>Paired with GoodNews Halobox. Only requests signed by your Halobox server can hand off a cart or read the status of Halobox orders.</p><p>Connection fingerprint: <code>'.esc_html($fingerprint).'</code></p><form method="post">';
        wp_nonce_field('halobox_bridge_settings');
        echo '<label><input type="checkbox" name="halobox_enabled" value="1" '.checked($enabled,true,false).'> Enable Halobox checkout and order status connection</label><p><button class="button button-primary" name="halobox_save" value="1">Save connection</button></p></form><p>Products, prices, stock, shipping, tax and payment stay in WooCommerce. No customer address or card data is copied to Halobox. Disable the connection above at any time.</p><p>Orders created through the bridge have the <code>_halobox_source=halobox</code> marker. Update fulfilment and refunds in WooCommerce as usual.</p><p><a href="'.esc_url(admin_url('admin.php?page=wc-orders')).'" class="button">Manage orders</a></p></div>';
    }
}
Halobox_Store_Bridge::boot();
