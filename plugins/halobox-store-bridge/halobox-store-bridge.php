<?php
/**
 * Plugin Name: Halobox Store Bridge
 * Description: Secure Halobox cart handoff, in-site checkout fulfilment and order visibility. WooCommerce remains the product, payment and order authority.
 * Version: 1.1.0
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
        foreach (['status','checkout','orders','quote','order'] as $endpoint) {
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
        return self::reply(['version'=>'1.1.0','store_url'=>home_url(),'currency'=>get_woocommerce_currency(),'checkout_url'=>wc_get_checkout_url(),'orders_managed_at'=>admin_url('admin.php?page=wc-orders')]);
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
        $all=wc_get_orders(['limit'=>-1,'meta_key'=>'_halobox_source','meta_value'=>'halobox','return'=>'objects']);
        $revenue=0.0;$count=0;$recent=0.0;$cutoff=strtotime('-30 days');
        foreach($all as $o){
            if(in_array($o->get_status(),['cancelled','refunded','failed','checkout-draft'],true)) continue;
            $count++;$revenue+=(float)$o->get_total();
            if($o->get_date_created() && $o->get_date_created()->getTimestamp()>=$cutoff) $recent+=(float)$o->get_total();
        }
        $currency=get_woocommerce_currency();
        return self::reply([
            'orders'=>array_map([__CLASS__,'order_summary'],$orders),
            'summary'=>['count'=>$count,'revenue'=>number_format($revenue,2,'.',''),'revenue_30d'=>number_format($recent,2,'.',''),'currency'=>$currency],
        ]);
    }
    private static function order_summary($o) {
        return ['id'=>$o->get_id(),'number'=>$o->get_order_number(),'status'=>$o->get_status(),'total'=>$o->get_total(),'currency'=>$o->get_currency(),'date'=>$o->get_date_created()?->date('c'),'edit_url'=>$o->get_edit_order_url()];
    }

    // ---------- in-site checkout: quote and order creation ----------

    private static function clean_text($value, $max = 200) {
        return mb_substr(trim(sanitize_text_field((string)($value ?? ''))), 0, $max);
    }
    /** Address fields allowed through the bridge; country must be a real WC country. */
    private static function validate_address($input, $require_contact = false) {
        if (!is_array($input)) return new WP_Error('bridge_address','A delivery address is required.',['status'=>400]);
        $address = [];
        foreach (['first_name','last_name','address_1','address_2','city','state','postcode','country','phone'] as $field) $address[$field] = self::clean_text($input[$field] ?? '', $field === 'address_1' || $field === 'address_2' ? 300 : 100);
        $countries = array_keys(WC()->countries->get_countries());
        if (!in_array($address['country'], $countries, true)) return new WP_Error('bridge_address','Choose a valid delivery country.',['status'=>400]);
        if ($address['postcode'] === '') return new WP_Error('bridge_address','A delivery postcode is required.',['status'=>400]);
        if ($require_contact && ($address['first_name'] === '' || $address['address_1'] === '' || $address['city'] === '')) return new WP_Error('bridge_address','Name, street address and city are required.',['status'=>400]);
        return $address;
    }
    /** Reusable draft order behind a quote id; Woo computes totals, shipping and tax. */
    private static function draft_order($quote_id) {
        if (!is_string($quote_id) || !preg_match('/^[a-f0-9]{64}$/', $quote_id)) return null;
        $draft_id = get_transient('halobox_quote_' . $quote_id);
        if (!$draft_id) return null;
        $order = wc_get_order($draft_id);
        return $order && $order->get_status() === 'checkout-draft' ? $order : null;
    }
    public static function quote($request) {
        $data = $request->get_json_params();
        try { $items = self::validate_items($data['items'] ?? null); }
        catch (Exception $e) { return new WP_Error('bridge_cart', $e->getMessage(), ['status'=>409]); }
        $address = self::validate_address($data['address'] ?? null);
        if (is_wp_error($address)) return $address;
        $coupons = $data['coupons'] ?? [];
        if (!is_array($coupons) || count($coupons) > 5) return new WP_Error('bridge_coupon','Invalid coupons.',['status'=>400]);

        $order = self::draft_order($data['quote_id'] ?? null);
        if (!$order) {
            $order = wc_create_order(['status'=>'checkout-draft']);
            if (!$order) return new WP_Error('bridge_quote','Could not prepare a quote.',['status'=>500]);
        } else {
            $order->remove_order_items(); // line items, shipping and coupons; totals recomputed below
        }
        foreach ($items as $item) {
            $product = wc_get_product($item['variation_id'] ?: $item['id']);
            try { $order->add_product($product, $item['quantity']); }
            catch (Exception $e) { return new WP_Error('bridge_cart','A product in this cart is unavailable.',['status'=>409]); }
        }
        $order->set_address($address, 'billing');
        $order->set_address($address, 'shipping');
        $applied = [];
        foreach ($coupons as $code) {
            $code = self::clean_text($code, 100);
            if ($code !== '' && !is_wp_error($order->apply_coupon($code))) $applied[] = $code;
        }

        // Live shipping rates for this destination: rates added, edited or deleted
        // in WooCommerce shipping zones are reflected here automatically.
        $contents = [];
        $contents_cost = 0.0;
        foreach ($order->get_items() as $line) {
            $product = $line->get_product();
            if (!$product || $product->is_virtual()) continue;
            $contents[] = ['product_id'=>$product->get_id(),'variation_id'=>$line->get_variation_id(),'quantity'=>$line->get_quantity(),'data'=>$product,'line_total'=>(float)$line->get_subtotal(),'line_subtotal'=>(float)$line->get_subtotal(),'line_tax'=>0,'line_subtotal_tax'=>0];
            $contents_cost += (float)$line->get_subtotal();
        }
        $package = [
            'contents'=>$contents,
            'contents_cost'=>$contents_cost,
            'applied_coupons'=>$applied,
            'destination'=>['country'=>$address['country'],'state'=>$address['state'],'postcode'=>$address['postcode'],'city'=>$address['city'],'address'=>$address['address_1'],'address_2'=>$address['address_2']],
            'user'=>['ID'=>0],
        ];
        $rates = array_values(WC()->shipping()->calculate_shipping_for_package($package)['rates'] ?? []);
        $chosen = self::clean_text($data['shipping_rate'] ?? '', 100);
        $selected = null;
        foreach ($rates as $rate) { if ($rate->get_id() === $chosen) { $selected = $rate; break; } }
        if (!$selected && count($rates) === 1) $selected = $rates[0];
        if ($selected) {
            $shipping = new WC_Order_Item_Shipping();
            $shipping->set_method_title($selected->get_label());
            $shipping->set_method_id($selected->get_method_id());
            $shipping->set_total((string)$selected->get_cost());
            $order->add_item($shipping);
        }
        $order->calculate_totals();
        $order->save();

        $quote_id = hash('sha256', random_bytes(32));
        set_transient('halobox_quote_' . $quote_id, $order->get_id(), 1800);
        return self::reply([
            'quote_id'=>$quote_id,
            'currency'=>$order->get_currency(),
            'items_total'=>$order->get_subtotal(),
            'discount_total'=>$order->get_discount_total(),
            'shipping_total'=>$order->get_shipping_total(),
            'tax_total'=>$order->get_total_tax(),
            'total'=>$order->get_total(),
            'shipping_rates'=>array_map(static function($r) use ($selected){ return ['id'=>$r->get_id(),'label'=>$r->get_label(),'cost'=>number_format((float)$r->get_cost(),2,'.',''),'selected'=>$selected && $r->get_id()===$selected->get_id()]; }, $rates),
            'expires_in'=>1800,
        ]);
    }

    public static function order($request) {
        $data = $request->get_json_params();
        $payment = $data['payment'] ?? [];
        $reference = is_array($payment) ? self::clean_text($payment['reference'] ?? '', 100) : '';
        $amount = is_array($payment) ? (string)($payment['amount'] ?? '') : '';
        $currency = is_array($payment) ? strtoupper(self::clean_text($payment['currency'] ?? '', 3)) : '';
        if (!preg_match('/^(cs|pi)_(test|live)?_?[a-zA-Z0-9]{6,}$/', $reference) || !preg_match('/^\d+(\.\d{1,2})?$/', $amount) || strlen($currency) !== 3) {
            return new WP_Error('bridge_payment','Invalid payment confirmation.',['status'=>400]);
        }
        // Idempotent: a Stripe session that already produced an order returns it.
        $existing = wc_get_orders(['limit'=>1,'meta_key'=>'_halobox_payment_ref','meta_value'=>$reference]);
        if ($existing) return self::reply(['order'=>self::order_summary(reset($existing)),'already'=>true]);

        $order = self::draft_order($data['quote_id'] ?? null);
        if (!$order) return new WP_Error('bridge_quote','This quote has expired. Return to Halobox and check out again; you were not charged twice.',['status'=>410]);
        if ($order->get_currency() !== $currency || abs((float)$order->get_total() - (float)$amount) > 0.005) {
            return new WP_Error('bridge_total','The paid amount does not match the quoted total.',['status'=>409]);
        }
        $email = is_array($data['customer'] ?? null) ? sanitize_email($data['customer']['email'] ?? '') : '';
        if (!is_email($email)) return new WP_Error('bridge_address','A valid email address is required.',['status'=>400]);
        $billing = self::validate_address($data['billing'] ?? null, true);
        if (is_wp_error($billing)) return $billing;
        $shipping_address = self::validate_address($data['shipping'] ?? $data['billing'] ?? null, true);
        if (is_wp_error($shipping_address)) return $shipping_address;
        $order->set_address($billing, 'billing');
        $order->set_address($shipping_address, 'shipping');
        $order->set_billing_email($email);
        $order->set_created_via('halobox-bridge');
        $order->set_payment_method_title('Stripe — Halobox');
        $order->set_transaction_id($reference);
        $order->update_meta_data('_halobox_source', 'halobox');
        $order->update_meta_data('_halobox_payment_ref', $reference);
        $order->save();
        // Moves checkout-draft → processing, reduces stock and sends WooCommerce emails.
        $order->payment_complete($reference);
        delete_transient('halobox_quote_' . $data['quote_id']);
        return self::reply(['order'=>self::order_summary(wc_get_order($order->get_id())),'already'=>false]);
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
