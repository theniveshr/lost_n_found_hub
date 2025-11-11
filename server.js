// ===================== IMPORTS ===================== 
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

// ===================== APP SETUP =====================
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Create uploads directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(__dirname, 'uploads', 'avatars');
const itemsDir = path.join(__dirname, 'uploads', 'items');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
}
if (!fs.existsSync(itemsDir)) {
    fs.mkdirSync(itemsDir, { recursive: true });
}

// ===================== MULTER CONFIGURATION =====================
// Storage for avatars
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Storage for item images
const itemStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/items/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'item-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const uploadItemImage = multer({
  storage: itemStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for item images
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===================== DATABASE CONNECTION =====================
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_NAME || 'lost_n_found',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Initialize database tables
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // Create users table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('user', 'admin') DEFAULT 'user',
                full_name VARCHAR(100),
                phone VARCHAR(20),
                location VARCHAR(255),
                avatar_url VARCHAR(500),
                reset_token VARCHAR(255),
                reset_token_expiry TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create items table with item_image field (matching your existing table)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                item_type ENUM('Lost','Found') NOT NULL,
                item_name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                location VARCHAR(255) NOT NULL,
                date DATE NOT NULL,
                contact_email VARCHAR(100) NOT NULL,
                contact_phone VARCHAR(15) NOT NULL,
                item_image VARCHAR(255),
                user_id INT NULL,
                status ENUM('active', 'found', 'returned', 'closed') DEFAULT 'active',
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create password_reset_tokens table for better token management
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(100) NOT NULL,
                token VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_token (token),
                INDEX idx_email (email)
            )
        `);

        // Insert admin user if not exists
        const [adminUsers] = await connection.execute('SELECT * FROM users WHERE email = ?', ['lostnfoundhub1@gmail.com']);
        if (adminUsers.length === 0) {
            const adminPasswordHash = await bcrypt.hash('Admin@12', 10);
            await connection.execute(
                'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
                ['admin', 'lostnfoundhub1@gmail.com', adminPasswordHash, 'admin']
            );
            console.log('Admin user created');
        }

        connection.release();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Initialize database on startup
initializeDatabase();

// ===================== JWT & GOOGLE CLIENT =====================
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here_change_in_production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Fixed generateToken function to handle both string and numeric user IDs
const generateToken = (userId) => {
    const payload = typeof userId === 'number' ? { id: userId } : { id: userId.toString() };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
};

// ===================== MAILER =====================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'lostnfoundhub1@gmail.com',
        pass: process.env.EMAIL_PASS || 'your_app_password_here'
    }
});

// ===================== AUTH MIDDLEWARE =====================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: 'Invalid token' });
        req.user = decoded;
        next();
    });
}

// ===================== AUTH ROUTES =====================

// SIGNUP
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validate required fields
        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username, email, and password are required' 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        // Check if user already exists
        const [existingUser] = await pool.query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        
        if (existingUser.length > 0) {
            const existing = existingUser[0];
            if (existing.email === email) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'User with this email already exists' 
                });
            } else {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Username already taken' 
                });
            }
        }

        // Hash password and create user
        const passwordHash = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, passwordHash, 'user']
        );

        const token = generateToken(result.insertId);

        // Send welcome email
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER || 'lostnfoundhub1@gmail.com',
                to: email,
                subject: "Welcome to Lost & Found Hub!",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4CAF50;">Welcome to Lost & Found Hub!</h2>
                        <p>Hello ${username},</p>
                        <p>Thank you for creating an account with Lost & Found Hub. We're excited to have you on board!</p>
                        <p>You can now start using our platform to:</p>
                        <ul>
                            <li>Report lost items</li>
                            <li>Post found items</li>
                            <li>Connect with people in your community</li>
                            <li>Help reunite lost belongings with their owners</li>
                        </ul>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="http://localhost:3000" 
                               style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block;">
                                Get Started
                            </a>
                        </div>
                        <p>If you have any questions, feel free to contact our support team.</p>
                        <br>
                        <p>Best regards,<br>Lost & Found Hub Team</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Welcome email sending error:', emailError);
            // Don't fail the registration if email fails
        }

        res.json({
            success: true,
            message: 'User created successfully',
            token,
            user: { 
                user_id: result.insertId, 
                username, 
                email, 
                role: 'user' 
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password are required' 
            });
        }

        // Admin login
        if (email === "lostnfoundhub1@gmail.com" && password === "Admin@12") {
            const token = generateToken("admin");
            return res.json({
                success: true,
                role: "admin",
                token,
                message: "Admin login successful",
                user: { 
                    user_id: "admin", 
                    username: "Administrator", 
                    email, 
                    role: "admin" 
                }
            });
        }

        // Regular user login
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const user = users[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        const token = generateToken(user.user_id);

        res.json({
            success: true,
            role: user.role,
            token,
            message: "User login successful",
            user: { 
                user_id: user.user_id, 
                username: user.username, 
                email: user.email, 
                role: user.role 
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// GOOGLE AUTH
app.post('/api/auth/google', async (req, res) => {
    try {
        const { id_token } = req.body;
        
        if (!id_token) {
            return res.status(400).json({
                success: false,
                message: 'Google token is required'
            });
        }

        // Verify Google token
        const ticket = await googleClient.verifyIdToken({
            idToken: id_token,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // Check if user exists
        const [existingUsers] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        let user;
        if (existingUsers.length > 0) {
            // User exists, update last login
            user = existingUsers[0];
            await pool.query(
                'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
                [user.user_id]
            );
        } else {
            // Create new user with Google data
            const username = email.split('@')[0] + '_google';
            const [result] = await pool.query(
                'INSERT INTO users (username, email, password, full_name, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)',
                [username, email, 'google_auth', name, picture, 'user']
            );
            
            user = {
                user_id: result.insertId,
                username,
                email,
                full_name: name,
                avatar_url: picture,
                role: 'user'
            };

            // Send welcome email for Google signup
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER || 'lostnfoundhub1@gmail.com',
                    to: email,
                    subject: "Welcome to Lost & Found Hub!",
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #4CAF50;">Welcome to Lost & Found Hub!</h2>
                            <p>Hello ${name},</p>
                            <p>Thank you for signing up with Google! We're excited to have you on board.</p>
                            <p>You can now start using our platform to report lost and found items.</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="http://localhost:3000" 
                                   style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                                          text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Get Started
                                </a>
                            </div>
                            <p>Best regards,<br>Lost & Found Hub Team</p>
                        </div>
                    `
                });
            } catch (emailError) {
                console.error('Welcome email sending error:', emailError);
            }
        }

        const token = generateToken(user.user_id);

        res.json({
            success: true,
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                name: user.full_name,
                photo: user.avatar_url,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({
            success: false,
            message: 'Google authentication failed'
        });
    }
});

