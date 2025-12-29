<?php
/**
 * auth.php - Système d'authentification
 * Gère la connexion, déconnexion et vérification de session admin
 */

require_once 'config.php';

// Récupérer la méthode HTTP
$method = $_SERVER['REQUEST_METHOD'];

// Récupérer les données JSON
$data = json_decode(file_get_contents('php://input'), true);

// Vérifier que c'est une requête POST
if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Méthode non autorisée. Utilisez POST.'
    ]);
    exit;
}

// Récupérer l'action demandée
$action = $data['action'] ?? '';

switch($action) {
    
    // ========== CONNEXION ==========
    case 'login':
        try {
            $username = trim($data['username'] ?? '');
            $password = $data['password'] ?? '';
            
            // Validation des données
            if (empty($username) || empty($password)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Nom d\'utilisateur et mot de passe requis'
                ]);
                exit;
            }
            
            // Vérifier les identifiants
            if ($username === ADMIN_USERNAME && password_verify($password, ADMIN_PASSWORD_HASH)) {
                // Connexion réussie
                $_SESSION['admin_logged_in'] = true;
                $_SESSION['admin_username'] = $username;
                $_SESSION['login_time'] = time();
                $_SESSION['last_activity'] = time();
                $_SESSION['user_ip'] = getClientIP();
                
                // Logger la connexion (optionnel)
                logError("Connexion admin réussie - IP: " . getClientIP());
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Connexion réussie',
                    'admin' => [
                        'username' => $username,
                        'login_time' => date('Y-m-d H:i:s'),
                        'session_id' => session_id()
                    ]
                ]);
            } else {
                // Identifiants incorrects
                http_response_code(401);
                
                // Logger la tentative échouée
                logError("Tentative de connexion échouée - Username: $username - IP: " . getClientIP());
                
                // Ajouter un petit délai pour ralentir les attaques brute force
                sleep(1);
                
                echo json_encode([
                    'success' => false,
                    'message' => 'Identifiants incorrects'
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            logError("Erreur lors de la connexion: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Erreur serveur lors de la connexion'
            ]);
        }
        break;
    
    
    // ========== DÉCONNEXION ==========
    case 'logout':
        try {
            // Logger la déconnexion
            if (isset($_SESSION['admin_username'])) {
                logError("Déconnexion admin - User: " . $_SESSION['admin_username'] . " - IP: " . getClientIP());
            }
            
            // Détruire toutes les variables de session
            $_SESSION = array();
            
            // Détruire le cookie de session si il existe
            if (isset($_COOKIE[session_name()])) {
                setcookie(session_name(), '', time() - 3600, '/');
            }
            
            // Détruire la session
            session_destroy();
            
            echo json_encode([
                'success' => true,
                'message' => 'Déconnexion réussie'
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            logError("Erreur lors de la déconnexion: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Erreur serveur lors de la déconnexion'
            ]);
        }
        break;
    
    
    // ========== VÉRIFIER LA SESSION ==========
    case 'check':
        try {
            // Vérifier si la session est valide
            if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
                
                // Vérifier le timeout de session (30 minutes d'inactivité)
                $timeout = 1800; // 30 minutes en secondes
                if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > $timeout) {
                    // Session expirée
                    session_destroy();
                    echo json_encode([
                        'success' => true,
                        'authenticated' => false,
                        'message' => 'Session expirée'
                    ]);
                    exit;
                }
                
                // Mettre à jour le timestamp de dernière activité
                $_SESSION['last_activity'] = time();
                
                // Vérifier l'IP (optionnel, peut causer des problèmes avec certains FAI)
                /*
                if (isset($_SESSION['user_ip']) && $_SESSION['user_ip'] !== getClientIP()) {
                    session_destroy();
                    echo json_encode([
                        'success' => true,
                        'authenticated' => false,
                        'message' => 'Adresse IP changée, veuillez vous reconnecter'
                    ]);
                    exit;
                }
                */
                
                echo json_encode([
                    'success' => true,
                    'authenticated' => true,
                    'username' => $_SESSION['admin_username'],
                    'login_time' => isset($_SESSION['login_time']) ? date('Y-m-d H:i:s', $_SESSION['login_time']) : null,
                    'session_expires_in' => $timeout - (time() - $_SESSION['last_activity'])
                ]);
            } else {
                // Pas de session active
                echo json_encode([
                    'success' => true,
                    'authenticated' => false
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            logError("Erreur lors de la vérification de session: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Erreur serveur lors de la vérification'
            ]);
        }
        break;
    
    
    // ========== CHANGER LE MOT DE PASSE ==========
    case 'change_password':
        try {
            // Vérifier que l'admin est connecté
            checkAuth();
            
            $current_password = $data['current_password'] ?? '';
            $new_password = $data['new_password'] ?? '';
            $confirm_password = $data['confirm_password'] ?? '';
            
            // Validations
            if (empty($current_password) || empty($new_password) || empty($confirm_password)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Tous les champs sont requis'
                ]);
                exit;
            }
            
            if ($new_password !== $confirm_password) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Les mots de passe ne correspondent pas'
                ]);
                exit;
            }
            
            if (strlen($new_password) < 8) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Le mot de passe doit contenir au moins 8 caractères'
                ]);
                exit;
            }
            
            // Vérifier l'ancien mot de passe
            if (!password_verify($current_password, ADMIN_PASSWORD_HASH)) {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'message' => 'Mot de passe actuel incorrect'
                ]);
                exit;
            }
            
            // Générer le nouveau hash
            $new_hash = password_hash($new_password, PASSWORD_DEFAULT);
            
            // NOTE: En production, il faudrait stocker ce hash dans une base de données
            // Pour l'instant, affichons-le pour que l'admin puisse le copier dans config.php
            
            logError("Changement de mot de passe demandé - User: " . $_SESSION['admin_username']);
            
            echo json_encode([
                'success' => true,
                'message' => 'Nouveau hash généré',
                'new_hash' => $new_hash,
                'instructions' => 'Copiez ce hash et remplacez ADMIN_PASSWORD_HASH dans config.php'
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            logError("Erreur lors du changement de mot de passe: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Erreur serveur'
            ]);
        }
        break;
    
    
    // ========== ACTION INCONNUE ==========
    default:
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Action inconnue',
            'available_actions' => ['login', 'logout', 'check', 'change_password']
        ]);
        break;
}

// ========== INFORMATIONS ==========
/*
 * UTILISATION DE auth.php :
 * 
 * 1. CONNEXION :
 *    POST /auth
 *    Body: {
 *      "action": "login",
 *      "username": "admin",
 *      "password": "votre_mot_de_passe"
 *    }
 * 
 * 2. DÉCONNEXION :
 *    POST /auth
 *    Body: {
 *      "action": "logout"
 *    }
 * 
 * 3. VÉRIFIER LA SESSION :
 *    POST /auth
 *    Body: {
 *      "action": "check"
 *    }
 * 
 * 4. CHANGER LE MOT DE PASSE :
 *    POST /auth
 *    Body: {
 *      "action": "change_password",
 *      "current_password": "ancien",
 *      "new_password": "nouveau",
 *      "confirm_password": "nouveau"
 *    }
 * 
 * SÉCURITÉ :
 * - Les sessions expirent après 30 minutes d'inactivité
 * - Délai de 1 seconde en cas d'échec (anti brute force)
 * - Toutes les tentatives sont loggées
 * - Les mots de passe sont hashés avec password_hash()
 */
?>