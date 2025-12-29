<?php

// Démarrer la session
session_start();

// ========== CONFIGURATION BASE DE DONNÉES ==========
// Modifiez ces valeurs avec vos identifiants de base de données
define('DB_HOST', 'sql304.infinityfree.com');              
define('DB_USER','if0_40783055');   
define('DB_PASS', '2x4v1SbrdtaL8Mr');   
define('DB_NAME', 'if0_40783055_XXX');           

// ========== CONFIGURATION ADMIN ==========
// IMPORTANT : Changez ces identifiants en production !
define('Charnscode', 'charnokgb2007');
// Pour générer un nouveau hash, utilisez : password_hash('Charnokgb2007')
define('$2a$12$W.mN6skw/SPpWQpqAMO.I.T4XksR3IjLfkMOyn13vjGR9sq9QKSd2'); 

// ========== CONFIGURATION UPLOAD ==========
define('UPLOAD_DIR', __DIR__ . '/uploads/');  // Dossier où stocker les images uploadées
define('UPLOAD_URL', '/uploads/');            // URL publique pour accéder aux images
define('MAX_FILE_SIZE', 5 * 1024 * 1024);     // Taille max : 5MB
define('ALLOWED_EXTENSIONS', ['jpg', 'jpeg', 'png', 'gif', 'webp']); // Formats autorisés

// Créer le dossier uploads s'il n'existe pas
if (!file_exists(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

// ========== CONFIGURATION ENVIRONNEMENT ==========
// En production, mettez ceci à false
define('DEBUG_MODE', true);

if (DEBUG_MODE) {
    // Mode développement : afficher les erreurs
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
} else {
    // Mode production : cacher les erreurs
    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
    error_reporting(0);
}

// ========== CONNEXION À LA BASE DE DONNÉES ==========
/**
 * Fonction pour obtenir une connexion PDO à la base de données
 * @return PDO Instance de connexion PDO
 */
function getDB() {
    try {
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
            ]
        );
        return $pdo;
    } catch(PDOException $e) {
        // En production, logger l'erreur au lieu de l'afficher
        if (DEBUG_MODE) {
            die(json_encode([
                'success' => false, 
                'message' => 'Erreur de connexion à la base de données',
                'error' => $e->getMessage()
            ]));
        } else {
            die(json_encode([
                'success' => false, 
                'message' => 'Erreur de connexion à la base de données'
            ]));
        }
    }
}

// ========== FONCTIONS DE SÉCURITÉ ==========

/**
 * Nettoyer et sécuriser les données utilisateur
 * @param string $data Données à nettoyer
 * @return string Données nettoyées
 */
function sanitize($data) {
    if ($data === null) return '';
    return htmlspecialchars(strip_tags(trim($data)), ENT_QUOTES, 'UTF-8');
}

/**
 * Vérifier si l'utilisateur est authentifié comme admin
 * @return bool True si authentifié, False sinon
 */
function isAuthenticated() {
    return isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

/**
 * Vérifier l'authentification et arrêter si non authentifié
 */
function checkAuth() {
    if (!isAuthenticated()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Non authentifié']);
        exit;
    }
}

/**
 * Obtenir l'adresse IP du client
 * @return string Adresse IP
 */
function getClientIP() {
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        return $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        return $_SERVER['HTTP_X_FORWARDED_FOR'];
    } else {
        return $_SERVER['REMOTE_ADDR'];
    }
}

// ========== HEADERS HTTP ==========
// Configuration des headers CORS et JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Gérer les requêtes OPTIONS (preflight CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ========== CONFIGURATION TIMEZONE ==========
date_default_timezone_set('Africa/Porto-Novo'); // Timezone du Bénin

// ========== LOGS ==========
/**
 * Logger une erreur dans un fichier
 * @param string $message Message d'erreur
 */
function logError($message) {
    if (!DEBUG_MODE) {
        $logFile = __DIR__ . '/logs/error.log';
        $logDir = dirname($logFile);
        
        if (!file_exists($logDir)) {
            mkdir($logDir, 0755, true);
        }
        
        $timestamp = date('Y-m-d H:i:s');
        $logMessage = "[$timestamp] $message\n";
        file_put_contents($logFile, $logMessage, FILE_APPEND);
    }
}