// ===================== ITEMS ROUTES =====================

// Save item to database with image upload - FIXED ENDPOINT
app.post('/api/items', authenticateToken, uploadItemImage.single('itemImage'), async (req, res) => {
    try {
        console.log('Received item submission:', req.body);
        console.log('Uploaded file:', req.file);
        console.log('User ID:', req.user.id);

        const {
            itemType,
            itemName,
            category,
            description,
            location,
            date,
            contactEmail,
            contactPhone
        } = req.body;

        // Validate required fields
        if (!itemType || !itemName || !category || !description || !location || !date || !contactEmail || !contactPhone) {
            console.log('Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }

        // Get user_id from authenticated user (null for admin)
        const userId = req.user.id === "admin" ? null : req.user.id;

        // Handle image URL - using item_image column
        let itemImage = null;
        if (req.file) {
            itemImage = `/uploads/items/${req.file.filename}`;
            console.log('Image URL saved:', itemImage);
        }

        console.log('Inserting into database with user ID:', userId, 'and image URL:', itemImage);

        // Insert item into database
        const query = `
            INSERT INTO items (item_type, item_name, category, description, location, date, contact_email, contact_phone, item_image, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.query(query, [
            itemType,
            itemName,
            category,
            description,
            location,
            date,
            contactEmail,
            contactPhone,
            itemImage,
            userId
        ]);

        console.log('Database insert successful, ID:', result.insertId);
        
        res.json({
            success: true,
            message: 'Item saved successfully',
            itemId: result.insertId,
            itemImage: itemImage
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save item to database: ' + error.message
        });
    }
});

// Get all items with image URLs
app.get('/api/items', async (req, res) => {
    try {
        const query = `
            SELECT i.*, u.username, u.email as user_email 
            FROM items i 
            LEFT JOIN users u ON i.user_id = u.user_id 
            ORDER BY i.submitted_at DESC
        `;
        
        const [items] = await pool.query(query);
        
        // Convert image URLs to full URLs if they exist
        const itemsWithFullImageUrls = items.map(item => ({
            ...item,
            item_image: item.item_image ? `http://localhost:3000${item.item_image}` : null
        }));
        
        res.json({
            success: true,
            items: itemsWithFullImageUrls
        });
    } catch (error) {
        console.error('Get items error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch items'
        });
    }
});

// Get single item by ID
app.get('/api/items/:id', async (req, res) => {
    try {
        const itemId = req.params.id;
        
        const query = `
            SELECT i.*, u.username, u.email as user_email 
            FROM items i 
            LEFT JOIN users u ON i.user_id = u.user_id 
            WHERE i.id = ?
        `;
        
        const [items] = await pool.query(query, [itemId]);
        
        if (items.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }
        
        const item = items[0];
        // Convert image URL to full URL if it exists
        if (item.item_image) {
            item.item_image = `http://localhost:3000${item.item_image}`;
        }
        
        res.json({
            success: true,
            item: item
        });
    } catch (error) {
        console.error('Get item error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch item'
        });
    }
});

