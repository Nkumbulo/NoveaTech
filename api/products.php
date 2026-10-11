<?php
/**
 * NoveaTech Shop — PHP API endpoint for shared/cPanel hosting.
 * Same response contract as api_server.py / server.js so shop.js needs
 * zero changes when you switch to this.
 *
 * Two modes, pick one:
 *   MODE = 'json'  -> reads ../products.json (works immediately, no DB setup)
 *   MODE = 'mysql' -> reads from a MySQL `products` table (fill in credentials below)
 *
 * Table schema (if using mysql mode):
 *   CREATE TABLE products (
 *     id INT PRIMARY KEY AUTO_INCREMENT,
 *     cat VARCHAR(30), title VARCHAR(255), brand VARCHAR(100),
 *     price DECIMAL(10,2), old_price DECIMAL(10,2),
 *     badge VARCHAR(20), badgeText VARCHAR(60), stock VARCHAR(60),
 *     img TEXT, dateAdded DATE
 *   );
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

const MODE = 'json'; // change to 'mysql' once your table is ready

$page  = max(1, intval($_GET['page'] ?? 1));
$limit = max(1, intval($_GET['limit'] ?? 12));
$cat   = $_GET['cat'] ?? 'all';
$q     = trim($_GET['q'] ?? '');
$sort  = $_GET['sort'] ?? 'featured';
$price = $_GET['price'] ?? 'all';
// isset(), not ?? — a present-but-empty condition= must be distinguished from "param absent"
$conditionParam = isset($_GET['condition']) ? $_GET['condition'] : null;
$conditions = $conditionParam !== null ? array_values(array_filter(explode(',', $conditionParam))) : null;
$inStockOnly = ($_GET['inStock'] ?? 'true') !== 'false';

function matches_price_range($price, $range) {
    if ($range === 'under100') return $price < 100;
    if ($range === '100-500') return $price >= 100 && $price <= 500;
    if ($range === '500plus') return $price > 500;
    return true; // 'all'
}

function apply_filters($products, $cat, $q, $sort, $priceRange = 'all', $conditions = null, $inStockOnly = true) {
    $result = $products;

    if ($cat && $cat !== 'all') {
        $result = array_values(array_filter($result, fn($p) => ($p['cat'] ?? '') === $cat));
    }

    if ($priceRange && $priceRange !== 'all') {
        $result = array_values(array_filter($result, fn($p) => matches_price_range($p['price'] ?? 0, $priceRange)));
    }

    // null = param not sent -> skip; [] = every box unchecked -> zero results
    // A product with no `condition` field defaults to 'new' rather than vanishing.
    if ($conditions !== null) {
        $result = array_values(array_filter($result, fn($p) => in_array($p['condition'] ?? 'new', $conditions)));
    }

    if ($inStockOnly) {
        $result = array_values(array_filter($result, fn($p) => ($p['inStock'] ?? true) !== false));
    }

    if ($q !== '') {
        $qLower = strtolower($q);
        $result = array_values(array_filter($result, function ($p) use ($qLower) {
            $haystack = strtolower(($p['title'] ?? '') . ' ' . ($p['brand'] ?? '') . ' ' . ($p['cat'] ?? ''));
            return str_contains($haystack, $qLower);
        }));
    }

    usort($result, function ($a, $b) use ($sort) {
        switch ($sort) {
            case 'low':  return ($a['price'] ?? 0) <=> ($b['price'] ?? 0);
            case 'high': return ($b['price'] ?? 0) <=> ($a['price'] ?? 0);
            case 'new':  return strtotime($b['dateAdded'] ?? '') <=> strtotime($a['dateAdded'] ?? '');
            default:     return ($a['id'] ?? 0) <=> ($b['id'] ?? 0);
        }
    });

    return $result;
}

function load_from_json() {
    $file = __DIR__ . '/../products.json';
    if (!file_exists($file)) return [];
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : [];
}

function load_from_mysql() {
    // Fill these in for your host, then set MODE = 'mysql' above.
    $host = 'localhost';
    $db   = 'your_db_name';
    $user = 'your_db_user';
    $pass = 'your_db_password';

    $conn = new mysqli($host, $user, $pass, $db);
    if ($conn->connect_error) {
        http_response_code(500);
        echo json_encode(['error' => 'DB connection failed: ' . $conn->connect_error]);
        exit;
    }

    $rows = [];
    $result = $conn->query("SELECT id, cat, title, brand, price, old_price AS old, badge, badgeText, stock, img, dateAdded, `condition`, in_stock AS inStock FROM products");
    while ($row = $result->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $row['price'] = (float)$row['price'];
        $row['old'] = (float)$row['old'];
        $row['inStock'] = (bool)$row['inStock'];
        $rows[] = $row;
    }
    $conn->close();
    return $rows;
}

try {
    $allProducts = MODE === 'mysql' ? load_from_mysql() : load_from_json();
    $filtered = apply_filters($allProducts, $cat, $q, $sort, $price, $conditions, $inStockOnly);

    $total = count($filtered);
    $totalPages = max(1, (int)ceil($total / $limit));
    $page = min($page, $totalPages);

    $start = ($page - 1) * $limit;
    $pageItems = array_slice($filtered, $start, $limit);

    echo json_encode([
        'products'   => array_values($pageItems),
        'total'      => $total,
        'page'       => $page,
        'totalPages' => $totalPages,
        'limit'      => $limit,
        'hasNext'    => $page < $totalPages,
        'hasPrev'    => $page > 1,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
