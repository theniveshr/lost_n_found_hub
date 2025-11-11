const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const admin = require('firebase-admin'); // Optional: Only if using Firebase

const app = express();

// Middleware
app.use(express.json());

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'lost_n_found'
};

// Initialize database connection pool
const db = mysql.createPool(dbConfig);

// Initialize Firebase Admin (if using Firebase)
// const serviceAccount = require('./path/to/serviceAccountKey.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// Rate limiting for password updates
const updatePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 password update requests per windowMs
    message: {
        success: false,
        message: 'Too many password update attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// GET /api/items - Fetch all active items
app.get('/api/items', async (req, res) => {
    try {
        const query = `
            SELECT 
                id, 
                item_type, 
                item_name, 
                category, 
                description, 
                location, 
                date, 
                contact_email, 
                contact_phone, 
                item_image, 
                user_id, 
                status, 
                submitted_at 
            FROM items 
            WHERE status = 'active' 
            ORDER BY submitted_at DESC
        `;
        
        const [items] = await db.execute(query);
        
        res.json({
            success: true,
            items: items
        });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch items'
        });
    }
});

// POST /api/update-password - Update user password
app.post('/api/update-password', updatePasswordLimiter, async (req, res) => {
    const { email, currentPassword, newPassword, confirmPassword } = req.body;

    // Input validation
    if (!email || !newPassword) {
        return res.status(400).json({ 
            success: false,
            message: 'Email and new password are required.' 
        });
    }

    // Password confirmation check
    if (newPassword !== confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'New password and confirmation do not match.'
        });
    }

    // Password strength validation
    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters long.'
        });
    }

    try {
        // Option 1: Using Firebase Auth (uncomment if using Firebase)
        /*
        const user = await admin.auth().getUserByEmail(email);
        
        // Optional: Verify current password if provided
        if (currentPassword) {
            const isCurrentPasswordValid = await verifyCurrentPassword(email, currentPassword);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect.'
                });
            }
        }

        // Update password in Firebase Auth
        await admin.auth().updateUser(user.uid, { 
            password: newPassword 
        });
        */

        // Option 2: Using Database (MySQL) - Use this if not using Firebase
        const [users] = await db.execute(
            'SELECT id, password FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this email address.'
            });
        }

        const user = users[0];

        // Verify current password (if provided)
        if (currentPassword) {
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect.'
                });
            }
        }

        // Hash new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password in database
        await db.execute(
            'UPDATE users SET password = ? WHERE email = ?',
            [hashedPassword, email]
        );

        // Log the password change activity
        console.log(`Password updated for user: ${email}`);

        // Send success response
        res.json({ 
            success: true,
            message: 'Password updated successfully.' 
        });

    } catch (error) {
        console.error('Password update error:', error);

        // Handle specific Firebase Auth errors
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({
                success: false,
                message: 'User not found with this email address.'
            });
        }

        if (error.code === 'auth/weak-password') {
            return res.status(400).json({
                success: false,
                message: 'Password is too weak. Please choose a stronger password.'
            });
        }

        if (error.code === 'auth/requires-recent-login') {
            return res.status(400).json({
                success: false,
                message: 'This operation requires recent authentication. Please log in again.'
            });
        }

        // Generic error response
        res.status(500).json({
            success: false,
            message: 'Failed to update password. Please try again.'
        });
    }
});

// Additional useful endpoints for the Lost & Found application

// POST /api/items - Submit a new lost/found item
app.post('/api/items', async (req, res) => {
    const {
        item_type,
        item_name,
        category,
        description,
        location,
        date,
        contact_email,
        contact_phone,
        item_image,
        user_id
    } = req.body;

    try {
        const query = `
            INSERT INTO items (
                item_type, item_name, category, description, location, 
                date, contact_email, contact_phone, item_image, user_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `;

        const [result] = await db.execute(query, [
            item_type, item_name, category, description, location,
            date, contact_email, contact_phone, item_image, user_id
        ]);

        res.json({
            success: true,
            message: 'Item submitted successfully',
            itemId: result.insertId
        });

    } catch (error) {
        console.error('Error submitting item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit item'
        });
    }
});

// GET /api/items/:id - Get specific item by ID
app.get('/api/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [items] = await db.execute(
            'SELECT * FROM items WHERE id = ? AND status = "active"',
            [id]
        );

        if (items.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        res.json({
            success: true,
            item: items[0]
        });

    } catch (error) {
        console.error('Error fetching item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch item'
        });
    }
});

// PUT /api/items/:id/status - Update item status
app.put('/api/items/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['active', 'found', 'returned', 'closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        await db.execute(
            'UPDATE items SET status = ? WHERE id = ?',
            [status, id]
        );

        res.json({
            success: true,
            message: 'Item status updated successfully'
        });

    } catch (error) {
        console.error('Error updating item status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update item status'
        });
    }
});

// GET /api/stats - Get platform statistics
app.get('/api/stats', async (req, res) => {
    try {
        const [totalItems] = await db.execute(
            'SELECT COUNT(*) as count FROM items WHERE status = "active"'
        );
        
        const [claimedItems] = await db.execute(
            'SELECT COUNT(*) as count FROM items WHERE status = "found" OR status = "returned"'
        );
        
        const [resolvedItems] = await db.execute(
            'SELECT COUNT(*) as count FROM items WHERE status = "returned" OR status = "closed"'
        );

        res.json({
            success: true,
            stats: {
                totalItems: totalItems[0].count,
                claimedItems: claimedItems[0].count,
                resolvedItems: resolvedItems[0].count
            }
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

// Helper function to verify current password (for Firebase)
async function verifyCurrentPassword(email, password) {
    try {
        // This would require Firebase Admin SDK or Firebase Auth REST API
        // You might need to sign in the user with email/password to verify
        const signInResult = await admin.auth().getUserByEmail(email);
        // Note: Firebase Admin SDK doesn't have a direct way to verify passwords
        // You might need to use the Firebase Auth REST API for this
        return true; // Placeholder - implement based on your auth system
    } catch (error) {
        return false;
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;