// Get user's items
app.get('/api/my-items', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (userId === "admin") {
            // Admin can see all items
            const [items] = await pool.query(`
                SELECT i.*, u.username, u.email as user_email 
                FROM items i 
                LEFT JOIN users u ON i.user_id = u.user_id 
                ORDER BY i.submitted_at DESC
            `);
            
            // Convert image URLs to full URLs
            const itemsWithFullImageUrls = items.map(item => ({
                ...item,
                item_image: item.item_image ? `http://localhost:3000${item.item_image}` : null
            }));
            
            return res.json({
                success: true,
                items: itemsWithFullImageUrls
            });
        }
        
        const [items] = await pool.query(
            'SELECT * FROM items WHERE user_id = ? ORDER BY submitted_at DESC',
            [userId]
        );
        
        // Convert image URLs to full URLs
        const itemsWithFullImageUrls = items.map(item => ({
            ...item,
            item_image: item.item_image ? `http://localhost:3000${item.item_image}` : null
        }));
        
        res.json({
            success: true,
            items: itemsWithFullImageUrls
        });
    } catch (error) {
        console.error('Get my items error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your items'
        });
    }
});

// Update item status
app.put('/api/items/:id/status', authenticateToken, async (req, res) => {
    try {
        const itemId = req.params.id;
        const { status } = req.body;
        
        const validStatuses = ['active', 'found', 'returned', 'closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }
        
        const [result] = await pool.query(
            'UPDATE items SET status = ? WHERE id = ?',
            [status, itemId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Item status updated successfully'
        });
    } catch (error) {
        console.error('Update item status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update item status'
        });
    }
});

// Delete item
app.delete('/api/items/:id', authenticateToken, async (req, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        
        // First get the item to check if it has an image to delete
        const [items] = await pool.query('SELECT item_image FROM items WHERE id = ?', [itemId]);
        
        let query, params;
        
        if (userId === "admin") {
            query = 'DELETE FROM items WHERE id = ?';
            params = [itemId];
        } else {
            query = 'DELETE FROM items WHERE id = ? AND user_id = ?';
            params = [itemId, userId];
        }
        
        const [result] = await pool.query(query, params);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Item not found or you do not have permission to delete it'
            });
        }
        
        // Delete associated image file if it exists
        if (items.length > 0 && items[0].item_image) {
            const imagePath = path.join(__dirname, items[0].item_image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
                console.log('Deleted image file:', imagePath);
            }
        }
        
        res.json({
            success: true,
            message: 'Item deleted successfully'
        });
    } catch (error) {
        console.error('Delete item error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete item'
        });
    }
});

// ===================== PASSWORD RESET ROUTES =====================

// Forgot password
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            // Don't reveal that email doesn't exist for security
            return res.json({ 
                success: true, 
                message: 'If the email exists, a reset link has been sent' 
            });
        }

        // Generate a secure random token
        const token = crypto.randomBytes(32).toString('hex');
        
        // Set expiry time (15 minutes from now)
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Store token in password_reset_tokens table
        await pool.query(
            'INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (?, ?, ?)',
            [email, token, expiresAt]
        );

        const resetLink = `http://localhost:3000/reset-password.html?token=${token}&email=${encodeURIComponent(email)}`;

        // Send email
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER || 'lostnfoundhub1@gmail.com',
                to: email,
                subject: "Password Reset Link - Lost & Found Hub",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4CAF50;">Password Reset Request</h2>
                        <p>Hello,</p>
                        <p>You have requested to reset your password for your Lost & Found Hub account.</p>
                        <p>Click the button below to reset your password (this link is valid for 15 minutes):</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" 
                               style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block;">
                                Reset Password
                            </a>
                        </div>
                        <p>If the button doesn't work, copy and paste this link in your browser:</p>
                        <p style="word-break: break-all;">${resetLink}</p>
                        <p>If you didn't request this reset, please ignore this email.</p>
                        <br>
                        <p>Best regards,<br>Lost & Found Hub Team</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            // Don't fail the request if email fails
        }

        res.json({ 
            success: true, 
            message: 'If the email exists, a reset link has been sent' 
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, newPassword, token } = req.body;
        
        console.log('Reset password request received:', { 
            email: email ? 'present' : 'missing', 
            token: token ? 'present' : 'missing',
            passwordLength: newPassword ? newPassword.length : 0
        });

        // Validate required fields
        if (!email || !newPassword || !token) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email, new password, and token are required' 
            });
        }

        // Check password strength
        if (newPassword.length < 8) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 8 characters long' 
            });
        }

        // Check if token exists and is valid
        const [tokens] = await pool.query(
            'SELECT * FROM password_reset_tokens WHERE email = ? AND token = ? AND used = FALSE AND expires_at > NOW()',
            [email, token]
        );

        console.log('Token validation result:', tokens.length > 0 ? 'valid' : 'invalid');

        if (tokens.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid or expired reset token' 
            });
        }

        // Check if user exists
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user's password
        const [result] = await pool.query(
            'UPDATE users SET password = ? WHERE email = ?',
            [hashedPassword, email]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to update password' 
            });
        }

        // Mark token as used
        await pool.query(
            'UPDATE password_reset_tokens SET used = TRUE WHERE email = ? AND token = ?',
            [email, token]
        );

        console.log('Password reset successfully for email:', email);

        res.json({ 
            success: true, 
            message: 'Password updated successfully. You can now log in with your new password.' 
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// ===================== PROFILE ROUTES =====================

// Get user profile
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        if (req.user.id === "admin") {
            return res.json({ 
                success: true, 
                user: { 
                    user_id: "admin", 
                    username: "Administrator", 
                    email: "lostnfoundhub1@gmail.com", 
                    role: "admin",
                    full_name: "Administrator",
                    phone: "",
                    location: "",
                    avatar_url: "",
                    created_at: new Date().toISOString()
                } 
            });
        }

        const [users] = await pool.query(
            'SELECT user_id, username, email, role, full_name, phone, location, avatar_url, created_at FROM users WHERE user_id = ?', 
            [req.user.id]
        );
        
        if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

        const user = users[0];
        // Convert avatar URL to full URL if it exists
        const avatarUrl = user.avatar_url ? `http://localhost:3000${user.avatar_url}` : null;

        res.json({ 
            success: true, 
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                fullName: user.full_name,
                phone: user.phone,
                location: user.location,
                avatar: avatarUrl,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Update user profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (userId === "admin") {
            return res.status(400).json({ 
                success: false, 
                message: 'Admin profile cannot be updated' 
            });
        }
        
        const { fullName, username, email, phone, location } = req.body;
        
        const [existingUser] = await pool.query(
            'SELECT user_id FROM users WHERE (username = ? OR email = ?) AND user_id != ?',
            [username, email, userId]
        );
        
        if (existingUser.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username or email already exists' 
            });
        }
        
        const [result] = await pool.query(
            `UPDATE users 
             SET full_name = ?, username = ?, email = ?, phone = ?, location = ?, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ?`,
            [fullName, username, email, phone, location, userId]
        );
        
        const [updatedUser] = await pool.query(
            'SELECT user_id, username, email, role, full_name, phone, location, avatar_url, created_at FROM users WHERE user_id = ?',
            [userId]
        );
        
        if (updatedUser.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const user = updatedUser[0];
        const avatarUrl = user.avatar_url ? `http://localhost:3000${user.avatar_url}` : null;
        
        res.json({ 
            success: true, 
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                fullName: user.full_name,
                phone: user.phone,
                location: user.location,
                avatar: avatarUrl,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Upload avatar
app.post('/api/profile/avatar', authenticateToken, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (userId === "admin") {
            return res.status(400).json({ 
                success: false, 
                message: 'Admin cannot upload avatar' 
            });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        
        await pool.query(
            'UPDATE users SET avatar_url = ? WHERE user_id = ?',
            [avatarUrl, userId]
        );
        
        const fullAvatarUrl = `http://localhost:3000${avatarUrl}`;
        
        res.json({ 
            success: true, 
            avatarUrl: fullAvatarUrl,
            message: 'Avatar updated successfully' 
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Change password
app.put('/api/profile/password', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        
        if (userId === "admin") {
            return res.status(400).json({ 
                success: false, 
                message: 'Admin password cannot be changed via this endpoint' 
            });
        }
        
        const [users] = await pool.query(
            'SELECT password FROM users WHERE user_id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const user = users[0];
        
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await pool.query(
            'UPDATE users SET password = ? WHERE user_id = ?',
            [hashedPassword, userId]
        );
        
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete account
app.delete('/api/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (userId === "admin") {
            return res.status(400).json({ 
                success: false, 
                message: 'Admin account cannot be deleted' 
            });
        }
        
        await pool.query('DELETE FROM users WHERE user_id = ?', [userId]);
        
        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ===================== HEALTH CHECK =====================
app.get('/api/health', async (req, res) => {
    try {
        const [result] = await pool.query('SELECT 1');
        res.json({ 
            success: true, 
            message: 'Server and database are running properly',
            database: 'Connected'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Database connection failed',
            error: error.message 
        });
    }
});

// ===================== ERROR HANDLING MIDDLEWARE =====================
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large'
            });
        }
    }
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// ===================== START SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Uploads directory: ${uploadsDir}`);
});